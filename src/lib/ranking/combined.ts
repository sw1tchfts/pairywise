import type { Bracket, RankList, Tier } from '../types';
import { rankElo } from './elo';

export type Mode = 'pairwise' | 'tier' | 'rate' | 'bracket';

export type ModeWeights = Record<Mode, number>;

export const DEFAULT_WEIGHTS: ModeWeights = {
  pairwise: 0.35,
  rate: 0.35,
  tier: 0.2,
  bracket: 0.1,
};

const TIER_SIGNAL: Record<Tier, number> = {
  S: 1.0,
  A: 0.8,
  B: 0.6,
  C: 0.4,
  D: 0.2,
};

export type ModeSignals = Partial<Record<Mode, number>>;

export type CombinedResult = {
  itemId: string;
  /** Weighted combined score in [0, 1], or null if no mode has data for this item. */
  score: number | null;
  /** Per-mode normalized signal in [0, 1] (undefined if no data from that mode). */
  signals: ModeSignals;
  /** Which modes actually contributed to the final score (non-zero weight AND defined signal). */
  contributingModes: Mode[];
};

export function computePairwiseSignals(list: RankList): Record<string, number> {
  const out: Record<string, number> = {};
  if (list.comparisons.length === 0) return out;
  const rankings = rankElo(list.items, list.comparisons);
  const scored = rankings.filter((r) => r.comparisons > 0);
  if (scored.length === 0) return out;
  const scores = scored.map((r) => r.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const span = max - min;
  for (const r of scored) {
    out[r.itemId] = span === 0 ? 0.5 : (r.score - min) / span;
  }
  return out;
}

export function computeTierSignals(list: RankList): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [itemId, tier] of Object.entries(list.tierAssignments)) {
    out[itemId] = TIER_SIGNAL[tier];
  }
  return out;
}

export function computeRateSignals(list: RankList): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [itemId, rating] of Object.entries(list.directRatings)) {
    const clamped = Math.max(1, Math.min(10, rating));
    out[itemId] = (clamped - 1) / 9;
  }
  return out;
}

/**
 * Bracket signal: how far an item progressed in the tournament.
 * Champion → 1.0, runner-up → (N-1)/N, SF loser → (N-2)/N, etc.
 * Items not in the seed get no signal.
 */
export function computeBracketSignals(bracket: Bracket | null): Record<string, number> {
  const out: Record<string, number> = {};
  if (!bracket || bracket.seed.length === 0) return out;

  const totalRounds = Math.max(
    0,
    ...bracket.matches.map((m) => m.round),
  ) + 1;
  if (totalRounds === 0) return out;

  // Track the highest round each item participated in and whether they won it.
  const lastRound = new Map<string, number>();
  const wonLastRound = new Map<string, boolean>();

  for (const match of bracket.matches) {
    for (const side of [match.aId, match.bId] as const) {
      if (!side) continue;
      const prev = lastRound.get(side) ?? -1;
      if (match.round > prev) {
        lastRound.set(side, match.round);
        wonLastRound.set(side, match.winnerId === side);
      }
    }
  }

  for (const id of bracket.seed) {
    const r = lastRound.get(id);
    if (r === undefined) {
      // Got a bye through the whole thing — shouldn't happen, but treat as made it round 0.
      out[id] = 0;
      continue;
    }
    const w = wonLastRound.get(id) ? 1 : 0;
    out[id] = (r + w) / totalRounds;
  }

  return out;
}

export function combineRankings(
  list: RankList,
  weights: ModeWeights = DEFAULT_WEIGHTS,
): CombinedResult[] {
  const pairwise = computePairwiseSignals(list);
  const tier = computeTierSignals(list);
  const rate = computeRateSignals(list);
  const bracket = computeBracketSignals(list.bracket ?? null);

  const results: CombinedResult[] = list.items.map((item) => {
    const signals: ModeSignals = {};
    if (item.id in pairwise) signals.pairwise = pairwise[item.id];
    if (item.id in tier) signals.tier = tier[item.id];
    if (item.id in rate) signals.rate = rate[item.id];
    if (item.id in bracket) signals.bracket = bracket[item.id];

    const contributingModes: Mode[] = [];
    let weightedSum = 0;
    let totalWeight = 0;
    for (const mode of ['pairwise', 'tier', 'rate', 'bracket'] as Mode[]) {
      const w = weights[mode] ?? 0;
      const s = signals[mode];
      if (w > 0 && s !== undefined) {
        weightedSum += w * s;
        totalWeight += w;
        contributingModes.push(mode);
      }
    }

    const score = totalWeight > 0 ? weightedSum / totalWeight : null;
    return { itemId: item.id, score, signals, contributingModes };
  });

  results.sort((a, b) => {
    if (a.score === null && b.score === null) return 0;
    if (a.score === null) return 1;
    if (b.score === null) return -1;
    return b.score - a.score;
  });

  return results;
}

export function normalizeWeights(weights: ModeWeights): ModeWeights {
  const sum = (Object.values(weights) as number[]).reduce((a, b) => a + b, 0);
  if (sum <= 0) return { ...DEFAULT_WEIGHTS };
  return {
    pairwise: weights.pairwise / sum,
    tier: weights.tier / sum,
    rate: weights.rate / sum,
    bracket: weights.bracket / sum,
  };
}
