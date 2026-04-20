'use client';

import { useMemo, useState } from 'react';
import { rank, rankElo } from '@/lib/ranking';
import type { Algorithm, RankList } from '@/lib/types';
import { AlgorithmToggle } from '@/components/AlgorithmToggle';
import { Leaderboard } from '@/components/Leaderboard';
import { RatingHistoryChart } from '@/components/RatingHistoryChart';
import { HardestChoices } from '@/components/HardestChoices';
import { HeadToHeadDialog } from '@/components/HeadToHeadDialog';
import { useStore } from '@/lib/store';

export function PairwiseResults({ list }: { list: RankList }) {
  const setAlgorithmDefault = useStore((s) => s.setAlgorithmDefault);
  const [algorithm, setAlgorithm] = useState<Algorithm>(list.algorithmDefault ?? 'elo');
  const [h2hItemId, setH2hItemId] = useState<string | null>(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

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
        onItemClick={(id) => setH2hItemId(id)}
      />
      <p className="mt-2 text-xs text-foreground/50">
        Tap any row for the head-to-head record.
      </p>
      <HeadToHeadDialog
        list={list}
        itemId={h2hItemId}
        onClose={() => setH2hItemId(null)}
      />

      <div className="mt-5">
        <button
          type="button"
          onClick={() => setAnalyticsOpen((v) => !v)}
          aria-expanded={analyticsOpen}
          className="w-full flex items-center justify-between rounded-md border border-foreground/15 px-3 py-2 text-sm hover:bg-foreground/5"
        >
          <span className="font-medium">Show analytics</span>
          <span aria-hidden className={`transition-transform ${analyticsOpen ? 'rotate-180' : ''}`}>
            ▾
          </span>
        </button>
        {analyticsOpen && (
          <div className="mt-3 space-y-4">
            <RatingHistoryChart items={list.items} rankings={eloRankings} />
            <HardestChoices list={list} rankings={eloRankings} />
            <p className="text-xs text-foreground/50">
              {algorithm === 'elo'
                ? 'ELO updates ratings after each comparison. Works with partial data.'
                : 'Bradley-Terry computes maximum-likelihood strengths from all comparisons.'}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
