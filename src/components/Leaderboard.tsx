'use client';

import type { Item } from '@/lib/types';
import type { RankingResult } from '@/lib/ranking';

type Props = {
  items: Item[];
  rankings: RankingResult[];
  scoreLabel: string;
  onItemClick?: (itemId: string) => void;
};

export function Leaderboard({ items, rankings, scoreLabel, onItemClick }: Props) {
  const itemsById = new Map(items.map((it) => [it.id, it]));
  return (
    <ol className="grid gap-2">
      {rankings.map((r) => {
        const item = itemsById.get(r.itemId);
        if (!item) return null;
        return (
          <li
            key={r.itemId}
            className="flex items-center gap-3 rounded-lg border border-black/10 dark:border-white/10 p-3"
            onClick={onItemClick ? () => onItemClick(r.itemId) : undefined}
          >
            <div className="w-8 text-right font-mono text-foreground/60 text-sm">
              #{r.rank}
            </div>
            {item.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.imageUrl}
                alt=""
                className="w-12 h-12 object-cover rounded flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{item.label}</div>
              <div className="text-xs text-foreground/60">
                {r.wins}W–{r.losses}L ({r.comparisons} votes) · confidence{' '}
                {(r.confidence * 100).toFixed(0)}%
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-sm">{formatScore(r.score)}</div>
              <div className="text-[10px] uppercase tracking-wider text-foreground/50">
                {scoreLabel}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function formatScore(s: number) {
  if (!Number.isFinite(s)) return '—';
  if (Math.abs(s) >= 100) return s.toFixed(0);
  return s.toFixed(2);
}
