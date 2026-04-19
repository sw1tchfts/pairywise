'use client';

import { useMemo, useState } from 'react';
import { rank, rankElo } from '@/lib/ranking';
import type { Algorithm, RankList } from '@/lib/types';
import { AlgorithmToggle } from '@/components/AlgorithmToggle';
import { Leaderboard } from '@/components/Leaderboard';
import { RatingHistoryChart } from '@/components/RatingHistoryChart';
import { HardestChoices } from '@/components/HardestChoices';
import { useStore } from '@/lib/store';

export function PairwiseResults({ list }: { list: RankList }) {
  const setAlgorithmDefault = useStore((s) => s.setAlgorithmDefault);
  const [algorithm, setAlgorithm] = useState<Algorithm>(list.algorithmDefault ?? 'elo');

  const rankings = useMemo(
    () => rank(algorithm, list.items, list.comparisons),
    [algorithm, list],
  );
  const eloRankings = useMemo(
    () => rankElo(list.items, list.comparisons),
    [list],
  );

  if (list.items.length === 0) {
    return <p className="text-foreground/60">Add items to see a ranking.</p>;
  }

  if (list.comparisons.length === 0) {
    return (
      <div className="text-sm text-foreground/60">
        No pairwise votes yet. Head to{' '}
        <a className="underline" href={`/lists/${list.id}/vote`}>
          A vs B voting
        </a>{' '}
        to build a pairwise ranking.
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <AlgorithmToggle
          value={algorithm}
          onChange={(a) => {
            setAlgorithm(a);
            setAlgorithmDefault(list.id, a);
          }}
        />
      </div>
      <Leaderboard
        items={list.items}
        rankings={rankings}
        scoreLabel={algorithm === 'elo' ? 'ELO' : 'log-strength'}
      />
      <div className="mt-6">
        <RatingHistoryChart items={list.items} rankings={eloRankings} />
      </div>
      <HardestChoices list={list} rankings={eloRankings} />
      <p className="mt-6 text-xs text-foreground/50">
        {algorithm === 'elo'
          ? 'ELO updates ratings after each comparison. Works with partial data.'
          : 'Bradley-Terry computes maximum-likelihood strengths from all comparisons.'}
      </p>
    </>
  );
}
