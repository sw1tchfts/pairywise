import { describe, it, expect } from 'vitest';
import { rankElo } from './elo';
import { makeItems, simulateComparisons } from './__fixtures__';

describe('rankElo', () => {
  it('orders items by their true strengths when given enough comparisons', () => {
    const items = makeItems(['A', 'B', 'C', 'D', 'E']);
    const truth = { A: 32, B: 16, C: 8, D: 4, E: 2 };
    const comparisons = simulateComparisons(items, truth, 3000, 7);
    const ranking = rankElo(items, comparisons);
    const order = ranking.map((r) => r.itemId);
    expect(order).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('assigns the initial rating to items with no comparisons', () => {
    const items = makeItems(['A', 'B']);
    const ranking = rankElo(items, []);
    expect(ranking.every((r) => r.rating === 1500)).toBe(true);
  });

  it('increases rating for winners and decreases for losers', () => {
    const items = makeItems(['A', 'B']);
    const comparisons = [
      { id: '1', winnerId: 'A', loserId: 'B', createdAt: 0 },
    ];
    const ranking = rankElo(items, comparisons);
    const a = ranking.find((r) => r.itemId === 'A')!;
    const b = ranking.find((r) => r.itemId === 'B')!;
    expect(a.rating).toBeGreaterThan(1500);
    expect(b.rating).toBeLessThan(1500);
  });

  it('skips comparisons marked as skipped', () => {
    const items = makeItems(['A', 'B']);
    const comparisons = [
      { id: '1', winnerId: 'A', loserId: 'B', skipped: true, createdAt: 0 },
    ];
    const ranking = rankElo(items, comparisons);
    expect(ranking.every((r) => r.rating === 1500)).toBe(true);
  });

  it('tracks rating history per item', () => {
    const items = makeItems(['A', 'B']);
    const comparisons = [
      { id: '1', winnerId: 'A', loserId: 'B', createdAt: 0 },
      { id: '2', winnerId: 'A', loserId: 'B', createdAt: 1 },
    ];
    const ranking = rankElo(items, comparisons);
    const a = ranking.find((r) => r.itemId === 'A')!;
    expect(a.history.length).toBe(3);
  });
});
