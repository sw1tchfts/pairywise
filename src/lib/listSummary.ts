import { comparisonsRemaining } from './ranking/pairSelection';
import { rankElo } from './ranking/elo';
import type { RankList } from './types';

type ListSummary = {
  listId: string;
  topItems: { title: string; score: number }[];
  pairsDone: number;
  pairsTotal: number;
  progress: number;
  lastActivity: number;
};

/** Precomputed summaries for every list, used to render home cards + sort. */
export function summarize(list: RankList): ListSummary {
  const rankings = rankElo(list.items, list.comparisons);
  const topItems = rankings
    .filter((r) => r.comparisons > 0)
    .slice(0, 3)
    .flatMap((r) => {
      const item = list.items.find((i) => i.id === r.itemId);
      return item ? [{ title: item.title, score: r.score }] : [];
    });
  const pairsDone = list.comparisons.length;
  const remaining = comparisonsRemaining(list.items, list.comparisons);
  const pairsTotal = pairsDone + remaining;
  const progress = pairsTotal > 0 ? Math.min(1, pairsDone / pairsTotal) : 0;
  const lastVote = list.comparisons.length
    ? list.comparisons[list.comparisons.length - 1].createdAt
    : 0;
  const lastActivity = Math.max(list.updatedAt ?? 0, lastVote);
  return { listId: list.id, topItems, pairsDone, pairsTotal, progress, lastActivity };
}

/** Human-ish "2m ago", "3h ago", "5d ago". */
export function timeAgo(ts: number, now = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}
