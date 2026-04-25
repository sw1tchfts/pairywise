-- pairywise — Supabase schema
--
-- Paste this whole file into the Supabase SQL editor and run it. It's
-- idempotent: re-running drops and re-creates the policies/triggers it owns,
-- but preserves data in existing tables. See supabase/README.md for details.

-- ============================================================================
-- Extensions
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- Helper: updated_at trigger
-- ============================================================================

create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- profiles
-- ============================================================================
-- One row per auth user. Created automatically on signup via trigger below.

create table if not exists public.profiles (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  handle        text unique,
  display_name  text,
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint profiles_handle_format check (
    handle is null or handle ~ '^[a-z0-9_]{2,32}$'
  )
);

-- Backfill the admin flag on installs that pre-date this column.
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- Block non-admins from promoting themselves (or anyone else). Only an
-- existing admin (or a server-side script with no JWT) can flip is_admin.
-- A null auth.uid() means we're running outside a user request (SQL editor,
-- service role, migration), so the trigger gets out of the way.
create or replace function public.tg_profiles_guard_is_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_admin is distinct from old.is_admin
     and auth.uid() is not null
     and not coalesce(public.is_admin(auth.uid()), false) then
    raise exception 'Only admins can change is_admin';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_is_admin on public.profiles;
create trigger profiles_guard_is_admin
  before update on public.profiles
  for each row execute function public.tg_profiles_guard_is_admin();

-- Create the profile row automatically whenever a new auth user signs up.
create or replace function public.tg_create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.tg_create_profile_for_new_user();

-- ============================================================================
-- lists
-- ============================================================================

