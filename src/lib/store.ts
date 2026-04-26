'use client';

import { create } from 'zustand';
import type {
  Algorithm,
  Comparison,
  Item,
  Phase,
  RankList,
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
  currentUserId: string | null;
};

type Actions = {
  hydrate: () => Promise<void>;
  setHydratedFromServer: (lists: RankList[], userId: string) => void;
  reset: () => void;
  createList: (input: {
    title: string;
    description?: string;
    tags?: string[];
    visibility?: Visibility;
    phase?: Phase;
  }) => string;
  deleteList: (id: string) => void;
  archiveList: (id: string) => void;
  restoreList: (id: string) => void;
  duplicateList: (id: string) => string | null;
  updateList: (
    id: string,
    patch: Partial<
      Pick<
        RankList,
        'title' | 'description' | 'tags' | 'algorithmDefault' | 'visibility' | 'phase'
      >
    >,
  ) => void;
  setPhase: (id: string, phase: Phase) => void;
  addItem: (listId: string, item: Omit<Item, 'id'>) => string;
  updateItem: (listId: string, itemId: string, patch: Partial<Omit<Item, 'id'>>) => void;
  removeItem: (listId: string, itemId: string) => void;
  recordComparison: (listId: string, winnerId: string, loserId: string) => void;
  skipPair: (listId: string, aId: string, bId: string) => void;
  undoLastComparison: (listId: string) => Comparison | null;
  setAlgorithmDefault: (listId: string, algo: Algorithm) => void;
  importList: (list: RankList) => string;
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
  currentUserId: null,

  hydrate: async () => {
    if (get().hydrating) return;
    set({ hydrating: true, hydrateError: null });
    try {
      const [userId, lists] = await Promise.all([
        api.getCurrentUserId(),
        api.fetchAllLists(),
      ]);
      const map: Record<string, RankList> = {};
      const order: string[] = [];
      for (const l of lists) {
        map[l.id] = l;
        order.push(l.id);
      }
      set({
        lists: map,
        order,
        hydrated: true,
        hydrating: false,
        currentUserId: userId,
      });
    } catch (err) {
      set({
        hydrating: false,
        hydrateError: err instanceof Error ? err.message : 'Failed to load lists.',
      });
      reportCloudError('hydrate', err);
    }
  },

  setHydratedFromServer: (lists, userId) => {
    // Skip if the store was already hydrated locally (the user has done a
    // mutation since mount). The server snapshot would clobber their
    // optimistic state.
    if (get().hydrated) return;
    const map: Record<string, RankList> = {};
    const order: string[] = [];
    for (const l of lists) {
      map[l.id] = l;
      order.push(l.id);
    }
    set({
      lists: map,
      order,
      hydrated: true,
      hydrating: false,
      hydrateError: null,
      currentUserId: userId,
    });
  },

  reset: () =>
    set({
      lists: {},
      order: [],
      hydrated: false,
      hydrating: false,
      hydrateError: null,
      currentUserId: null,
    }),

  createList: ({ title, description, tags, visibility, phase }) => {
    const id = uid();
    const now = Date.now();
    const list: RankList = {
      id,
      title,
      description,
      tags: tags ?? [],
      visibility: visibility ?? 'private',
      phase: phase ?? 'submission',
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

  archiveList: (id) => {
    set((s) => {
      const rest = { ...s.lists };
      delete rest[id];
      return { lists: rest, order: s.order.filter((x) => x !== id) };
    });
    api.archiveList(id).catch((e) => reportCloudError('archiveList', e));
  },

  restoreList: (id) => {
    // Local state only tracks active lists; on restore we trigger a fresh hydrate
    // so the restored list reappears at the top.
    api
      .restoreList(id)
      .then(() => get().hydrate())
      .catch((e) => reportCloudError('restoreList', e));
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

  setPhase: (id, phase) => {
    set((s) => {
      const list = s.lists[id];
      if (!list) return s;
      return {
        lists: {
          ...s.lists,
          [id]: { ...list, phase, updatedAt: Date.now() },
        },
      };
    });
    api.updateListPhase(id, phase).catch((e) => reportCloudError('setPhase', e));
  },

  addItem: (listId, item) => {
    const itemId = uid();
    const creatorId = get().currentUserId ?? undefined;
    let position = 0;
    const stamped: Item = { ...item, id: itemId, creatorId };
    set((s) => {
      const list = s.lists[listId];
      if (!list) return s;
      position = list.items.length;
      return {
        lists: {
          ...s.lists,
          [listId]: {
            ...list,
            items: [...list.items, stamped],
            updatedAt: Date.now(),
          },
        },
      };
    });
    api
      .insertItem(listId, stamped, position)
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
    const voterId = get().currentUserId ?? undefined;
    const c: Comparison = {
      id: uid(),
      voterId,
      winnerId,
      loserId,
      createdAt: Date.now(),
    };
    set((s) => {
      const list = s.lists[listId];
      if (!list) return s;
      // Replace any existing non-skipped vote from this user on the same pair
      // so the store mirrors the DB's unique-per-pair constraint.
      const filtered = list.comparisons.filter((existing) => {
        if (existing.skipped) return true;
        if (existing.voterId && voterId && existing.voterId !== voterId) return true;
        const sameA = existing.winnerId === winnerId && existing.loserId === loserId;
        const sameB = existing.winnerId === loserId && existing.loserId === winnerId;
        return !(sameA || sameB);
      });
      return {
        lists: {
          ...s.lists,
          [listId]: {
            ...list,
            comparisons: [...filtered, c],
            updatedAt: Date.now(),
          },
        },
      };
    });
    api.insertComparison(listId, c).catch((e) => reportCloudError('recordComparison', e));
  },

  skipPair: (listId, aId, bId) => {
    const voterId = get().currentUserId ?? undefined;
    const c: Comparison = {
      id: uid(),
      voterId,
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
