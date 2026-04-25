'use client';

import type {
  Algorithm,
  Bracket,
  Comparison,
  Item,
  Phase,
  RankList,
  Tier,
} from '../types';
import { getBrowserClient } from '../supabase/browser';
import {
  comparisonFromRow,
  itemFromRow,
  itemInsert,
  itemUpdate,
  listFromRow,
  type ComparisonRow,
  type ItemRow,
  type ListRow,
} from './mappers';

/** Returns the currently signed-in user's id, or null. */
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = getBrowserClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Fetch lists owned by the current user or that they're a member of.
 *  Archived lists are excluded by default — pass includeArchived=true for the /archived view. */
export async function fetchAllLists(
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<RankList[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const supabase = getBrowserClient();

  const ownQuery = supabase
    .from('lists')
    .select('*')
    .eq('owner_id', userId)
    .order('updated_at', { ascending: false });
  if (!includeArchived) ownQuery.is('archived_at', null);
  const [ownRes, memberRes] = await Promise.all([
    ownQuery,
    supabase
      .from('list_members')
      .select('list:lists(*)')
      .eq('user_id', userId),
  ]);
  if (ownRes.error) throw ownRes.error;
  if (memberRes.error) throw memberRes.error;

  const byId = new Map<string, ListRow>();
  for (const row of (ownRes.data ?? []) as ListRow[]) byId.set(row.id, row);
  type MemberJoin = { list: ListRow | ListRow[] | null };
  const memberRows = (memberRes.data ?? []) as unknown as MemberJoin[];
  for (const row of memberRows) {
    // Supabase-js with no typed schema can type embedded joins as either
    // a single row or an array depending on the cardinality; normalize.
    const listObj = Array.isArray(row.list) ? row.list[0] ?? null : row.list;
    if (!listObj) continue;
    if (!includeArchived && listObj.archived_at) continue;
    if (!byId.has(listObj.id)) byId.set(listObj.id, listObj);
  }
  const listRows = Array.from(byId.values()).sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
  if (listRows.length === 0) return [];

  const listIds = listRows.map((r) => r.id);
  const [itemsRes, compsRes] = await Promise.all([
    supabase
      .from('items')
      .select('*')
      .in('list_id', listIds)
      .order('position', { ascending: true }),
    supabase
      .from('comparisons')
      .select('*')
      .in('list_id', listIds)
      .order('created_at', { ascending: true }),
  ]);
  if (itemsRes.error) throw itemsRes.error;
  if (compsRes.error) throw compsRes.error;

  const itemsByList = new Map<string, Item[]>();
  for (const row of (itemsRes.data ?? []) as ItemRow[]) {
    const arr = itemsByList.get(row.list_id) ?? [];
    arr.push(itemFromRow(row));
    itemsByList.set(row.list_id, arr);
  }
  const compsByList = new Map<string, Comparison[]>();
  for (const row of (compsRes.data ?? []) as ComparisonRow[]) {
    const arr = compsByList.get(row.list_id) ?? [];
    arr.push(comparisonFromRow(row));
    compsByList.set(row.list_id, arr);
  }

  return listRows.map((r) =>
    listFromRow(
      r,
      itemsByList.get(r.id) ?? [],
      compsByList.get(r.id) ?? [],
    ),
  );
}

/** Fetch one shared list by id (+ items + all visible comparisons). Returns null if not visible. */
export async function fetchListById(listId: string): Promise<RankList | null> {
  const supabase = getBrowserClient();
  const { data: listRow, error } = await supabase
    .from('lists')
    .select('*')
    .eq('id', listId)
    .maybeSingle();
  if (error) throw error;
  if (!listRow) return null;

  const [itemsRes, compsRes] = await Promise.all([
    supabase
      .from('items')
      .select('*')
      .eq('list_id', listId)
      .order('position', { ascending: true }),
    supabase
      .from('comparisons')
      .select('*')
      .eq('list_id', listId)
      .order('created_at', { ascending: true }),
  ]);
  if (itemsRes.error) throw itemsRes.error;
  if (compsRes.error) throw compsRes.error;

  return listFromRow(
    listRow as ListRow,
    ((itemsRes.data ?? []) as ItemRow[]).map(itemFromRow),
    ((compsRes.data ?? []) as ComparisonRow[]).map(comparisonFromRow),
  );
}

/** Insert a membership row for the current user (idempotent — ignores duplicates). */
export async function joinList(listId: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Not authenticated.');
  const supabase = getBrowserClient();
  const { error } = await supabase
    .from('list_members')
    .upsert({ list_id: listId, user_id: userId, role: 'voter' }, { onConflict: 'list_id,user_id' });
  if (error) throw error;
}

export type ListMember = {
  userId: string;
  role: string;
  joinedAt: number;
};

type ListMemberRow = {
  user_id: string;
  role: string;
  joined_at: string;
};

export async function fetchListMembers(listId: string): Promise<ListMember[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from('list_members')
    .select('user_id, role, joined_at')
    .eq('list_id', listId)
    .order('joined_at', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as ListMemberRow[]).map((r) => ({
    userId: r.user_id,
    role: r.role,
    joinedAt: new Date(r.joined_at).getTime(),
  }));
}

export async function removeListMember(
  listId: string,
  userId: string,
): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase
    .from('list_members')
    .delete()
    .eq('list_id', listId)
    .eq('user_id', userId);
  if (error) throw error;
}

