'use client';

import { create } from 'zustand';
import type {
  Algorithm,
  Bracket,
  BracketMatch,
  Comparison,
  Item,
  RankList,
  Tier,
  Visibility,
} from './types';
import { uid } from './utils';
import * as api from './cloud/api';

type State = {
  lists: Record<string, RankList>;
  order: string[];
  hydrated: boolean;
  hydrating: boolean;
  hydrateError: string | null;
};

type Actions = {
  hydrate: () => Promise<void>;
  reset: () => void;
  createList: (input: {
    title: string;
    description?: string;
    tags?: string[];
    visibility?: Visibility;
  }) => string;
  deleteList: (id: string) => void;
  duplicateList: (id: string) => string | null;
  updateList: (
    id: string,
    patch: Partial<
      Pick<RankList, 'title' | 'description' | 'tags' | 'algorithmDefault' | 'visibility'>
    >,
  ) => void;
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

function reportCloudError(scope: string, err: unknown) {
  console.error(`[cloud] ${scope} failed:`, err);
}

export const useStore = create<State & Actions>()((set, get) => ({
  lists: {},
  order: [],
  hydrated: false,
  hydrating: false,
  hydrateError: null,

  hydrate: async () => {
    if (get().hydrating) return;
    set({ hydrating: true, hydrateError: null });
    try {
      const lists = await api.fetchAllLists();
      const map: Record<string, RankList> = {};
      const order: string[] = [];
      for (const l of lists) {
        map[l.id] = l;
        order.push(l.id);
      }
      set({ lists: map, order, hydrated: true, hydrating: false });
    } catch (err) {
      set({
        hydrating: false,
        hydrateError: err instanceof Error ? err.message : 'Failed to load lists.',
      });
      reportCloudError('hydrate', err);
    }
  },

  reset: () => set({ lists: {}, order: [], hydrated: false, hydrating: false, hydrateError: null }),

  createList: ({ title, description, tags, visibility }) => {
    const id = uid();
    const now = Date.now();
    const list: RankList = {
      id,
      title,
      description,
      tags: tags ?? [],
      visibility: visibility ?? 'private',
      items: [],
      comparisons: [],
      algorithmDefault: 'elo',
      tierAssignments: {},
      directRatings: {},
      bracket: null,
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({
      lists: { ...s.lists, [id]: list },
      order: [id, ...s.order],
    }));
    api.insertList(list).catch((e) => reportCloudError('createList', e));
    return id;
  },

  deleteList: (id) => {
    set((s) => {
      const rest = { ...s.lists };
      delete rest[id];
      return { lists: rest, order: s.order.filter((x) => x !== id) };
    });
    api.deleteList(id).catch((e) => reportCloudError('deleteList', e));
  },

  duplicateList: (id) => {
    const src = get().lists[id];
    if (!src) return null;
    const newListId = uid();
    const now = Date.now();
    const idMap = new Map<string, string>();
    const items: Item[] = src.items.map((item) => {
      const newId = uid();
      idMap.set(item.id, newId);
      return { ...item, id: newId };
    });
    const copy: RankList = {
      ...src,
      id: newListId,
      title: `${src.title} (copy)`,
      items,
      comparisons: [],
      tierAssignments: Object.fromEntries(
        Object.entries(src.tierAssignments).flatMap(([k, v]) => {
          const mapped = idMap.get(k);
          return mapped ? [[mapped, v]] : [];
        }),
      ),
      directRatings: Object.fromEntries(
        Object.entries(src.directRatings).flatMap(([k, v]) => {
          const mapped = idMap.get(k);
          return mapped ? [[mapped, v]] : [];
        }),
      ),
      bracket: null,
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({
      lists: { ...s.lists, [newListId]: copy },
      order: [newListId, ...s.order],
    }));
    api.insertList(copy).catch((e) => reportCloudError('duplicateList', e));
    return newListId;
  },

  updateList: (id, patch) => {
    set((s) => {
      const list = s.lists[id];
      if (!list) return s;
      return {
        lists: {
          ...s.lists,
          [id]: { ...list, ...patch, updatedAt: Date.now() },
        },
      };
    });
    api.updateListFields(id, patch).catch((e) => reportCloudError('updateList', e));
  },

  addItem: (listId, item) => {
    const itemId = uid();
    let position = 0;
    set((s) => {
      const list = s.lists[listId];
      if (!list) return s;
      position = list.items.length;
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
    api
      .insertItem(listId, { ...item, id: itemId }, position)
      .catch((e) => reportCloudError('addItem', e));
    return itemId;
  },

  updateItem: (listId, itemId, patch) => {
    set((s) => {
      const list = s.lists[listId];
      if (!list) return s;
      return {
        lists: {
          ...s.lists,
          [listId]: {
            ...list,
            items: list.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
            updatedAt: Date.now(),
          },
        },
      };
    });
    api.patchItem(itemId, patch).catch((e) => reportCloudError('updateItem', e));
  },

  removeItem: (listId, itemId) => {
    set((s) => {
      const list = s.lists[listId];
      if (!list) return s;
      const nextTier = { ...list.tierAssignments };
      delete nextTier[itemId];
      const nextRatings = { ...list.directRatings };
      delete nextRatings[itemId];
      return {
        lists: {
          ...s.lists,
          [listId]: {
            ...list,
            items: list.items.filter((i) => i.id !== itemId),
            comparisons: list.comparisons.filter(
              (c) => c.winnerId !== itemId && c.loserId !== itemId,
            ),
            tierAssignments: nextTier,
            directRatings: nextRatings,
            updatedAt: Date.now(),
          },
        },
      };
    });
    // `items` has ON DELETE CASCADE on comparisons referencing it, so a single
    // delete cascades. tierAssignments / directRatings live on the list row
    // (jsonb) and need explicit updates.
    api.deleteItem(itemId).catch((e) => reportCloudError('removeItem', e));
    const fresh = get().lists[listId];
    if (fresh) {
      api
        .updateTierAssignments(listId, fresh.tierAssignments)
        .catch((e) => reportCloudError('removeItem/tier', e));
      api
        .updateDirectRatings(listId, fresh.directRatings)
        .catch((e) => reportCloudError('removeItem/rate', e));
    }
  },

  recordComparison: (listId, winnerId, loserId) => {
    const c: Comparison = { id: uid(), winnerId, loserId, createdAt: Date.now() };
    set((s) => {
      const list = s.lists[listId];
      if (!list) return s;
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
    });
    api.insertComparison(listId, c).catch((e) => reportCloudError('recordComparison', e));
  },

  skipPair: (listId, aId, bId) => {
    const c: Comparison = {
      id: uid(),
      winnerId: aId,
      loserId: bId,
      skipped: true,
      createdAt: Date.now(),
    };
    set((s) => {
      const list = s.lists[listId];
      if (!list) return s;
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
    });
    api.insertComparison(listId, c).catch((e) => reportCloudError('skipPair', e));
  },

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
    api.deleteComparison(last.id).catch((e) => reportCloudError('undoLastComparison', e));
    return last;
  },

  setAlgorithmDefault: (listId, algo) => {
    set((s) => {
      const list = s.lists[listId];
      if (!list) return s;
      return {
        lists: {
          ...s.lists,
          [listId]: { ...list, algorithmDefault: algo, updatedAt: Date.now() },
        },
      };
    });
    api.updateAlgorithm(listId, algo).catch((e) => reportCloudError('setAlgorithmDefault', e));
  },

  setTier: (listId, itemId, tier) => {
    let next: Record<string, Tier> = {};
    set((s) => {
      const list = s.lists[listId];
      if (!list) return s;
      next = { ...list.tierAssignments };
      if (tier === null) delete next[itemId];
      else next[itemId] = tier;
      return {
        lists: {
          ...s.lists,
          [listId]: { ...list, tierAssignments: next, updatedAt: Date.now() },
        },
      };
    });
    api.updateTierAssignments(listId, next).catch((e) => reportCloudError('setTier', e));
  },

  clearTiers: (listId) => {
    set((s) => {
      const list = s.lists[listId];
      if (!list) return s;
      return {
        lists: {
          ...s.lists,
          [listId]: { ...list, tierAssignments: {}, updatedAt: Date.now() },
        },
      };
    });
    api.updateTierAssignments(listId, {}).catch((e) => reportCloudError('clearTiers', e));
  },

  setDirectRating: (listId, itemId, rating) => {
    let next: Record<string, number> = {};
    set((s) => {
      const list = s.lists[listId];
      if (!list) return s;
      const clamped = Math.max(1, Math.min(10, Math.round(rating)));
      next = { ...list.directRatings, [itemId]: clamped };
      return {
        lists: {
          ...s.lists,
          [listId]: { ...list, directRatings: next, updatedAt: Date.now() },
        },
      };
    });
    api.updateDirectRatings(listId, next).catch((e) => reportCloudError('setDirectRating', e));
  },

  clearDirectRatings: (listId) => {
    set((s) => {
      const list = s.lists[listId];
      if (!list) return s;
      return {
        lists: {
          ...s.lists,
          [listId]: { ...list, directRatings: {}, updatedAt: Date.now() },
        },
      };
    });
    api.updateDirectRatings(listId, {}).catch((e) => reportCloudError('clearDirectRatings', e));
  },

  initBracket: (listId, customSeed) => {
    let newBracket: Bracket | null = null;
    set((s) => {
      const list = s.lists[listId];
      if (!list || list.items.length < 2) return s;
      const seed =
        customSeed && customSeed.length > 0
          ? customSeed.slice()
          : shuffle(list.items.map((i) => i.id));
      newBracket = buildBracket(seed);
      return {
        lists: {
          ...s.lists,
          [listId]: { ...list, bracket: newBracket, updatedAt: Date.now() },
        },
      };
    });
    if (newBracket) {
      api.updateBracket(listId, newBracket).catch((e) => reportCloudError('initBracket', e));
    }
  },

  advanceBracketMatch: (listId, matchId, winnerId) => {
    let updated: Bracket | null = null;
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
        if (next.aId && !next.bId && hasNoFutureOpponent(br, next)) {
          next.winnerId = next.aId;
        }
      }

      const final = br.matches[br.matches.length - 1];
      const championId = final?.winnerId ?? null;
      updated = { ...br, championId };
      return {
        lists: {
          ...s.lists,
          [listId]: { ...list, bracket: updated, updatedAt: Date.now() },
        },
      };
    });
    if (updated) {
      api
        .updateBracket(listId, updated)
        .catch((e) => reportCloudError('advanceBracketMatch', e));
    }
  },

  resetBracket: (listId) => {
    set((s) => {
      const list = s.lists[listId];
      if (!list) return s;
      return {
        lists: {
          ...s.lists,
          [listId]: { ...list, bracket: null, updatedAt: Date.now() },
        },
      };
    });
    api.updateBracket(listId, null).catch((e) => reportCloudError('resetBracket', e));
  },

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
    const copy: RankList = {
      ...src,
      id: newListId,
      ownerId: undefined,
      title: src.title,
      visibility: src.visibility ?? 'private',
      items,
      comparisons,
      tierAssignments: Object.fromEntries(
        Object.entries(src.tierAssignments ?? {}).flatMap(([k, v]) => {
          const mapped = idMap.get(k);
          return mapped ? [[mapped, v]] : [];
        }),
      ),
      directRatings: Object.fromEntries(
        Object.entries(src.directRatings ?? {}).flatMap(([k, v]) => {
          const mapped = idMap.get(k);
          return mapped ? [[mapped, v]] : [];
        }),
      ),
      bracket: null,
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({
      lists: { ...s.lists, [newListId]: copy },
      order: [newListId, ...s.order],
    }));
    api.insertList(copy).catch((e) => reportCloudError('importList', e));
    return newListId;
  },
}));

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
  void bracket;
  return match.round === 0;
}