create table if not exists public.lists (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users(id) on delete cascade,
  title               text not null check (length(title) between 1 and 200),
  description         text,
  tags                text[] not null default '{}',
  visibility          text not null default 'private'
                        check (visibility in ('private', 'unlisted', 'public')),
  phase               text not null default 'voting'
                        check (phase in ('submission', 'voting')),
  algorithm_default   text not null default 'elo'
                        check (algorithm_default in ('elo', 'bradleyTerry')),
  tier_assignments    jsonb not null default '{}'::jsonb,
  direct_ratings      jsonb not null default '{}'::jsonb,
  bracket             jsonb,
  archived_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists lists_owner_id_idx
  on public.lists (owner_id, updated_at desc);
create index if not exists lists_visibility_idx
  on public.lists (visibility) where visibility <> 'private';

drop trigger if exists lists_set_updated_at on public.lists;
create trigger lists_set_updated_at
  before update on public.lists
  for each row execute function public.tg_set_updated_at();

-- ============================================================================
-- list_members
-- ============================================================================
-- Users invited (or who self-joined via a share link) to a list. Owners are
-- tracked on lists.owner_id, NOT via a row here.

create table if not exists public.list_members (
  list_id     uuid not null references public.lists(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'voter' check (role in ('voter')),
  joined_at   timestamptz not null default now(),
  primary key (list_id, user_id)
);

create index if not exists list_members_user_idx
  on public.list_members (user_id);

-- ============================================================================
-- items
-- ============================================================================

create table if not exists public.items (
  id            uuid primary key default gen_random_uuid(),
  list_id       uuid not null references public.lists(id) on delete cascade,
  type          text not null default 'text'
                  check (type in ('text', 'image', 'url', 'tmdb', 'spotify', 'youtube', 'media')),
  title         text not null check (length(title) between 1 and 500),
  description   text,
  image_url     text,
  audio_url     text,
  video_url     text,
  link_url      text,
  external_id   text,
  tags          text[] not null default '{}',
  metadata      jsonb,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null default auth.uid()
);

create index if not exists items_list_position_idx
  on public.items (list_id, position);
create index if not exists items_list_creator_idx
  on public.items (list_id, created_by);

-- ============================================================================
-- comparisons
-- ============================================================================

create table if not exists public.comparisons (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references public.lists(id) on delete cascade,
  voter_id    uuid not null references auth.users(id) on delete cascade,
  winner_id   uuid not null references public.items(id) on delete cascade,
  loser_id    uuid not null references public.items(id) on delete cascade,
  skipped     boolean not null default false,
  created_at  timestamptz not null default now(),
  constraint comparisons_different_items check (winner_id <> loser_id)
);

create index if not exists comparisons_list_idx
  on public.comparisons (list_id, created_at);
create index if not exists comparisons_voter_idx
  on public.comparisons (voter_id, list_id);

-- At most one non-skipped vote per (list, voter, unordered pair). Skips can
-- repeat — they're how "show me something else" is logged.
create unique index if not exists comparisons_unique_pair
  on public.comparisons (
    list_id,
    voter_id,
    least(winner_id, loser_id),
    greatest(winner_id, loser_id)
  )
  where skipped = false;

-- ============================================================================
-- Access-check helpers (SECURITY DEFINER to avoid RLS recursion)
-- ============================================================================

create or replace function public.list_is_member(p_list_id uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.list_members
    where list_id = p_list_id and user_id = p_user
  );
$$;

create or replace function public.list_owner_id(p_list_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select owner_id from public.lists where id = p_list_id;
$$;

create or replace function public.list_visibility(p_list_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select visibility from public.lists where id = p_list_id;
$$;

create or replace function public.list_phase(p_list_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select phase from public.lists where id = p_list_id;
$$;

-- Platform-wide super-user check. Returns false for null / unknown users.
create or replace function public.is_admin(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where user_id = p_user),
    false
  );
$$;

grant execute on function public.is_admin(uuid) to anon, authenticated;

-- ============================================================================
-- RPC: list_item_counts
-- ============================================================================
-- Per-user submitted-item counts for a list. Used by the submission-phase UI
-- to show "N ideas from Alice, M from Bob" without exposing the items
-- themselves (which are still hidden by RLS).

create or replace function public.list_item_counts(p_list_id uuid)
returns table (user_id uuid, item_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select i.created_by as user_id, count(*)::bigint as item_count
  from public.items i
  where i.list_id = p_list_id
    and i.created_by is not null
    and (
      public.list_owner_id(p_list_id) = auth.uid()
      or public.list_is_member(p_list_id, auth.uid())
      or public.list_visibility(p_list_id) <> 'private'
    )
  group by i.created_by;
$$;

grant execute on function public.list_item_counts(uuid) to anon, authenticated;

-- ============================================================================
-- Row-level security
-- ============================================================================

alter table public.profiles       enable row level security;
alter table public.lists          enable row level security;
alter table public.list_members   enable row level security;
alter table public.items          enable row level security;
alter table public.comparisons    enable row level security;

-- Drop existing policies so re-running the script is safe.
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'lists', 'list_members', 'items', 'comparisons')
  loop
    execute format('drop policy %I on %I.%I',
      r.policyname, r.schemaname, r.tablename);
  end loop;
end
$$;

-- ---- profiles ----
-- Every signed-in user can read profiles (needed to render voter names on
-- shared lists). Users can only update their own row; inserts are handled by
-- the auth-signup trigger.
create policy profiles_select_all on public.profiles
  for select to authenticated, anon
  using (true);
-- Self-update OR admin-update-anyone. The is_admin column is additionally
-- guarded by tg_profiles_guard_is_admin so non-admins can't promote themselves.
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()))
  with check (user_id = auth.uid() or public.is_admin(auth.uid()));

-- ---- lists ----
create policy lists_select_visible on public.lists
  for select to authenticated, anon
  using (
    visibility <> 'private'
    or owner_id = auth.uid()
    or public.list_is_member(id, auth.uid())
    or public.is_admin(auth.uid())
  );
create policy lists_insert_own on public.lists
  for insert to authenticated
  with check (owner_id = auth.uid());
create policy lists_update_own on public.lists
  for update to authenticated
  using (owner_id = auth.uid() or public.is_admin(auth.uid()))
  with check (owner_id = auth.uid() or public.is_admin(auth.uid()));
create policy lists_delete_own on public.lists
  for delete to authenticated
  using (owner_id = auth.uid() or public.is_admin(auth.uid()));

-- ---- list_members ----
-- A user can see their own membership rows, and the list owner can see all
-- rows for their list.
create policy list_members_select on public.list_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.list_owner_id(list_id) = auth.uid()
    or public.is_admin(auth.uid())
  );
-- Self-join: any authenticated user can add themselves as a voter, but only
-- to a list that is unlisted/public (RLS on lists would otherwise hide it).
create policy list_members_insert_self on public.list_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and role = 'voter'
    and public.list_visibility(list_id) in ('unlisted', 'public')
  );
-- Owners (and platform admins) can add members directly.
create policy list_members_insert_by_owner on public.list_members
  for insert to authenticated
  with check (
    public.list_owner_id(list_id) = auth.uid()
    or public.is_admin(auth.uid())
  );
-- A user can leave; the owner or an admin can remove anyone.
create policy list_members_delete on public.list_members
  for delete to authenticated
  using (
    user_id = auth.uid()
    or public.list_owner_id(list_id) = auth.uid()
    or public.is_admin(auth.uid())
  );