/** Current user leaves the list. */
export async function leaveList(listId: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Not authenticated.');
  await removeListMember(listId, userId);
}

// ---------- Lists ----------

export async function insertList(list: RankList): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Not authenticated.');
  const supabase = getBrowserClient();

  const { error } = await supabase.from('lists').insert({
    id: list.id,
    owner_id: userId,
    title: list.title,
    description: list.description ?? null,
    tags: list.tags ?? [],
    visibility: list.visibility ?? 'private',
    algorithm_default: list.algorithmDefault,
    tier_assignments: list.tierAssignments,
    direct_ratings: list.directRatings,
    bracket: list.bracket,
  });
  if (error) throw error;

  if (list.items.length > 0) {
    const { error: itemsErr } = await supabase
      .from('items')
      .insert(list.items.map((it, i) => itemInsert(it, list.id, i)));
    if (itemsErr) throw itemsErr;
  }
  if (list.comparisons.length > 0) {
    const { error: compsErr } = await supabase
      .from('comparisons')
      .insert(
        list.comparisons.map((c) => ({
          id: c.id,
          list_id: list.id,
          voter_id: userId,
          winner_id: c.winnerId,
          loser_id: c.loserId,
          skipped: c.skipped ?? false,
        })),
      );
    if (compsErr) throw compsErr;
  }
}

export async function updateListFields(
  listId: string,
  patch: Partial<
    Pick<
      RankList,
      'title' | 'description' | 'tags' | 'algorithmDefault' | 'visibility' | 'phase'
    >
  >,
): Promise<void> {
  const supabase = getBrowserClient();
  const update: Record<string, unknown> = {};
  if ('title' in patch) update.title = patch.title;
  if ('description' in patch) update.description = patch.description ?? null;
  if ('tags' in patch) update.tags = patch.tags ?? [];
  if ('algorithmDefault' in patch) update.algorithm_default = patch.algorithmDefault;
  if ('visibility' in patch) update.visibility = patch.visibility;
  if ('phase' in patch) update.phase = patch.phase;
  const { error } = await supabase.from('lists').update(update).eq('id', listId);
  if (error) throw error;
}

export async function updateListPhase(listId: string, phase: Phase): Promise<void> {
  return updateListFields(listId, { phase });
}

export type ItemCountRow = { userId: string; count: number };

export async function fetchItemCounts(listId: string): Promise<ItemCountRow[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc('list_item_counts', {
    p_list_id: listId,
  });
  if (error) throw error;
  type Row = { user_id: string; item_count: number };
  return ((data ?? []) as Row[]).map((r) => ({
    userId: r.user_id,
    count: Number(r.item_count),
  }));
}

