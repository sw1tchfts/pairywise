'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { rank } from '@/lib/ranking';
import type { Algorithm } from '@/lib/types';
import { AlgorithmToggle } from '@/components/AlgorithmToggle';
import { Leaderboard } from '@/components/Leaderboard';

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
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-2 text-sm">
        <Link href={`/lists/${id}`} className="text-foreground/60 hover:text-foreground">
          ← {list.title}
        </Link>
      </div>
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Leaderboard</h1>
          <p className="text-sm text-foreground/60 mt-1">
            {list.items.length} items · {list.comparisons.length} votes
          </p>
        </div>
        <div className="flex items-center gap-3">
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
        <Leaderboard
          items={list.items}
          rankings={rankings}
          scoreLabel={algorithm === 'elo' ? 'ELO' : 'log-strength'}
        />
      )}
      <p className="mt-6 text-xs text-foreground/50">
        {algorithm === 'elo'
          ? 'ELO updates ratings after each comparison. Works with partial data.'
          : 'Bradley-Terry computes maximum-likelihood strengths from all comparisons.'}
      </p>
    </div>
  );
}
