import type { Comparison, Item } from '../types';

export function makeItems(labels: string[]): Item[] {
  return labels.map((label) => ({ id: label, type: 'text', title: label, tags: [] }));
}

/**
 * Generate noisy pairwise outcomes given true strengths using a
 * round-robin structure: every pair is compared exactly `rounds` times,
 * so sampling bias cannot skew the ordering.
 *
 * Pr(i beats j) = s_i / (s_i + s_j)  (Bradley-Terry generative model).
 */
export function simulateComparisons(
  items: Item[],
  trueStrength: Record<string, number>,
  roundsOrTotal: number,
  seed = 42,
): Comparison[] {
  const rng = mulberry32(seed);
  const pairs: [Item, Item][] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      pairs.push([items[i], items[j]]);
    }
  }
  const rounds = Math.max(1, Math.floor(roundsOrTotal / Math.max(1, pairs.length)));
  const comps: Comparison[] = [];
  let k = 0;
  for (let r = 0; r < rounds; r++) {
    const shuffled = [...pairs];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    for (const [a, b] of shuffled) {
      const sa = trueStrength[a.id];
      const sb = trueStrength[b.id];
      const pA = sa / (sa + sb);
      const aWins = rng() < pA;
      comps.push({
        id: `c${k++}`,
        winnerId: aWins ? a.id : b.id,
        loserId: aWins ? b.id : a.id,
        createdAt: k,
      });
    }
  }
  return comps;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
