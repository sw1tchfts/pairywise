import { describe, it, expect } from 'vitest';
import { nextPair, comparisonsRemaining } from './pairSelection';
import { makeItems } from './__fixtures__';
import type { Comparison } from '../types';

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

describe('nextPair', () => {
  it('returns null for fewer than 2 items', () => {
    expect(nextPair([], [])).toBeNull();
    expect(nextPair(makeItems(['A']), [])).toBeNull();
  });

  it('does not repeat a pair until all pairs have been seen once', () => {
    const items = makeItems(['A', 'B', 'C', 'D']);
    const totalPairs = 6;
    const seen = new Set<string>();
    const rng = mulberry32(1);
    const comparisons: Comparison[] = [];
    for (let i = 0; i < totalPairs; i++) {
      const pair = nextPair(items, comparisons, { random: rng })!;
      const key = [pair[0].id, pair[1].id].sort().join('|');
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      comparisons.push({
        id: String(i),
        winnerId: pair[0].id,
        loserId: pair[1].id,
        createdAt: i,
      });
    }
    expect(seen.size).toBe(totalPairs);
  });

  it('prefers pairs with the closest ratings in informative mode', () => {
    const items = makeItems(['A', 'B', 'C', 'D']);
    const ratings = new Map([
      ['A', 1000],
      ['B', 1500],
      ['C', 1510],
      ['D', 2000],
    ]);
    const pair = nextPair(items, [], {
      strategy: 'informative',
      ratingsById: ratings,
      random: mulberry32(1),
    })!;
    const ids = [pair[0].id, pair[1].id].sort();
    expect(ids).toEqual(['B', 'C']);
  });
});

describe('comparisonsRemaining', () => {
  it('returns total pairs when no comparisons have been done', () => {
    const items = makeItems(['A', 'B', 'C']);
    expect(comparisonsRemaining(items, [])).toBe(3);
  });

  it('returns zero when every pair has been compared once', () => {
    const items = makeItems(['A', 'B', 'C']);
    const comparisons: Comparison[] = [
      { id: '1', winnerId: 'A', loserId: 'B', createdAt: 0 },
      { id: '2', winnerId: 'A', loserId: 'C', createdAt: 1 },
      { id: '3', winnerId: 'B', loserId: 'C', createdAt: 2 },
    ];
    expect(comparisonsRemaining(items, comparisons)).toBe(0);
  });
});
