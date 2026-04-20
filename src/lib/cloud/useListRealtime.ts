'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { getBrowserClient, isCloudEnabled } from '@/lib/supabase/browser';
import { comparisonFromRow, type ComparisonRow } from './mappers';
import type { Comparison } from '@/lib/types';

/**
 * Subscribe to realtime INSERT/DELETE events on comparisons for one list
 * and merge them into the local store, so votes from other users appear
 * live. Own votes dedupe by comparison id.
 */
export function useListRealtime(listId: string | undefined) {
  useEffect(() => {
    if (!listId || !isCloudEnabled()) return;
    const supabase = getBrowserClient();
    const channel = supabase
      .channel(`list:${listId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comparisons',
          filter: `list_id=eq.${listId}`,
        },
        (payload) => {
          const row = payload.new as ComparisonRow;
          const comparison = comparisonFromRow(row);
          useStore.setState((state) => {
            const list = state.lists[listId];
            if (!list) return state;
            if (list.comparisons.some((c) => c.id === comparison.id)) return state;
            return {
              lists: {
                ...state.lists,
                [listId]: {
                  ...list,
                  comparisons: [...list.comparisons, comparison],
                },
              },
            };
          });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'comparisons',
          filter: `list_id=eq.${listId}`,
        },
        (payload) => {
          const oldId = (payload.old as Partial<Comparison>).id;
          if (!oldId) return;
          useStore.setState((state) => {
            const list = state.lists[listId];
            if (!list) return state;
            return {
              lists: {
                ...state.lists,
                [listId]: {
                  ...list,
                  comparisons: list.comparisons.filter((c) => c.id !== oldId),
                },
              },
            };
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [listId]);
}
