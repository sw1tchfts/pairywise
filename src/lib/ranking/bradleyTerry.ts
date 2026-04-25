import type { Comparison, Item, Ranking } from '../types';

type BradleyTerryOptions = {
  maxIterations?: number;
  tolerance?: number;
  prior?: number;
};

const DEFAULTS: Required<BradleyTerryOptions> = {
  maxIterations: 200,
  tolerance: 1e-6,
  prior: 0.5,
};

export type BradleyTerryResult = Ranking & {
  strength: number;
  logStrength: number;
};

/**
 * Bradley-Terry model solved via the Minorization-Maximization (MM)
 * algorithm (Zermelo/Hunter). With a symmetric prior of `prior` implicit
 * wins and losses between every pair, the iteration is well-defined even
 * when the comparison graph is disconnected.
 */
export function rankBradleyTerry(
  items: Item[],
  comparisons: Comparison[],
  opts: BradleyTerryOptions = {},
): BradleyTerryResult[] {
  const { maxIterations, tolerance, prior } = { ...DEFAULTS, ...opts };
  const n = items.length;
  const idx = new Map<string, number>();
  items.forEach((it, i) => idx.set(it.id, i));

  const w = Array.from({ length: n }, () => new Float64Array(n));
  const wins = new Array<number>(n).fill(0);
  const losses = new Array<number>(n).fill(0);
  const counts = new Array<number>(n).fill(0);

  for (const c of comparisons) {
    if (c.skipped) continue;
    const i = idx.get(c.winnerId);
    const j = idx.get(c.loserId);
    if (i === undefined || j === undefined) continue;
    w[i][j] += 1;
    wins[i]++;
    losses[j]++;
    counts[i]++;
    counts[j]++;
  }

  if (prior > 0) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i !== j) w[i][j] += prior;
      }
    }
  }

  const totalWins = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) s += w[i][j];
    totalWins[i] = s;
  }

  const p = new Array<number>(n).fill(1);
  const next = new Array<number>(n).fill(1);

  for (let iter = 0; iter < maxIterations; iter++) {
    for (let i = 0; i < n; i++) {
      let denom = 0;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const nij = w[i][j] + w[j][i];
        if (nij === 0) continue;
        denom += nij / (p[i] + p[j]);
      }
      next[i] = denom > 0 ? totalWins[i] / denom : p[i];
    }

    let sum = 0;
    for (let i = 0; i < n; i++) sum += next[i];
    if (sum > 0) {
      for (let i = 0; i < n; i++) next[i] = (next[i] * n) / sum;
    }

    let delta = 0;
    for (let i = 0; i < n; i++) {
      delta += Math.abs(next[i] - p[i]);
      p[i] = next[i];
    }
    if (delta < tolerance) break;
  }

  const results: BradleyTerryResult[] = items.map((it, i) => {
    const strength = p[i];
    const logStrength = Math.log(Math.max(strength, 1e-12));
    const total = counts[i];
    const confidence = total === 0 ? 0 : 1 - 1 / (1 + total / 4);
    return {
      itemId: it.id,
      rank: 0,
      score: logStrength,
      strength,
      logStrength,
      confidence,
      wins: wins[i],
      losses: losses[i],
      comparisons: total,
    };
  });

  results.sort((a, b) => b.score - a.score);
  results.forEach((r, i) => {
    r.rank = i + 1;
  });
  return results;
}
