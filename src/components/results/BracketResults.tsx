'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { RankList, BracketMatch } from '@/lib/types';

export function BracketResults({ list }: { list: RankList }) {
  const bracket = list.bracket;
  const itemsById = useMemo(
    () => new Map(list.items.map((i) => [i.id, i])),
    [list.items],
  );

  if (!bracket) {
    return (
      <div className="text-sm text-foreground/60">
        No bracket yet.{' '}
        <Link className="underline" href={`/lists/${list.id}/bracket`}>
          Start a tournament
        </Link>{' '}
        to seed one.
      </div>
    );
  }

  const champion = bracket.championId ? itemsById.get(bracket.championId) : null;
  const totalRounds = Math.max(0, ...bracket.matches.map((m) => m.round)) + 1;

  // Standings: group items by how far they got.
  const lastRound = new Map<string, number>();
  const wonLastRound = new Map<string, boolean>();
  for (const match of bracket.matches) {
    for (const side of [match.aId, match.bId] as const) {
      if (!side) continue;
      const prev = lastRound.get(side) ?? -1;
      if (match.round > prev) {
        lastRound.set(side, match.round);
        wonLastRound.set(side, match.winnerId === side);
      }
    }
  }

  const standings: { itemId: string; round: number; won: boolean }[] = [];
  for (const id of bracket.seed) {
    const r = lastRound.get(id) ?? 0;
    standings.push({ itemId: id, round: r, won: wonLastRound.get(id) ?? false });
  }
  standings.sort((a, b) => {
    const ra = a.round + (a.won ? 0.5 : 0);
    const rb = b.round + (b.won ? 0.5 : 0);
    return rb - ra;
  });

  return (
    <div>
      {champion && (
        <div className="mb-5 rounded-lg border-2 border-amber-400/80 bg-amber-50 dark:bg-amber-950/30 p-4 text-center">
          <div className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-300">
            Champion
          </div>
          <div className="text-xl font-semibold mt-1">{champion.title}</div>
        </div>
      )}
      <ol className="divide-y divide-foreground/10 rounded-md border border-foreground/15 overflow-hidden">
        {standings.map((s, i) => {
          const item = itemsById.get(s.itemId);
          if (!item) return null;
          return (
            <li
              key={s.itemId}
              className="flex items-center gap-3 px-3 py-2 text-sm"
            >
              <span className="w-6 text-right tabular-nums text-foreground/50">
                {i + 1}
              </span>
              <span className="flex-1 min-w-0 truncate">{item.title}</span>
              <span className="text-xs text-foreground/60 whitespace-nowrap">
                {progressLabel(s.round, s.won, totalRounds)}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-foreground/50 mt-3">
        {decidedMatches(bracket.matches)} of {bracket.matches.length} matches decided.{' '}
        <Link className="underline" href={`/lists/${list.id}/bracket`}>
          {bracket.championId ? 'View bracket' : 'Keep playing'}
        </Link>
      </p>
    </div>
  );
}

function decidedMatches(matches: BracketMatch[]): number {
  return matches.filter((m) => m.winnerId !== null).length;
}

function progressLabel(round: number, won: boolean, totalRounds: number): string {
  const fromEnd = totalRounds - 1 - round;
  if (fromEnd === 0 && won) return 'Won final';
  if (fromEnd === 0) return 'Runner-up';
  if (fromEnd === 1 && won) return 'Finalist';
  if (fromEnd === 1) return 'Semifinals';
  if (fromEnd === 2 && won) return 'Semifinalist';
  if (fromEnd === 2) return 'Quarterfinals';
  return won ? `Won round ${round + 1}` : `Out round ${round + 1}`;
}
