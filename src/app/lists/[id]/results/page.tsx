'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { CombinedResults } from '@/components/results/CombinedResults';
import { PairwiseResults } from '@/components/results/PairwiseResults';
import { TierResults } from '@/components/results/TierResults';
import { RateResults } from '@/components/results/RateResults';
import { BracketResults } from '@/components/results/BracketResults';
import { ModeSwitcher } from '@/components/ModeSwitcher';

type Params = { id: string };

type Tab = 'combined' | 'pairwise' | 'tier' | 'rate' | 'bracket';
const TABS: { id: Tab; label: string }[] = [
  { id: 'combined', label: 'Combined' },
  { id: 'pairwise', label: 'A vs B' },
  { id: 'rate', label: 'Rate 1–10' },
  { id: 'tier', label: 'Tier' },
  { id: 'bracket', label: 'Bracket' },
];

export default function ResultsPage({ params }: { params: Promise<Params> }) {
  const { id } = use(params);
  const list = useStore((s) => s.lists[id]);
  const [tab, setTab] = useState<Tab>('combined');

  if (!list) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10 text-center">
        <p className="text-foreground/70">List not found.</p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-md bg-foreground text-background px-4 py-2"
        >
          Back home
        </Link>
      </div>
    );
  }

  return (
    <>
      <ModeSwitcher
        listId={list.id}
        listTitle={list.title}
        current="results"
        itemCount={list.items.length}
      />
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Results
          </h1>
          <p className="text-sm text-foreground/60 mt-1">
            {list.items.length} items
          </p>
        </div>
        <a
          href={`/api/share-card?listId=${list.id}`}
          target="_blank"
          rel="noreferrer"
          className="text-sm px-3 py-1.5 rounded-md border border-foreground/20 hover:bg-foreground/5"
        >
          Share as image ↗
        </a>
      </div>

      <nav
        className="flex gap-1 overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 mb-5"
        aria-label="Results views"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-sm rounded-md whitespace-nowrap transition-colors ${
              tab === t.id
                ? 'bg-foreground text-background font-medium'
                : 'text-foreground/60 hover:text-foreground hover:bg-foreground/5'
            }`}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div>
        {tab === 'combined' && <CombinedResults list={list} />}
        {tab === 'pairwise' && <PairwiseResults list={list} />}
        {tab === 'tier' && <TierResults list={list} />}
        {tab === 'rate' && <RateResults list={list} />}
        {tab === 'bracket' && <BracketResults list={list} />}
      </div>
    </div>
    </>
  );
}