export async function deleteList(listId: string): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase.from('lists').delete().eq('id', listId);
  if (error) throw error;
}

export async function archiveList(listId: string): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase
    .from('lists')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', listId);
  if (error) throw error;
}

export async function restoreList(listId: string): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase
    .from('lists')
    .update({ archived_at: null })
    .eq('id', listId);
  if (error) throw error;
}

export async function updateTierAssignments(
  listId: string,
  tierAssignments: Record<string, Tier>,
): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase
    .from('lists')
    .update({ tier_assignments: tierAssignments })
    .eq('id', listId);
  if (error) throw error;
}

export async function updateDirectRatings(
  listId: string,
  directRatings: Record<string, number>,
): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase
    .from('lists')
    .update({ direct_ratings: directRatings })
    .eq('id', listId);
  if (error) throw error;
}

export async function updateBracket(
  listId: string,
  bracket: Bracket | null,
): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase
    .from('lists')
    .update({ bracket })
    .eq('id', listId);
  if (error) throw error;
}

export async function updateAlgorithm(
  listId: string,
  algorithm: Algorithm,
): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase
    .from('lists')
    .update({ algorithm_default: algorithm })
    .eq('id', listId);
  if (error) throw error;
}

// ---------- Items ----------

export async function insertItem(
  listId: string,
  item: Item,
  position: number,
): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase.from('items').insert(itemInsert(item, listId, position));
  if (error) throw error;
}

export async function patchItem(
  itemId: string,
  patch: Partial<Omit<Item, 'id'>>,
): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase.from('items').update(itemUpdate(patch)).eq('id', itemId);
  if (error) throw error;
}

export async function deleteItem(itemId: string): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase.from('items').delete().eq('id', itemId);
  if (error) throw error;
}

// ---------- Profiles ----------

export type Profile = {
  userId: string;
  handle: string | null;
  displayName: string | null;
};

type ProfileRow = {
  user_id: string;
  handle: string | null;
  display_name: string | null;
};

export async function fetchProfiles(userIds: string[]): Promise<Profile[]> {
  if (userIds.length === 0) return [];
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, handle, display_name')
    .in('user_id', userIds);
  if (error) throw error;
  return (data ?? []).map((r) => {
    const row = r as ProfileRow;
    return { userId: row.user_id, handle: row.handle, displayName: row.display_name };
  });
}

export async function fetchCurrentProfile(): Promise<Profile | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const [profile] = await fetchProfiles([userId]);
  return profile ?? { userId, handle: null, displayName: null };
}

export async function updateCurrentProfile(patch: {
  handle?: string | null;
  displayName?: string | null;
}): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Not authenticated.');
  const supabase = getBrowserClient();
  const update: Record<string, unknown> = {};
  if ('handle' in patch) update.handle = patch.handle;
  if ('displayName' in patch) update.display_name = patch.displayName;
  const { error } = await supabase
    .from('profiles')
    .update(update)
    .eq('user_id', userId);
  if (error) throw error;
}

// ---------- Admin ----------

export type AdminUserRow = {
  userId: string;
  email: string;
  handle: string | null;
  displayName: string | null;
  isAdmin: boolean;
  ownedCount: number;
  memberCount: number;
  createdAt: number;
};

export type AdminUserDetail = {
  userId: string;
  email: string;
  handle: string | null;
  displayName: string | null;
  isAdmin: boolean;
  createdAt: number;
};

export type AdminUserListAccess = {
  listId: string;
  title: string;
  visibility: string;
  relationship: 'owner' | 'member';
};

export type AdminJoinableList = {
  listId: string;
  title: string;
  visibility: string;
};

export async function isCurrentUserAdmin(): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) return false;
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return false;
  return Boolean((data as { is_admin?: boolean } | null)?.is_admin);
}

