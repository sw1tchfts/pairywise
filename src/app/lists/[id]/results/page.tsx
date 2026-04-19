'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { rank, rankElo } from '@/lib/ranking';
import type { Algorithm } from '@/lib/types';
import { AlgorithmToggle } from '@/components/AlgorithmToggle';
import { Leaderboard } from '@/components/Leaderboard';
import { RatingHistoryChart } from '@/components/RatingHistoryChart';
import { HardestChoices } from '@/components/HardestChoices';

type Params = { id: string };

export default function ResultsPage({ params }: { params: Promise<Params> }) {
  const { id } = use(params);
  const list = useStore((s) => s.lists[id]);
  const setAlgorithmDefault = useStore((s) => s.setAlgorithmDefault);

  const [algorithm, setAlgorithm] = useState<Algorithm>(list?.algorithmDefault ?? 'elo');

  const rankings = useMemo(() => {
    if (!list) return [];
    return rank(algorithm, list.items, list.comparisons);
  }, [algorithm, list]);

  const eloRankings = useMemo(() => {
    if (!list) return [];
    return rankElo(list.items, list.comparisons);
  }, [list]);

  if (!list) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10 text-center">
        <p className="text-foreground/70">List not found.</p>
        <Link href="/" className="mt-4 inline-block rounded-md bg-foreground text-background px-4 py-2">
          Back home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-10">
      <div className="mb-2 text-sm">
        <Link href={`/lists/${id}`} className="text-foreground/60 hover:text-foreground truncate block">
          ← {list.title}
        </Link>
      </div>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Leaderboard
          </h1>
          <p className="text-sm text-foreground/60 mt-1">
            {list.items.length} items · {list.comparisons.length} votes
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <AlgorithmToggle
            value={algorithm}
            onChange={(a) => {
              setAlgorithm(a);
              setAlgorithmDefault(list.id, a);
            }}
          />
          <Link
            href={`/lists/${id}/vote`}
            className="text-sm rounded-md bg-foreground text-background px-3 py-1.5 font-medium"
          >
            Keep voting
          </Link>
        </div>
      </div>
      {list.items.length === 0 ? (
        <p className="text-foreground/60">Add items to see a ranking.</p>
      ) : (
        <>
          <Leaderboard
            items={list.items}
            rankings={rankings}
            scoreLabel={algorithm === 'elo' ? 'ELO' : 'log-strength'}
          />
          {list.comparisons.length > 0 && (
            <div className="mt-6">
              <RatingHistoryChart items={list.items} rankings={eloRankings} />
            </div>
          )}
          <HardestChoices list={list} rankings={eloRankings} />
        </>
      )}
      <p className="mt-6 text-xs text-foreground/50">
        {algorithm === 'elo'
          ? 'ELO updates ratings after each comparison. Works with partial data.'
          : 'Bradley-Terry computes maximum-likelihood strengths from all comparisons.'}
      </p>
    </div>
  );
}
