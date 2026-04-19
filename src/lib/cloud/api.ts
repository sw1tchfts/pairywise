'use client';

import type {
  Algorithm,
  Bracket,
  Comparison,
  Item,
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

/** Fetch lists owned by the current user or that they're a member of. */
export async function fetchAllLists(): Promise<RankList[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const supabase = getBrowserClient();

  const [ownRes, memberRes] = await Promise.all([
    supabase
      .from('lists')
      .select('*')
      .eq('owner_id', userId)
      .order('updated_at', { ascending: false }),
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
    if (listObj && !byId.has(listObj.id)) byId.set(listObj.id, listObj);
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
  patch: Partial<Pick<RankList, 'title' | 'description' | 'tags' | 'algorithmDefault' | 'visibility'>>,
): Promise<void> {
  const supabase = getBrowserClient();
  const update: Record<string, unknown> = {};
  if ('title' in patch) update.title = patch.title;
  if ('description' in patch) update.description = patch.description ?? null;
  if ('tags' in patch) update.tags = patch.tags ?? [];
  if ('algorithmDefault' in patch) update.algorithm_default = patch.algorithmDefault;
  if ('visibility' in patch) update.visibility = patch.visibility;
  const { error } = await supabase.from('lists').update(update).eq('id', listId);
  if (error) throw error;
}

export async function deleteList(listId: string): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase.from('lists').delete().eq('id', listId);
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

// ---------- Comparisons ----------

export async function insertComparison(
  listId: string,
  c: Comparison,
): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Not authenticated.');
  const supabase = getBrowserClient();
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
