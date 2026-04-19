import { describe, it, expect } from 'vitest';
import {
  combineRankings,
  computeBracketSignals,
  computeRateSignals,
  computeTierSignals,
  DEFAULT_WEIGHTS,
  normalizeWeights,
} from './combined';
import type { Bracket, RankList } from '../types';

function makeList(partial: Partial<RankList> = {}): RankList {
  return {
    id: 'list-1',
    title: 'Test',
    tags: [],
    items: [
      { id: 'A', type: 'text', title: 'A', tags: [] },
      { id: 'B', type: 'text', title: 'B', tags: [] },
      { id: 'C', type: 'text', title: 'C', tags: [] },
      { id: 'D', type: 'text', title: 'D', tags: [] },
    ],
    comparisons: [],
    algorithmDefault: 'elo',
    tierAssignments: {},
    directRatings: {},
    bracket: null,
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  };
}

describe('computeTierSignals', () => {
  it('maps tiers to 0.2 steps', () => {
    const list = makeList({
      tierAssignments: { A: 'S', B: 'A', C: 'C', D: 'D' },
    });
    const sigs = computeTierSignals(list);
    expect(sigs).toEqual({ A: 1.0, B: 0.8, C: 0.4, D: 0.2 });
  });
  it('skips items without assignments', () => {
    const list = makeList({ tierAssignments: { A: 'S' } });
    const sigs = computeTierSignals(list);
    expect(sigs).toEqual({ A: 1.0 });
  });
});

describe('computeRateSignals', () => {
  it('scales 1..10 to 0..1', () => {
    const list = makeList({ directRatings: { A: 10, B: 1, C: 5.5 } });
    const sigs = computeRateSignals(list);
    expect(sigs.A).toBe(1);
    expect(sigs.B).toBe(0);
    expect(sigs.C).toBeCloseTo(0.5, 5);
  });
  it('clamps out-of-range values', () => {
    const list = makeList({ directRatings: { A: 12, B: -5 } });
    const sigs = computeRateSignals(list);
    expect(sigs.A).toBe(1);
    expect(sigs.B).toBe(0);
  });
});

describe('computeBracketSignals', () => {
  it('returns empty for null bracket', () => {
    expect(computeBracketSignals(null)).toEqual({});
  });

  it('gives 1.0 to champion, fractions to earlier losers', () => {
    // 4-seed, 2 rounds. A beats B in r0, C beats D in r0, A beats C in r1.
    const bracket: Bracket = {
      seed: ['A', 'B', 'C', 'D'],
      matches: [
        { id: 'm1', round: 0, aId: 'A', bId: 'B', winnerId: 'A' },
        { id: 'm2', round: 0, aId: 'C', bId: 'D', winnerId: 'C' },
        { id: 'm3', round: 1, aId: 'A', bId: 'C', winnerId: 'A' },
      ],
      championId: 'A',
    };
    const sigs = computeBracketSignals(bracket);
    // totalRounds = 2.
    // A: last round 1, won → (1+1)/2 = 1.0
    // C: last round 1, lost → (1+0)/2 = 0.5
    // B: last round 0, lost → 0/2 = 0
    // D: last round 0, lost → 0/2 = 0
    expect(sigs.A).toBe(1.0);
    expect(sigs.C).toBe(0.5);
    expect(sigs.B).toBe(0);
    expect(sigs.D).toBe(0);
  });
});

describe('combineRankings', () => {
  it('returns items sorted by score desc with null scores at the end', () => {
    const list = makeList({
      tierAssignments: { A: 'S', B: 'C' },
      directRatings: { A: 9, B: 5 },
    });
    const results = combineRankings(list);
    expect(results[0].itemId).toBe('A');
    expect(results[1].itemId).toBe('B');
    // C and D have no signals → score null, ranked last in stable order.
    expect(results[2].score).toBeNull();
    expect(results[3].score).toBeNull();
  });

  it('skips modes without data without penalizing items', () => {
    // Only tier signals — no pairwise, no rate, no bracket. Should still rank A above B.
    const list = makeList({ tierAssignments: { A: 'S', B: 'D' } });
    const results = combineRankings(list);
    const a = results.find((r) => r.itemId === 'A');
    const b = results.find((r) => r.itemId === 'B');
    expect(a?.score).toBe(1.0);
    expect(b?.score).toBeCloseTo(0.2, 5);
    expect(a?.contributingModes).toEqual(['tier']);
  });

  it('only uses modes with non-zero weight', () => {
    const list = makeList({
      tierAssignments: { A: 'S', B: 'D' },
      directRatings: { A: 1, B: 10 },
    });
    const results = combineRankings(list, {
      pairwise: 0,
      tier: 1,
      rate: 0,
      bracket: 0,
    });
    const a = results.find((r) => r.itemId === 'A');
    expect(a?.score).toBe(1.0);
    expect(a?.contributingModes).toEqual(['tier']);
  });

  it('weighted averages across modes for items with multiple signals', () => {
    // A has tier S (1.0) and rate 10 (1.0) → score = 1.0 regardless of weights.
    // B has tier D (0.2) and rate 10 (1.0) → with equal weights = 0.6.
    const list = makeList({
      tierAssignments: { A: 'S', B: 'D' },
      directRatings: { A: 10, B: 10 },
    });
    const results = combineRankings(list, {
      pairwise: 0,
      tier: 0.5,
      rate: 0.5,
      bracket: 0,
    });
    const a = results.find((r) => r.itemId === 'A');
    const b = results.find((r) => r.itemId === 'B');
    expect(a?.score).toBe(1.0);
    expect(b?.score).toBeCloseTo(0.6, 5);
  });
});

describe('normalizeWeights', () => {
  it('normalizes to sum 1', () => {
    const n = normalizeWeights({ pairwise: 2, tier: 2, rate: 2, bracket: 2 });
    expect(n.pairwise).toBe(0.25);
    expect(n.tier).toBe(0.25);
  });
  it('falls back to defaults for all-zero input', () => {
    const n = normalizeWeights({ pairwise: 0, tier: 0, rate: 0, bracket: 0 });
    expect(n).toEqual(DEFAULT_WEIGHTS);
  });
});
