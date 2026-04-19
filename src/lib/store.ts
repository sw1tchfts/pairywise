'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  Algorithm,
  Bracket,
  BracketMatch,
  Comparison,
  Item,
  RankList,
  Tier,
} from './types';
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
  updateItem: (listId: string, itemId: string, patch: Partial<Omit<Item, 'id'>>) => void;
  removeItem: (listId: string, itemId: string) => void;
  recordComparison: (listId: string, winnerId: string, loserId: string) => void;
  skipPair: (listId: string, aId: string, bId: string) => void;
  undoLastComparison: (listId: string) => Comparison | null;
  setAlgorithmDefault: (listId: string, algo: Algorithm) => void;
  importList: (list: RankList) => string;
  setTier: (listId: string, itemId: string, tier: Tier | null) => void;
  clearTiers: (listId: string) => void;
  setDirectRating: (listId: string, itemId: string, rating: number) => void;
  clearDirectRatings: (listId: string) => void;
  initBracket: (listId: string, seed?: string[]) => void;
  advanceBracketMatch: (listId: string, matchId: string, winnerId: string) => void;
  resetBracket: (listId: string) => void;
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
              tierAssignments: {},
              directRatings: {},
              bracket: null,
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

      updateItem: (listId, itemId, patch) =>
        set((s) => {
          const list = s.lists[listId];
          if (!list) return s;
          return {
            lists: {
              ...s.lists,
              [listId]: {
                ...list,
                items: list.items.map((i) =>
                  i.id === itemId ? { ...i, ...patch } : i,
                ),
                updatedAt: Date.now(),
              },
            },
          };
        }),

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

      setTier: (listId, itemId, tier) =>
        set((s) => {
          const list = s.lists[listId];
          if (!list) return s;
          const next = { ...(list.tierAssignments ?? {}) };
          if (tier === null) delete next[itemId];
          else next[itemId] = tier;
          return {
            lists: {
              ...s.lists,
              [listId]: { ...list, tierAssignments: next, updatedAt: Date.now() },
            },
          };
        }),

      clearTiers: (listId) =>
        set((s) => {
          const list = s.lists[listId];
          if (!list) return s;
          return {
            lists: {
              ...s.lists,
              [listId]: { ...list, tierAssignments: {}, updatedAt: Date.now() },
            },
          };
        }),

      setDirectRating: (listId, itemId, rating) =>
        set((s) => {
          const list = s.lists[listId];
          if (!list) return s;
          const clamped = Math.max(1, Math.min(10, Math.round(rating)));
          const next = { ...(list.directRatings ?? {}), [itemId]: clamped };
          return {
            lists: {
              ...s.lists,
              [listId]: { ...list, directRatings: next, updatedAt: Date.now() },
            },
          };
        }),

      clearDirectRatings: (listId) =>
        set((s) => {
          const list = s.lists[listId];
          if (!list) return s;
          return {
            lists: {
              ...s.lists,
              [listId]: { ...list, directRatings: {}, updatedAt: Date.now() },
            },
          };
        }),

      initBracket: (listId, customSeed) =>
        set((s) => {
          const list = s.lists[listId];
          if (!list || list.items.length < 2) return s;
          const seed =
            customSeed && customSeed.length > 0
              ? customSeed.slice()
              : shuffle(list.items.map((i) => i.id));
          const bracket = buildBracket(seed);
          return {
            lists: {
              ...s.lists,
              [listId]: { ...list, bracket, updatedAt: Date.now() },
            },
          };
        }),

      advanceBracketMatch: (listId, matchId, winnerId) =>
        set((s) => {
          const list = s.lists[listId];
          if (!list?.bracket) return s;
          const br = {
            ...list.bracket,
            matches: list.bracket.matches.map((m) => ({ ...m })),
          };
          const match = br.matches.find((m) => m.id === matchId);
          if (!match) return s;
          if (match.aId !== winnerId && match.bId !== winnerId) return s;
          match.winnerId = winnerId;

          // Propagate to next round.
          const nextRound = match.round + 1;
          const indexInRound = Math.floor(
            br.matches.findIndex((m) => m.id === matchId) -
              firstIndexOfRound(br.matches, match.round),
          );
          const nextMatchIndex = Math.floor(indexInRound / 2);
          const next = br.matches.find(
            (m, i) =>
              m.round === nextRound &&
              i - firstIndexOfRound(br.matches, nextRound) === nextMatchIndex,
          );
          if (next) {
            if (indexInRound % 2 === 0) next.aId = winnerId;
            else next.bId = winnerId;
            // Autoadvance byes.
            if (next.aId && !next.bId && hasNoFutureOpponent(br, next)) {
              next.winnerId = next.aId;
            }
          }

          const final = br.matches[br.matches.length - 1];
          const championId = final?.winnerId ?? null;

          return {
            lists: {
              ...s.lists,
              [listId]: {
                ...list,
                bracket: { ...br, championId },
                updatedAt: Date.now(),
              },
            },
          };
        }),

      resetBracket: (listId) =>
        set((s) => {
          const list = s.lists[listId];
          if (!list) return s;
          return {
            lists: {
              ...s.lists,
              [listId]: { ...list, bracket: null, updatedAt: Date.now() },
            },
          };
        }),

      importList: (src) => {
        const newListId = uid();
        const now = Date.now();
        const idMap = new Map<string, string>();
        const items: Item[] = src.items.map((item) => {
          const newId = uid();
          idMap.set(item.id, newId);
          return { ...item, id: newId };
        });
        const comparisons: Comparison[] = src.comparisons
          .map((c) => {
            const w = idMap.get(c.winnerId);
            const l = idMap.get(c.loserId);
            if (!w || !l) return null;
            return { ...c, id: uid(), winnerId: w, loserId: l };
          })
          .filter((x): x is Comparison => x !== null);
        set((s) => ({
          lists: {
            ...s.lists,
            [newListId]: {
              ...src,
              id: newListId,
              title: src.title,
              items,
              comparisons,
              createdAt: now,
              updatedAt: now,
            },
          },
          order: [newListId, ...s.order],
        }));
        return newListId;
      },
    }),
    {
      name: 'pairywise-store',
      storage: createJSONStorage(() => localStorage),
      version: 3,
      migrate: (persisted, fromVersion) => {
        const state = persisted as State | undefined;
        if (!state || !state.lists) return state ?? { lists: {}, order: [] };
        if (fromVersion < 2) {
          // v1 used `label` instead of `title`; copy it forward for backward compat.
          for (const list of Object.values(state.lists)) {
            for (const item of list.items as Array<Item & { label?: string }>) {
              if (!item.title && item.label) item.title = item.label;
              if (!item.tags) item.tags = [];
            }
          }
        }
        if (fromVersion < 3) {
          for (const list of Object.values(state.lists)) {
            if (!list.tierAssignments) list.tierAssignments = {};
            if (!list.directRatings) list.directRatings = {};
            if (list.bracket === undefined) list.bracket = null;
          }
        }
        return state;
      },
    },
  ),
);

