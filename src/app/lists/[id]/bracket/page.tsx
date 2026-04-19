'use client';

import { use, useMemo } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { useToast } from '@/components/Toaster';
import type { BracketMatch, Item } from '@/lib/types';

type Params = { id: string };

export default function BracketPage({ params }: { params: Promise<Params> }) {
  const { id } = use(params);
  const list = useStore((s) => s.lists[id]);
  const initBracket = useStore((s) => s.initBracket);
  const advanceBracketMatch = useStore((s) => s.advanceBracketMatch);
  const resetBracket = useStore((s) => s.resetBracket);
  const toast = useToast();

  const itemsById = useMemo(() => {
    if (!list) return new Map<string, Item>();
    return new Map(list.items.map((i) => [i.id, i]));
  }, [list]);

  if (!list) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10 text-center">
        <p className="text-foreground/70">List not found.</p>
        <Link href="/" className="mt-4 inline-block rounded-md bg-foreground text-background px-4 py-2">
          Back home
        </Link>
      </div>
    );
  }

  const bracket = list.bracket ?? null;

  if (!bracket) {
    return (
      <div className="mx-auto max-w-xl px-4 sm:px-6 py-10 text-center">
        <div className="text-sm mb-2">
          <Link
            href={`/lists/${list.id}`}
            className="text-foreground/60 hover:text-foreground"
          >
            ← {list.title}
          </Link>
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Tournament</h1>
        <p className="mt-2 text-foreground/70 text-sm">
          Single-elimination bracket. Random seed, byes fill the first round if
          needed.
        </p>
        <button
          type="button"
          onClick={() => {
            if (list.items.length < 2) {
              toast.push('Add at least 2 items first.', { kind: 'error' });
              return;
            }
            initBracket(list.id);
            toast.push('Bracket seeded');
          }}
          className="mt-6 rounded-md bg-foreground text-background px-5 py-2.5 font-medium"
          disabled={list.items.length < 2}
        >
          Start tournament
        </button>
      </div>
    );
  }

  const rounds = groupByRound(bracket.matches);
  const champion = bracket.championId ? itemsById.get(bracket.championId) : null;
  const activeRound = findActiveRound(bracket.matches);

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-10">
      <div className="text-sm mb-2">
        <Link href={`/lists/${list.id}`} className="text-foreground/60 hover:text-foreground">
          ← {list.title}
        </Link>
      </div>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Tournament
          </h1>
          <p className="text-sm text-foreground/60 mt-1">
            {rounds.length} rounds · {bracket.matches.length} matches
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (confirm('Reset the bracket? This cannot be undone.')) {
                resetBracket(list.id);
                toast.push('Bracket reset');
              }
            }}
            className="text-sm px-3 py-1.5 rounded-md border border-foreground/20 hover:bg-foreground/5"
          >
            Reset
          </button>
        </div>
      </div>

      {champion && (
        <div className="mb-6 rounded-lg border-2 border-amber-400/80 bg-amber-50 dark:bg-amber-950/30 p-4 text-center">
          <div className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-300">
            Champion
          </div>
          <div className="text-xl font-semibold mt-1">{champion.title}</div>
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {rounds.map((round, i) => (
          <div key={i} className="shrink-0 w-64 sm:w-72">
            <h3 className="text-xs uppercase tracking-wider text-foreground/50 mb-2">
              {roundLabel(i, rounds.length)}
            </h3>
            <ul className="space-y-2">
              {round.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  itemsById={itemsById}
                  active={i === activeRound}
                  onPick={(winnerId) => advanceBracketMatch(list.id, match.id, winnerId)}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchCard({
  match,
  itemsById,
  active,
  onPick,
}: {
  match: BracketMatch;
  itemsById: Map<string, Item>;
  active: boolean;
  onPick: (winnerId: string) => void;
}) {
  const a = match.aId ? itemsById.get(match.aId) : null;
  const b = match.bId ? itemsById.get(match.bId) : null;
  const decided = match.winnerId !== null;
  const interactive = active && !decided && a && b;

  return (
    <li
      className={`rounded-md border text-sm overflow-hidden ${
        decided
          ? 'border-foreground/20 bg-foreground/5'
          : active
            ? 'border-foreground/60'
            : 'border-foreground/10 opacity-70'
      }`}
    >
      <Slot
        item={a}
        isWinner={match.winnerId === match.aId}
        decided={decided}
        onClick={interactive && match.aId ? () => onPick(match.aId!) : undefined}
      />
      <div className="h-px bg-foreground/10" />
      <Slot
        item={b}
        isWinner={match.winnerId === match.bId}
        decided={decided}
        onClick={interactive && match.bId ? () => onPick(match.bId!) : undefined}
      />
    </li>
  );
}

function Slot({
  item,
  isWinner,
  decided,
  onClick,
}: {
  item: Item | null | undefined;
  isWinner: boolean;
  decided: boolean;
  onClick?: () => void;
}) {
  const content = (
    <div className="flex items-center gap-2 px-3 py-2 min-w-0">
      {item?.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt=""
          className="w-6 h-6 rounded object-cover flex-shrink-0"
        />
      )}
      <span
        className={`flex-1 truncate ${
          item ? '' : 'text-foreground/40 italic'
        } ${isWinner ? 'font-semibold' : ''}`}
      >
        {item?.title ?? '— bye —'}
      </span>
      {decided && isWinner && (
        <span className="text-xs text-green-700 dark:text-green-400">✓</span>
      )}
    </div>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="w-full text-left hover:bg-foreground/5">
        {content}
      </button>
    );
  }
  return <div>{content}</div>;
}

function groupByRound(matches: BracketMatch[]): BracketMatch[][] {
  const out: BracketMatch[][] = [];
  for (const m of matches) {
    if (!out[m.round]) out[m.round] = [];
    out[m.round].push(m);
  }
  return out;
}

function findActiveRound(matches: BracketMatch[]): number {
  for (const m of matches) {
    if (m.winnerId === null && m.aId && m.bId) return m.round;
  }
  // All decided or waiting on byes.
  return matches.length > 0 ? matches[matches.length - 1].round : 0;
}

function roundLabel(index: number, total: number) {
  const fromEnd = total - 1 - index;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Semifinals';
  if (fromEnd === 2) return 'Quarterfinals';
  return `Round ${index + 1}`;
}
