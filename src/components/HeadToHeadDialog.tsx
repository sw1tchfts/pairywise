'use client';

import { useEffect, useMemo } from 'react';
import type { RankList } from '@/lib/types';
import { rankElo } from '@/lib/ranking';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';

type Props = {
  list: RankList;
  itemId: string | null;
  onClose: () => void;
};

type OpponentRow = {
  opponentId: string;
  opponentTitle: string;
  wins: number;
  losses: number;
  flips: number;
  opponentRating: number;
};

export function HeadToHeadDialog({ list, itemId, onClose }: Props) {
  useBodyScrollLock(itemId !== null);

  useEffect(() => {
    if (!itemId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [itemId, onClose]);

  const item = useMemo(
    () => (itemId ? list.items.find((i) => i.id === itemId) ?? null : null),
    [itemId, list.items],
  );

  const rankings = useMemo(
    () => rankElo(list.items, list.comparisons),
    [list.items, list.comparisons],
  );
  const ratingById = useMemo(
    () => new Map(rankings.map((r) => [r.itemId, r.score])),
    [rankings],
  );
  const myRating = itemId ? ratingById.get(itemId) ?? 0 : 0;

  const rows = useMemo<OpponentRow[]>(() => {
    if (!itemId) return [];
    // Chronological pass to detect "flips" (same pair with different winners in sequence).
    type Record = { wins: number; losses: number; flips: number; lastWinner: string | null };
    const acc = new Map<string, Record>();

    for (const c of list.comparisons) {
      if (c.skipped) continue;
      let opponent: string | null = null;
      let meWon: boolean | null = null;
      if (c.winnerId === itemId) {
        opponent = c.loserId;
        meWon = true;
      } else if (c.loserId === itemId) {
        opponent = c.winnerId;
        meWon = false;
      }
      if (!opponent || meWon === null) continue;

      const prev = acc.get(opponent) ?? {
        wins: 0,
        losses: 0,
        flips: 0,
        lastWinner: null,
      };
      const newWinner = meWon ? itemId : opponent;
      if (prev.lastWinner && prev.lastWinner !== newWinner) prev.flips += 1;
      prev.lastWinner = newWinner;
      if (meWon) prev.wins += 1;
      else prev.losses += 1;
      acc.set(opponent, prev);
    }

    const titleById = new Map(list.items.map((i) => [i.id, i.title]));
    return Array.from(acc.entries())
      .map(([opponentId, rec]) => ({
        opponentId,
        opponentTitle: titleById.get(opponentId) ?? '—',
        wins: rec.wins,
        losses: rec.losses,
        flips: rec.flips,
        opponentRating: ratingById.get(opponentId) ?? 0,
      }))
      .sort((a, b) => {
        // Most-contested first: by smallest rating gap where both items have comparisons.
        const gapA = Math.abs(myRating - a.opponentRating);
        const gapB = Math.abs(myRating - b.opponentRating);
        return gapA - gapB;
      });
  }, [itemId, list.comparisons, list.items, myRating, ratingById]);

  if (!itemId || !item) return null;

  const totalWins = rows.reduce((s, r) => s + r.wins, 0);
  const totalLosses = rows.reduce((s, r) => s + r.losses, 0);

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="h2h-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg max-h-[85vh] overflow-auto rounded-lg bg-background border border-foreground/10 shadow-xl">
        <div className="sticky top-0 bg-background border-b border-foreground/10 p-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="h2h-title" className="text-lg font-semibold truncate">
              {item.title}
            </h2>
            <p className="text-xs text-foreground/60 mt-0.5">
              Rating <span className="font-mono">{Math.round(myRating)}</span> ·{' '}
              {totalWins}W–{totalLosses}L across {rows.length} opponents
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-foreground/50 hover:text-foreground text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {rows.length === 0 ? (
          <div className="p-6 text-sm text-foreground/60 text-center">
            No head-to-head matchups yet. Vote on some pairs first.
          </div>
        ) : (
          <ul className="divide-y divide-foreground/10">
            {rows.map((r) => {
              const total = r.wins + r.losses;
              const winRate = total > 0 ? r.wins / total : 0;
              const gap = Math.abs(myRating - r.opponentRating);
              return (
                <li
                  key={r.opponentId}
                  className="p-3 flex items-center gap-3 text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{r.opponentTitle}</div>
                    <div className="text-xs text-foreground/50 mt-0.5 flex items-center gap-2">
                      <span>
                        {r.wins}W–{r.losses}L
                      </span>
                      <span>·</span>
                      <span>gap {Math.round(gap)}</span>
                      {r.flips > 0 && (
                        <span
                          className="text-amber-600 dark:text-amber-400"
                          title="You changed your mind on this pair"
                        >
                          · {r.flips} flip{r.flips === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-24 shrink-0">
                    <div className="h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                      <div
                        className="h-full bg-foreground/60"
                        style={{ width: `${winRate * 100}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-foreground/50 mt-0.5 text-right tabular-nums">
                      {(winRate * 100).toFixed(0)}%
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
