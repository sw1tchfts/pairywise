'use client';

import { use, useMemo } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { useToast } from '@/components/Toaster';
import { ModeSwitcher } from '@/components/ModeSwitcher';
import type { Item } from '@/lib/types';

type Params = { id: string };

export default function RatePage({ params }: { params: Promise<Params> }) {
  const { id } = use(params);
  const list = useStore((s) => s.lists[id]);
  const setDirectRating = useStore((s) => s.setDirectRating);
  const clearDirectRatings = useStore((s) => s.clearDirectRatings);
  const toast = useToast();

  const ordered = useMemo(() => {
    if (!list) return [] as Item[];
    const ratings = list.directRatings ?? {};
    return [...list.items].sort((a, b) => {
      const ra = ratings[a.id] ?? 0;
      const rb = ratings[b.id] ?? 0;
      if (rb !== ra) return rb - ra;
      return a.title.localeCompare(b.title);
    });
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

  const ratings = list.directRatings ?? {};
  const rated = Object.keys(ratings).length;

  return (
    <>
      <ModeSwitcher
        listId={list.id}
        listTitle={list.title}
        current="rate"
        itemCount={list.items.length}
      />
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Rate 1–10</h1>
          <p className="text-sm text-foreground/60 mt-1">
            {list.items.length === 0
              ? 'Add items to the list, then drag each slider to score it.'
              : `Drag to score each item. Sorted live. ${rated} / ${list.items.length} rated.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (confirm('Clear all ratings?')) {
                clearDirectRatings(list.id);
                toast.push('Cleared ratings');
              }
            }}
            className="text-sm px-3 py-1.5 rounded-md border border-foreground/20 hover:bg-foreground/5"
          >
            Clear
          </button>
          <Link
            href={`/lists/${list.id}/results`}
            className="text-sm rounded-md bg-foreground text-background px-3 py-1.5 font-medium"
          >
            Results
          </Link>
        </div>
      </div>

      {list.items.length === 0 ? (
        <p className="text-sm text-foreground/60">No items to rate yet.</p>
      ) : (
        <ul className="grid gap-2">
          {ordered.map((item) => {
            const value = ratings[item.id] ?? 5;
            const set = (v: number) => setDirectRating(list.id, item.id, v);
            const isRated = item.id in ratings;
            return (
              <li
                key={item.id}
                className="rounded-md border border-black/10 dark:border-white/10 p-3"
              >
                <div className="flex items-center gap-3 mb-2">
                  {item.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="w-8 h-8 rounded object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.title}</div>
                  </div>
                  <div
                    className={`font-mono text-sm tabular-nums w-8 text-right ${
                      isRated ? 'text-foreground' : 'text-foreground/40'
                    }`}
                  >
                    {isRated ? value : '—'}
                  </div>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={value}
                  onChange={(e) => set(Number(e.target.value))}
                  aria-label={`Rate ${item.title}`}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-foreground/40 mt-0.5 px-1">
                  <span>1</span>
                  <span>5</span>
                  <span>10</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
    </>
  );
}
