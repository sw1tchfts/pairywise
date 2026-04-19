'use client';

import Link from 'next/link';
import type { RankList } from '@/lib/types';

export function RateResults({ list }: { list: RankList }) {
  const rated = Object.keys(list.directRatings).length;
  if (rated === 0) {
    return (
      <div className="text-sm text-foreground/60">
        No 1–10 ratings yet.{' '}
        <Link className="underline" href={`/lists/${list.id}/rate`}>
          Open the rate editor
        </Link>{' '}
        to score items.
      </div>
    );
  }

  const sorted = [...list.items].sort((a, b) => {
    const ra = list.directRatings[a.id];
    const rb = list.directRatings[b.id];
    if (ra === undefined && rb === undefined) return a.title.localeCompare(b.title);
    if (ra === undefined) return 1;
    if (rb === undefined) return -1;
    if (rb !== ra) return rb - ra;
    return a.title.localeCompare(b.title);
  });

  return (
    <div>
      <ol className="divide-y divide-foreground/10 rounded-md border border-foreground/15 overflow-hidden">
        {sorted.map((item, i) => {
          const score = list.directRatings[item.id];
          return (
            <li
              key={item.id}
              className="flex items-center gap-3 px-3 py-2 text-sm"
            >
              <span className="w-6 text-right tabular-nums text-foreground/50">
                {i + 1}
              </span>
              <span className="flex-1 min-w-0 truncate">{item.title}</span>
              <span
                className={`tabular-nums font-medium ${
                  score === undefined ? 'text-foreground/40' : ''
                }`}
              >
                {score === undefined ? '—' : score.toFixed(1)}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-foreground/50 mt-3">
        {rated} of {list.items.length} items rated.{' '}
        <Link className="underline" href={`/lists/${list.id}/rate`}>
          Edit ratings
        </Link>
      </p>
    </div>
  );
}