-- ---- items ----
-- Visibility during submission phase: the owner sees everything; other
-- members only see their own rows. During voting phase: everyone with list
-- access sees everything.
create policy items_select on public.items
  for select to authenticated, anon
  using (
    public.is_admin(auth.uid())
    or (
      (
        public.list_owner_id(list_id) = auth.uid()
        or public.list_is_member(list_id, auth.uid())
        or public.list_visibility(list_id) <> 'private'
      )
      and (
        public.list_phase(list_id) = 'voting'
        or public.list_owner_id(list_id) = auth.uid()
        or created_by = auth.uid()
      )
    )
  );
-- Owners (and admins) can add items any time; members can add during
-- submission phase.
create policy items_insert on public.items
  for insert to authenticated
  with check (
    public.list_owner_id(list_id) = auth.uid()
    or public.is_admin(auth.uid())
    or (
      public.list_is_member(list_id, auth.uid())
      and public.list_phase(list_id) = 'submission'
    )
  );
-- Owner / admin can edit/delete anything; a creator can edit/delete their
-- own items while the list is in submission phase.
create policy items_update on public.items
  for update to authenticated
  using (
    public.list_owner_id(list_id) = auth.uid()
    or public.is_admin(auth.uid())
    or (
      created_by = auth.uid()
      and public.list_phase(list_id) = 'submission'
    )
  )
  with check (
    public.list_owner_id(list_id) = auth.uid()
    or public.is_admin(auth.uid())
    or (
      created_by = auth.uid()
      and public.list_phase(list_id) = 'submission'
    )
  );
create policy items_delete on public.items
  for delete to authenticated
  using (
    public.list_owner_id(list_id) = auth.uid()
    or public.is_admin(auth.uid())
    or (
      created_by = auth.uid()
      and public.list_phase(list_id) = 'submission'
    )
  );

-- ---- comparisons ----
-- Anyone who can see the list can see its votes (needed for aggregate
-- rankings). Votes can only be inserted by the voter themselves, only
-- while the list is in voting phase, and only by someone with list access.
create policy comparisons_select on public.comparisons
  for select to authenticated, anon
  using (
    public.list_owner_id(list_id) = auth.uid()
    or public.list_is_member(list_id, auth.uid())
    or public.list_visibility(list_id) <> 'private'
    or public.is_admin(auth.uid())
  );
create policy comparisons_insert on public.comparisons
  for insert to authenticated
  with check (
    voter_id = auth.uid()
    and public.list_phase(list_id) = 'voting'
    and (
      public.list_owner_id(list_id) = auth.uid()
      or public.list_is_member(list_id, auth.uid())
      or public.list_visibility(list_id) <> 'private'
    )
  );
create policy comparisons_delete on public.comparisons
  for delete to authenticated
  using (
    voter_id = auth.uid()
    or public.list_owner_id(list_id) = auth.uid()
    or public.is_admin(auth.uid())
  );

-- ============================================================================
-- Realtime publication
-- ============================================================================
-- The client subscribes to INSERT/DELETE on comparisons for live voting.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'comparisons'
  ) then
    execute 'alter publication supabase_realtime add table public.comparisons';
  end if;
end
$$;

-- ============================================================================
-- Storage: audio bucket
-- ============================================================================
-- Public bucket for user-uploaded / trimmed audio clips. Public-read so the
-- URL saved in items.audio_url can be used in <audio> tags without extra auth.

insert into storage.buckets (id, name, public)
values ('audio', 'audio', true)
on conflict (id) do update set public = excluded.public;

-- Drop old policies so this is idempotent.
do $$
declare
  r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'audio_%'
  loop
    execute format('drop policy %I on storage.objects', r.policyname);
  end loop;
end
$$;

-- Public read.
create policy audio_public_read on storage.objects
  for select to authenticated, anon
  using (bucket_id = 'audio');

-- A user can only write under their own prefix: <user_id>/...
create policy audio_insert_self on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy audio_update_self on storage.objects
  for update to authenticated
  using (
    bucket_id = 'audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy audio_delete_self on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- Bootstrap admin
-- ============================================================================
-- Promote the project owner. Run from the SQL editor or as service role:
-- auth.uid() is null in those contexts, so tg_profiles_guard_is_admin lets
-- the update through. If the target user hasn't signed up yet, this is a
-- no-op — re-run the script after they create their account.

update public.profiles
set is_admin = true
where user_id in (
  select id from auth.users where lower(email) = 'phillipklejwa@gmail.com'
);
