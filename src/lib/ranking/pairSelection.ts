import type { Comparison, Item } from '../types';

export type PairSelectionOptions = {
  random?: () => number;
  strategy?: 'coverage' | 'informative';
  ratingsById?: Map<string, number>;
};

/**
 * Pick the next pair of items to compare.
 *
 * Strategy:
 *   1. If any item has been compared fewer times than others, bias toward
 *      a pair involving the least-compared items (coverage).
 *   2. Never repeat an exact pair until all pairs are seen once.
 *   3. In "informative" mode, break ties by preferring pairs whose ratings
 *      are closest (most uncertain, so most informative).
 */
export function nextPair(
  items: Item[],
  comparisons: Comparison[],
  opts: PairSelectionOptions = {},
): [Item, Item] | null {
  const random = opts.random ?? Math.random;
  if (items.length < 2) return null;

  const seen = new Set<string>();
  const pairCount = new Map<string, number>();
  for (const c of comparisons) {
    const key = pairKey(c.winnerId, c.loserId);
    seen.add(key);
    pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
  }

  const itemCounts = new Map<string, number>();
  for (const it of items) itemCounts.set(it.id, 0);
  for (const c of comparisons) {
    itemCounts.set(c.winnerId, (itemCounts.get(c.winnerId) ?? 0) + 1);
    itemCounts.set(c.loserId, (itemCounts.get(c.loserId) ?? 0) + 1);
  }

  const totalPairs = (items.length * (items.length - 1)) / 2;
  const unseenPairs: [Item, Item][] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (!seen.has(pairKey(a.id, b.id))) unseenPairs.push([a, b]);
    }
  }

  if (unseenPairs.length > 0 && seen.size < totalPairs) {
    const minUse = Math.min(...unseenPairs.map(([a, b]) =>
      Math.min(itemCounts.get(a.id) ?? 0, itemCounts.get(b.id) ?? 0),
    ));
    const candidates = unseenPairs.filter(([a, b]) =>
      Math.min(itemCounts.get(a.id) ?? 0, itemCounts.get(b.id) ?? 0) === minUse,
    );
    return chooseByStrategy(candidates, opts, random);
  }

  const leastUsed = Math.min(...pairCount.values());
  const least: [Item, Item][] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      const key = pairKey(a.id, b.id);
      if ((pairCount.get(key) ?? 0) === leastUsed) least.push([a, b]);
    }
  }
  return chooseByStrategy(least, opts, random);
}

function chooseByStrategy(
  candidates: [Item, Item][],
  opts: PairSelectionOptions,
  random: () => number,
): [Item, Item] | null {
  if (candidates.length === 0) return null;
  if (opts.strategy === 'informative' && opts.ratingsById) {
    const ratings = opts.ratingsById;
    let best: [Item, Item] | null = null;
    let bestDelta = Infinity;
    for (const pair of candidates) {
      const [a, b] = pair;
      const ra = ratings.get(a.id) ?? 0;
      const rb = ratings.get(b.id) ?? 0;
      const delta = Math.abs(ra - rb);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = pair;
      }
    }
    if (best) return best;
  }
  return candidates[Math.floor(random() * candidates.length)];
}

function pairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function comparisonsRemaining(
  items: Item[],
  comparisons: Comparison[],
  minRounds = 1,
) {
  const totalPairs = (items.length * (items.length - 1)) / 2;
  return Math.max(0, totalPairs * minRounds - comparisons.length);
}