export async function adminListUsers(): Promise<AdminUserRow[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc('admin_list_users');
  if (error) throw error;
  type Row = {
    user_id: string;
    email: string;
    handle: string | null;
    display_name: string | null;
    is_admin: boolean;
    owned_count: number;
    member_count: number;
    created_at: string;
  };
  return ((data ?? []) as Row[]).map((r) => ({
    userId: r.user_id,
    email: r.email,
    handle: r.handle,
    displayName: r.display_name,
    isAdmin: r.is_admin,
    ownedCount: Number(r.owned_count),
    memberCount: Number(r.member_count),
    createdAt: new Date(r.created_at).getTime(),
  }));
}

export async function adminGetUser(
  userId: string,
): Promise<AdminUserDetail | null> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc('admin_get_user', {
    p_user_id: userId,
  });
  if (error) throw error;
  const rows = data as Array<{
    user_id: string;
    email: string;
    handle: string | null;
    display_name: string | null;
    is_admin: boolean;
    created_at: string;
  }> | null;
  if (!rows || rows.length === 0) return null;
  const r = rows[0];
  return {
    userId: r.user_id,
    email: r.email,
    handle: r.handle,
    displayName: r.display_name,
    isAdmin: r.is_admin,
    createdAt: new Date(r.created_at).getTime(),
  };
}

export async function adminUpdateUser(
  userId: string,
  patch: {
    handle?: string | null;
    displayName?: string | null;
    isAdmin?: boolean;
  },
): Promise<void> {
  const supabase = getBrowserClient();
  const update: Record<string, unknown> = {};
  if ('handle' in patch) update.handle = patch.handle;
  if ('displayName' in patch) update.display_name = patch.displayName;
  if ('isAdmin' in patch) update.is_admin = patch.isAdmin;
  const { error } = await supabase
    .from('profiles')
    .update(update)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function adminFetchUserListAccess(
  userId: string,
): Promise<AdminUserListAccess[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc('admin_user_list_access', {
    p_user_id: userId,
  });
  if (error) throw error;
  type Row = {
    list_id: string;
    title: string;
    visibility: string;
    relationship: 'owner' | 'member';
  };
  return ((data ?? []) as Row[]).map((r) => ({
    listId: r.list_id,
    title: r.title,
    visibility: r.visibility,
    relationship: r.relationship,
  }));
}

export async function adminFetchJoinableLists(
  userId: string,
): Promise<AdminJoinableList[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc('admin_lists_user_can_join', {
    p_user_id: userId,
  });
  if (error) throw error;
  type Row = { list_id: string; title: string; visibility: string };
  return ((data ?? []) as Row[]).map((r) => ({
    listId: r.list_id,
    title: r.title,
    visibility: r.visibility,
  }));
}

export async function adminAddUserToList(
  listId: string,
  userId: string,
): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase
    .from('list_members')
    .insert({ list_id: listId, user_id: userId, role: 'voter' });
  if (error) throw error;
}

// ---------- Comparisons ----------

export async function insertComparison(
  listId: string,
  c: Comparison,
): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Not authenticated.');
  const supabase = getBrowserClient();
  // Unique constraint: (list_id, voter_id, unordered(winner, loser)) where
  // skipped=false. Postgres can't UPSERT on a partial expression index, so
  // we delete any existing non-skipped match for this pair first, then insert.
  if (!c.skipped) {
    const { error: delError } = await supabase
      .from('comparisons')
      .delete()
      .eq('list_id', listId)
      .eq('voter_id', userId)
      .eq('skipped', false)
      .in('winner_id', [c.winnerId, c.loserId])
      .in('loser_id', [c.winnerId, c.loserId]);
    if (delError) throw delError;
  }
  const { error } = await supabase.from('comparisons').insert({
    id: c.id,
    list_id: listId,
    voter_id: userId,
    winner_id: c.winnerId,
    loser_id: c.loserId,
    skipped: c.skipped ?? false,
  });
  if (error) throw error;
}

export async function deleteComparison(comparisonId: string): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase.from('comparisons').delete().eq('id', comparisonId);
  if (error) throw error;
}
