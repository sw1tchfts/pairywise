import type { Algorithm, Comparison, Item, Ranking } from '../types';
import { rankElo, type EloResult } from './elo';
import { rankBradleyTerry, type BradleyTerryResult } from './bradleyTerry';

export type RankingResult = EloResult | BradleyTerryResult;

export function rank(
  algorithm: Algorithm,
  items: Item[],
  comparisons: Comparison[],
): RankingResult[] {
  if (algorithm === 'bradleyTerry') return rankBradleyTerry(items, comparisons);
  return rankElo(items, comparisons);
}

export { rankElo, rankBradleyTerry };
export { nextPair, comparisonsRemaining } from './pairSelection';
export type { Ranking };
