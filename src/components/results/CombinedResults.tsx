'use client';

import { useMemo, useState } from 'react';
import {
  combineRankings,
  DEFAULT_WEIGHTS,
  type Mode,
  type ModeWeights,
} from '@/lib/ranking/combined';
import type { RankList } from '@/lib/types';

const MODE_LABEL: Record<Mode, string> = {
  pairwise: 'A vs B',
  rate: 'Rate 1–10',
  tier: 'Tier',
  bracket: 'Bracket',
};

const MODE_SHORT: Record<Mode, string> = {
  pairwise: 'AvB',
  rate: '1-10',
  tier: 'Tier',
  bracket: 'Brkt',
};

export function CombinedResults({ list }: { list: RankList }) {
  const [weights, setWeights] = useState<ModeWeights>(DEFAULT_WEIGHTS);

  const results = useMemo(() => combineRankings(list, weights), [list, weights]);
  const itemsById = useMemo(
    () => new Map(list.items.map((i) => [i.id, i])),
    [list.items],
  );

  const anyPairwise = list.comparisons.length > 0;
  const anyRate = Object.keys(list.directRatings).length > 0;
  const anyTier = Object.keys(list.tierAssignments).length > 0;
  const anyBracket = Boolean(list.bracket);
  const totalAvailable =
    (anyPairwise ? 1 : 0) + (anyRate ? 1 : 0) + (anyTier ? 1 : 0) + (anyBracket ? 1 : 0);

  if (list.items.length === 0) {
    return <p className="text-foreground/60">Add items to see a ranking.</p>;
  }

  if (totalAvailable === 0) {
    return (
      <div className="text-sm text-foreground/60">
        No rankings recorded yet. Use any of the four modes below to build a
        combined score.
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-lg border border-foreground/10 bg-foreground/5 p-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-medium uppercase tracking-wider text-foreground/60">
            Signal weights
          </h3>
          <button
            type="button"
            onClick={() => setWeights(DEFAULT_WEIGHTS)}
            className="text-xs text-foreground/60 hover:text-foreground underline"
          >
            Reset
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {(['pairwise', 'rate', 'tier', 'bracket'] as Mode[]).map((mode) => {
            const available =
              mode === 'pairwise'
                ? anyPairwise
                : mode === 'rate'
                  ? anyRate
                  : mode === 'tier'
                    ? anyTier
                    : anyBracket;
            return (
              <label
                key={mode}
                className={`flex items-center gap-2 text-sm ${
                  available ? '' : 'opacity-50'
                }`}
                title={available ? undefined : 'No data in this mode yet.'}
              >
                <span className="w-16 shrink-0">{MODE_LABEL[mode]}</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={weights[mode]}
                  onChange={(e) =>
                    setWeights((w) => ({
                      ...w,
                      [mode]: Number(e.target.value),
                    }))
                  }
                  disabled={!available}
                  className="flex-1 min-w-0"
                />
                <span className="w-10 text-right tabular-nums text-foreground/60">
                  {weights[mode].toFixed(2)}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <ol className="divide-y divide-foreground/10 rounded-md border border-foreground/15 overflow-hidden">
        {results.map((r, i) => {
          const item = itemsById.get(r.itemId);
          if (!item) return null;
          return (
            <li
              key={r.itemId}
              className="flex items-center gap-3 px-3 py-2.5 text-sm"
            >
              <span className="w-6 text-right tabular-nums text-foreground/50">
                {i + 1}
              </span>
              <span className="flex-1 min-w-0">
                <div className="truncate">{item.title}</div>
                <div className="flex gap-1 mt-0.5 flex-wrap">
                  {(['pairwise', 'rate', 'tier', 'bracket'] as Mode[]).map((mode) => {
                    const sig = r.signals[mode];
                    if (sig === undefined) return null;
                    return (
                      <span
                        key={mode}
                        className="text-[10px] px-1.5 py-px rounded bg-foreground/10 text-foreground/60 tabular-nums"
                        title={`${MODE_LABEL[mode]}: ${sig.toFixed(2)}`}
                      >
                        {MODE_SHORT[mode]} {sig.toFixed(2)}
                      </span>
                    );
                  })}
                </div>
              </span>
              <span
                className={`tabular-nums font-medium w-12 text-right ${
                  r.score === null ? 'text-foreground/40' : ''
                }`}
              >
                {r.score === null ? '—' : r.score.toFixed(3)}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-foreground/50 mt-3">
        Each mode normalizes to [0, 1]. Items are scored only from modes with
        data for them — no penalty for unrated modes.
      </p>
    </div>
  );
}
