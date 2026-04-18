import { describe, it, expect } from 'vitest';
import { rankBradleyTerry } from './bradleyTerry';
import { makeItems, simulateComparisons } from './__fixtures__';

describe('rankBradleyTerry', () => {
  it('orders items by their true strengths when given enough comparisons', () => {
    const items = makeItems(['A', 'B', 'C', 'D', 'E']);
    const truth = { A: 32, B: 16, C: 8, D: 4, E: 2 };
    const comparisons = simulateComparisons(items, truth, 1500, 13);
    const ranking = rankBradleyTerry(items, comparisons);
    const order = ranking.map((r) => r.itemId);
    expect(order).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('agrees with ELO on the top and bottom of the ranking', async () => {
    const { rankElo } = await import('./elo');
    const items = makeItems(['A', 'B', 'C', 'D']);
    const truth = { A: 32, B: 12, C: 6, D: 1 };
    const comparisons = simulateComparisons(items, truth, 1200, 3);
    const bt = rankBradleyTerry(items, comparisons).map((r) => r.itemId);
    const elo = rankElo(items, comparisons).map((r) => r.itemId);
    expect(bt[0]).toBe(elo[0]);
    expect(bt[bt.length - 1]).toBe(elo[elo.length - 1]);
  });

  it('returns a ranking with uniform scores when there are no comparisons', () => {
    const items = makeItems(['A', 'B', 'C']);
    const ranking = rankBradleyTerry(items, []);
    const scores = ranking.map((r) => r.strength);
    const first = scores[0];
    for (const s of scores) {
      expect(Math.abs(s - first)).toBeLessThan(1e-6);
    }
  });

  it('handles disconnected comparison graphs without diverging', () => {
    const items = makeItems(['A', 'B', 'C', 'D']);
    const comparisons = [
      { id: '1', winnerId: 'A', loserId: 'B', createdAt: 0 },
      { id: '2', winnerId: 'C', loserId: 'D', createdAt: 1 },
    ];
    const ranking = rankBradleyTerry(items, comparisons);
    expect(ranking.every((r) => Number.isFinite(r.score))).toBe(true);
  });

  it('ignores skipped comparisons', () => {
    const items = makeItems(['A', 'B']);
    const comparisons = [
      { id: '1', winnerId: 'A', loserId: 'B', skipped: true, createdAt: 0 },
    ];
    const ranking = rankBradleyTerry(items, comparisons);
    expect(Math.abs(ranking[0].strength - ranking[1].strength)).toBeLessThan(1e-6);
  });
});
