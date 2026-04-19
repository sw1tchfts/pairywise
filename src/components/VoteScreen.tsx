'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { Item, RankList } from '@/lib/types';
import { nextPair, comparisonsRemaining, rankElo } from '@/lib/ranking';
import { useStore } from '@/lib/store';
import { VoteCard } from './VoteCard';
import { useToast } from './Toaster';

type Props = { list: RankList };

export function VoteScreen({ list }: Props) {
  const recordComparison = useStore((s) => s.recordComparison);
  const skipPair = useStore((s) => s.skipPair);
  const undoLastComparison = useStore((s) => s.undoLastComparison);
  const toast = useToast();

  const [nonce, setNonce] = useState(0);

  const ratingsById = useMemo(() => {
    const rs = rankElo(list.items, list.comparisons);
    return new Map(rs.map((r) => [r.itemId, r.rating]));
  }, [list.items, list.comparisons]);

  const pair = useMemo(() => {
    return nextPair(list.items, list.comparisons, {
      strategy: 'informative',
      ratingsById,
    });
    // include nonce so we re-select after each vote even if it matches
  }, [list.items, list.comparisons, ratingsById, nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const remaining = comparisonsRemaining(list.items, list.comparisons);

  function vote(winner: Item, loser: Item) {
    recordComparison(list.id, winner.id, loser.id);
    setNonce((n) => n + 1);
  }

  function skip() {
    if (!pair) return;
    skipPair(list.id, pair[0].id, pair[1].id);
    setNonce((n) => n + 1);
  }

  function undo() {
    const removed = undoLastComparison(list.id);
    setNonce((n) => n + 1);
    if (removed) {
      toast.push(removed.skipped ? 'Skip undone' : 'Vote undone');
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!pair) return;
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === '1') {
        e.preventDefault();
        vote(pair[0], pair[1]);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === '2') {
        e.preventDefault();
        vote(pair[1], pair[0]);
      } else if (e.key === ' ' || e.key === 's') {
        e.preventDefault();
        skip();
      } else if (e.key === 'u' || (e.metaKey && e.key === 'z')) {
        e.preventDefault();
        undo();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair, list.id]);

  if (list.items.length < 2) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10 text-center">
        <p className="text-foreground/70">Add at least 2 items to start voting.</p>
        <Link
          href={`/lists/${list.id}`}
          className="mt-4 inline-block rounded-md bg-foreground text-background px-4 py-2"
        >
          Back to list
        </Link>
      </div>
    );
  }

  const totalDone = list.comparisons.length;
  const estimatedTotal = totalDone + remaining;

  if (!pair) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-foreground/10 text-2xl mb-4">
          ✓
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">All done!</h1>
        <p className="mt-2 text-foreground/70">
          You&apos;ve compared every pair in{' '}
          <span className="font-medium text-foreground">{list.title}</span>.{' '}
          <span className="font-mono">{totalDone}</span> votes total.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
          <Link
            href={`/lists/${list.id}/results`}
            className="rounded-md bg-foreground text-background px-5 py-2.5 font-medium"
          >
            See the ranking →
          </Link>
          <button
            type="button"
            onClick={undo}
            disabled={list.comparisons.length === 0}
            className="rounded-md border border-foreground/20 px-5 py-2.5 text-sm hover:bg-foreground/5 disabled:opacity-40"
          >
            Undo last
          </button>
        </div>
        <p className="mt-8 text-xs text-foreground/50">
          Want to keep refining? Add more items to the list and you&apos;ll get
          new pairs to vote on.
        </p>
        <div className="mt-4">
          <Link
            href={`/lists/${list.id}`}
            className="text-sm text-foreground/60 hover:text-foreground hover:underline"
          >
            ← Back to {list.title}
          </Link>
        </div>
      </div>
    );
  }

  const percent =
    estimatedTotal > 0 ? Math.min(100, (totalDone / estimatedTotal) * 100) : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <Link
            href={`/lists/${list.id}`}
            className="text-sm text-foreground/60 hover:text-foreground truncate block"
          >
            ← {list.title}
          </Link>
          <h1 className="text-xl sm:text-2xl font-semibold mt-1">
            Which do you prefer?
          </h1>
        </div>
        <div className="text-right text-sm text-foreground/70 shrink-0">
          <div>
            <span className="font-mono">{totalDone}</span>
            {estimatedTotal > totalDone && (
              <span className="text-foreground/50"> / {estimatedTotal}</span>
            )}{' '}
            votes
          </div>
          <Link
            href={`/lists/${list.id}/results`}
            className="text-xs text-foreground/60 hover:text-foreground hover:underline"
          >
            View results →
          </Link>
        </div>
      </div>

      {estimatedTotal > 0 && (
        <div
          role="progressbar"
          aria-valuenow={totalDone}
          aria-valuemin={0}
          aria-valuemax={estimatedTotal}
          className="h-1 rounded-full bg-foreground/10 mb-6 overflow-hidden"
        >
          <div
            className="h-full bg-foreground transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      <SwipeArea
        onSwipeLeft={() => vote(pair[1], pair[0])}
        onSwipeRight={() => vote(pair[0], pair[1])}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <VoteCard item={pair[0]} onSelect={() => vote(pair[0], pair[1])} hotkeyLabel="←" />
          <VoteCard item={pair[1]} onSelect={() => vote(pair[1], pair[0])} hotkeyLabel="→" />
        </div>
      </SwipeArea>
      <p className="mt-3 text-center text-xs text-foreground/50 md:hidden">
        Tip: swipe right to pick the top card, left for the bottom
      </p>

      <div className="mt-6 flex items-center justify-center gap-3 text-sm">
        <button
          type="button"
          onClick={skip}
          className="px-4 py-2.5 rounded-md border border-foreground/20 hover:bg-foreground/5"
        >
          Skip
          <kbd className="ml-1.5 text-[11px] font-mono opacity-60 hidden sm:inline">
            Space
          </kbd>
        </button>
        <button
          type="button"
          onClick={undo}
          disabled={list.comparisons.length === 0}
          className="px-4 py-2.5 rounded-md border border-foreground/20 hover:bg-foreground/5 disabled:opacity-40"
        >
          Undo
          <kbd className="ml-1.5 text-[11px] font-mono opacity-60 hidden sm:inline">
            U
          </kbd>
        </button>
      </div>
    </div>
  );
}

function SwipeArea({
  children,
  onSwipeLeft,
  onSwipeRight,
}: {
  children: React.ReactNode;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType !== 'touch') return;
    const el = e.target as HTMLElement | null;
    if (el && el.closest('video, audio, a')) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
  }

  function onPointerUp(e: React.PointerEvent) {
    if (e.pointerType !== 'touch') return;
    if (startX.current === null || startY.current === null) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    startX.current = null;
    startY.current = null;
    const THRESHOLD = 60;
    if (Math.abs(dx) > THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.3) {
      if (dx > 0) onSwipeRight();
      else onSwipeLeft();
    }
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        startX.current = null;
        startY.current = null;
      }}
      className="touch-pan-y"
    >
      {children}
    </div>
  );
}
