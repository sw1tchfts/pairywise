# Supabase setup

Pairywise talks to a Supabase project for auth, data, realtime, and audio
storage. The project URL / anon key are baked into
[`src/lib/supabase/env.ts`](../src/lib/supabase/env.ts) (both are safe to
commit — RLS is what protects data). To spin up a fresh project from scratch,
run the SQL in `schema.sql` and configure auth as described below.

## 1. Apply the schema

Open the **SQL Editor** in the Supabase dashboard, paste the full contents of
[`schema.sql`](./schema.sql), and run it. The script is idempotent — policies
and triggers are dropped and recreated, data is preserved.

What it creates:

| Object | Purpose |
| --- | --- |
| `public.profiles` | Per-user handle / display name / role / disabled state, auto-created on signup |
| `public.lists` | Ranking lists (title, visibility, phase, algorithm, etc.) |
| `public.list_members` | Voters invited to (or self-joined via link) a list |
| `public.items` | Items in a list (text / image / url / tmdb / media) |
| `public.comparisons` | A-vs-B votes (one non-skipped vote per voter per unordered pair) |
| `list_item_counts(uuid)` RPC | Per-user submitted-item counts for a list |
| `admin_list_users()` RPC | Admin-only view of every account (email, handle, role, sign-in times) |
| `is_admin(uuid)` helper | Used by RLS and the admin guard trigger |
| Realtime publication | `comparisons` added to `supabase_realtime` |
| `audio` storage bucket | Public bucket for uploaded / trimmed audio clips |

All tables have RLS enabled. The policies enforce:

- **Lists** — you see lists you own, are a member of, or that are unlisted/public.
- **Items** — during submission phase, only the owner sees everything; each
  member sees their own items. During voting phase, everyone with list access
  sees all items.
- **Votes** — only the voter can insert (and only during voting phase, only
  if they have list access). Anyone with list access can read them.
- **Audio** — public read; users can only write files under their own `<uid>/…` prefix.

## 1b. Bootstrap the first admin

The `profiles.role` column defaults to `'user'`. The RLS policies + the
`profiles_guard_privileged_cols` trigger prevent anyone from granting
themselves admin through the app — you have to do it once, from the SQL
editor (which runs as the `postgres` superuser and bypasses the guard).

Run this **once**, replacing the email, after your account has signed up:

```sql
update public.profiles
set role = 'admin'
where user_id = (
  select id from auth.users where lower(email) = lower('you@example.com')
);
```

After that, sign out and back in — a **User security** link appears in the
account menu, routing to `/admin/users` where admins can promote / revoke
other admins and disable accounts. The last remaining active admin cannot
be demoted or disabled.

## 2. Configure auth

In **Authentication → URL Configuration**, set:

- **Site URL** — your deployed origin (e.g. `https://www.pairywise.com`), or
  `http://localhost:3000` for local dev.
- **Additional Redirect URLs** — include every origin you'll sign in from,
  with `/auth/callback` appended. Example:
  - `http://localhost:3000/auth/callback`
  - `https://www.pairywise.com/auth/callback`
  - `https://<preview>.vercel.app/auth/callback`

The email-confirmation link hits `/auth/callback?code=…&next=…`, which
exchanges the code for a session cookie (see
[`src/app/auth/callback/route.ts`](../src/app/auth/callback/route.ts)).

Email/password is the only provider used. Leave "Confirm email" on — the app
assumes the link flow.

## 3. (Optional) Override the baked-in project

For non-production environments, create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-publishable-key>
```

`src/lib/supabase/env.ts` falls back to the committed defaults if these are
absent.

## 4. Sanity checks

After running the schema, verify with:

```sql
select tablename, rowsecurity from pg_tables
where schemaname = 'public'
  and tablename in ('profiles','lists','list_members','items','comparisons');
-- All rows should have rowsecurity = true.

select bucket_id, public from storage.buckets where id = 'audio';
-- public should be true.

select tablename from pg_publication_tables
where pubname = 'supabase_realtime' and tablename = 'comparisons';
-- one row.
```

Then create a list in the app, sign in from a second browser / incognito
window, open the share link, and cast a vote — it should appear live in the
first window.
