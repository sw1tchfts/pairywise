'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Algorithm, Comparison, Item, RankList } from './types';
import { uid } from './utils';

type State = {
  lists: Record<string, RankList>;
  order: string[];
};

type Actions = {
  createList: (input: { title: string; description?: string; tags?: string[] }) => string;
  deleteList: (id: string) => void;
  duplicateList: (id: string) => string | null;
  updateList: (id: string, patch: Partial<Pick<RankList, 'title' | 'description' | 'tags' | 'algorithmDefault'>>) => void;
  addItem: (listId: string, item: Omit<Item, 'id'>) => string;
  removeItem: (listId: string, itemId: string) => void;
  recordComparison: (listId: string, winnerId: string, loserId: string) => void;
  skipPair: (listId: string, aId: string, bId: string) => void;
  undoLastComparison: (listId: string) => Comparison | null;
  setAlgorithmDefault: (listId: string, algo: Algorithm) => void;
};

export const useStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      lists: {},
      order: [],

      createList: ({ title, description, tags }) => {
        const id = uid();
        const now = Date.now();
        set((s) => ({
          lists: {
            ...s.lists,
            [id]: {
              id,
              title,
              description,
              tags: tags ?? [],
              items: [],
              comparisons: [],
              algorithmDefault: 'elo',
              createdAt: now,
              updatedAt: now,
            },
          },
          order: [id, ...s.order],
        }));
        return id;
      },

      deleteList: (id) =>
        set((s) => {
          const rest = { ...s.lists };
          delete rest[id];
          return { lists: rest, order: s.order.filter((x) => x !== id) };
        }),

      duplicateList: (id) => {
        const src = get().lists[id];
        if (!src) return null;
        const newId = uid();
        const now = Date.now();
        set((s) => ({
          lists: {
            ...s.lists,
            [newId]: {
              ...src,
              id: newId,
              title: `${src.title} (copy)`,
              comparisons: [],
              createdAt: now,
              updatedAt: now,
            },
          },
          order: [newId, ...s.order],
        }));
        return newId;
      },

      updateList: (id, patch) =>
        set((s) => {
          const list = s.lists[id];
          if (!list) return s;
          return {
            lists: {
              ...s.lists,
              [id]: { ...list, ...patch, updatedAt: Date.now() },
            },
          };
        }),

      addItem: (listId, item) => {
        const itemId = uid();
        set((s) => {
          const list = s.lists[listId];
          if (!list) return s;
          return {
            lists: {
              ...s.lists,
              [listId]: {
                ...list,
                items: [...list.items, { ...item, id: itemId }],
                updatedAt: Date.now(),
              },
            },
          };
        });
        return itemId;
      },

      removeItem: (listId, itemId) =>
        set((s) => {
          const list = s.lists[listId];
          if (!list) return s;
          return {
            lists: {
              ...s.lists,
              [listId]: {
                ...list,
                items: list.items.filter((i) => i.id !== itemId),
                comparisons: list.comparisons.filter(
                  (c) => c.winnerId !== itemId && c.loserId !== itemId,
                ),
                updatedAt: Date.now(),
              },
            },
          };
        }),

      recordComparison: (listId, winnerId, loserId) =>
        set((s) => {
          const list = s.lists[listId];
          if (!list) return s;
          const c: Comparison = {
            id: uid(),
            winnerId,
            loserId,
            createdAt: Date.now(),
          };
          return {
            lists: {
              ...s.lists,
              [listId]: {
                ...list,
                comparisons: [...list.comparisons, c],
                updatedAt: Date.now(),
              },
            },
          };
        }),

      skipPair: (listId, aId, bId) =>
        set((s) => {
          const list = s.lists[listId];
          if (!list) return s;
          const c: Comparison = {
            id: uid(),
            winnerId: aId,
            loserId: bId,
            skipped: true,
            createdAt: Date.now(),
          };
          return {
            lists: {
              ...s.lists,
              [listId]: {
                ...list,
                comparisons: [...list.comparisons, c],
                updatedAt: Date.now(),
              },
            },
          };
        }),

      undoLastComparison: (listId) => {
        const list = get().lists[listId];
        if (!list || list.comparisons.length === 0) return null;
        const last = list.comparisons[list.comparisons.length - 1];
        set((s) => ({
          lists: {
            ...s.lists,
            [listId]: {
              ...list,
              comparisons: list.comparisons.slice(0, -1),
              updatedAt: Date.now(),
            },
          },
        }));
        return last;
      },

      setAlgorithmDefault: (listId, algo) =>
        set((s) => {
          const list = s.lists[listId];
          if (!list) return s;
          return {
            lists: {
              ...s.lists,
              [listId]: { ...list, algorithmDefault: algo, updatedAt: Date.now() },
            },
          };
        }),
    }),
    {
      name: 'pairywise-store',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);

export function selectList(id: string) {
  return (s: State) => s.lists[id];
}