export function selectList(id: string) {
  return (s: State) => s.lists[id];
}

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function buildBracket(seed: string[]): Bracket {
  const n = seed.length;
  // Pad to next power of two with nulls (byes)
  const size = 1 << Math.ceil(Math.log2(Math.max(2, n)));
  const padded: (string | null)[] = seed.slice();
  while (padded.length < size) padded.push(null);
  const matches: BracketMatch[] = [];
  let round = 0;
  let pairs: (string | null)[] = padded;
  while (pairs.length > 1) {
    const next: (string | null)[] = [];
    for (let i = 0; i < pairs.length; i += 2) {
      const a = pairs[i];
      const b = pairs[i + 1];
      const match: BracketMatch = {
        id: uid(),
        round,
        aId: a,
        bId: b,
        winnerId: null,
      };
      // Auto-advance byes in round 0.
      if (round === 0) {
        if (a && !b) match.winnerId = a;
        else if (!a && b) match.winnerId = b;
      }
      matches.push(match);
      next.push(match.winnerId);
    }
    pairs = next;
    round++;
  }
  return { seed, matches, championId: null };
}

function firstIndexOfRound(matches: BracketMatch[], round: number) {
  return matches.findIndex((m) => m.round === round);
}

function hasNoFutureOpponent(bracket: Bracket, match: BracketMatch) {
  // For byes in later rounds we don't auto-advance — only round 0 has real byes.
  void bracket;
  return match.round === 0;
}
