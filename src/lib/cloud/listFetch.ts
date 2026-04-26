import type { SupabaseClient } from '@supabase/supabase-js';
import type { Comparison, Item, RankList } from '../types';
import {
  comparisonFromRow,
  itemFromRow,
  listFromRow,
  type ComparisonRow,
  type ItemRow,
  type ListRow,
} from './mappers';

/**
 * Fetch lists owned by, or shared with, `userId`. Works with either the
 * browser Supabase client or the server one — both inherit RLS.
 *
 * Pulled out of api.ts (which is `'use client'`) so server components can
 * call it from layouts / pages and pre-render the user's lists.
 */
export async function fetchAllListsWith(
  supabase: SupabaseClient,
  userId: string,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<RankList[]> {
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
