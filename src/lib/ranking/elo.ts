import type { Comparison, Item, Ranking } from '../types';

export type EloOptions = {
  kFactor?: number;
  initialRating?: number;
  initialDeviation?: number;
};

const DEFAULTS: Required<EloOptions> = {
  kFactor: 32,
  initialRating: 1500,
  initialDeviation: 350,
};

export type EloResult = Ranking & {
  rating: number;
  ratingDeviation: number;
  history: { index: number; rating: number }[];
};

export function rankElo(
  items: Item[],
  comparisons: Comparison[],
  opts: EloOptions = {},
): EloResult[] {
  const { kFactor, initialRating, initialDeviation } = { ...DEFAULTS, ...opts };

  const ratings = new Map<string, number>();
  const deviations = new Map<string, number>();
  const wins = new Map<string, number>();
  const losses = new Map<string, number>();
  const counts = new Map<string, number>();
  const histories = new Map<string, { index: number; rating: number }[]>();

  for (const it of items) {
    ratings.set(it.id, initialRating);
    deviations.set(it.id, initialDeviation);
    wins.set(it.id, 0);
    losses.set(it.id, 0);
    counts.set(it.id, 0);
    histories.set(it.id, [{ index: 0, rating: initialRating }]);
  }

  let step = 0;
  for (const c of comparisons) {
    if (c.skipped) continue;
    if (!ratings.has(c.winnerId) || !ratings.has(c.loserId)) continue;
    step++;

    const rw = ratings.get(c.winnerId)!;
    const rl = ratings.get(c.loserId)!;

    const expectedW = 1 / (1 + Math.pow(10, (rl - rw) / 400));
    const expectedL = 1 - expectedW;

    const newRw = rw + kFactor * (1 - expectedW);
    const newRl = rl + kFactor * (0 - expectedL);

    ratings.set(c.winnerId, newRw);
    ratings.set(c.loserId, newRl);

    const dw = deviations.get(c.winnerId)!;
    const dl = deviations.get(c.loserId)!;
    deviations.set(c.winnerId, Math.max(30, dw * 0.97));
    deviations.set(c.loserId, Math.max(30, dl * 0.97));

    wins.set(c.winnerId, (wins.get(c.winnerId) ?? 0) + 1);
    losses.set(c.loserId, (losses.get(c.loserId) ?? 0) + 1);
    counts.set(c.winnerId, (counts.get(c.winnerId) ?? 0) + 1);
    counts.set(c.loserId, (counts.get(c.loserId) ?? 0) + 1);

    histories.get(c.winnerId)!.push({ index: step, rating: newRw });
    histories.get(c.loserId)!.push({ index: step, rating: newRl });
  }

  const entries: EloResult[] = items.map((it) => {
    const rating = ratings.get(it.id) ?? initialRating;
    const rd = deviations.get(it.id) ?? initialDeviation;
    const confidence = Math.max(0, 1 - rd / initialDeviation);
    return {
      itemId: it.id,
      rank: 0,
      score: rating,
      rating,
      ratingDeviation: rd,
      confidence,
      wins: wins.get(it.id) ?? 0,
      losses: losses.get(it.id) ?? 0,
      comparisons: counts.get(it.id) ?? 0,
      history: histories.get(it.id) ?? [],
    };
  });

  entries.sort((a, b) => b.score - a.score);
  entries.forEach((e, i) => {
    e.rank = i + 1;
  });
  return entries;
}
