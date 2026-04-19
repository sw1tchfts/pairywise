'use client';

import Link from 'next/link';

export type ModePage = 'vote' | 'tiers' | 'rate' | 'bracket' | 'results';

const MODES: { key: ModePage; label: string; path: string; requiresPair: boolean }[] = [
  { key: 'vote', label: 'A vs B', path: 'vote', requiresPair: true },
  { key: 'tiers', label: 'Tier', path: 'tiers', requiresPair: false },
  { key: 'rate', label: 'Rate', path: 'rate', requiresPair: false },
  { key: 'bracket', label: 'Bracket', path: 'bracket', requiresPair: true },
  { key: 'results', label: 'Results', path: 'results', requiresPair: false },
];

export function ModeSwitcher({
  listId,
  listTitle,
  current,
  itemCount,
}: {
  listId: string;
  listTitle: string;
  current: ModePage;
  itemCount: number;
}) {
  const canPair = itemCount >= 2;
  return (
    <div className="border-b border-foreground/10">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 pt-3 pb-0">
        <div className="mb-2 text-sm">
          <Link
            href={`/lists/${listId}`}
            className="text-foreground/60 hover:text-foreground truncate block"
          >
            ← {listTitle}
          </Link>
        </div>
        <nav
          className="flex gap-1 overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6 pb-0"
          aria-label="Ranking modes"
        >
          {MODES.map((m) => {
            const disabled = m.requiresPair && !canPair;
            const active = m.key === current;
            const cls = active
              ? 'border-foreground text-foreground font-medium'
              : disabled
                ? 'border-transparent text-foreground/30 pointer-events-none'
                : 'border-transparent text-foreground/60 hover:text-foreground hover:border-foreground/30';
            return (
              <Link
                key={m.key}
                href={`/lists/${listId}/${m.path}`}
                aria-current={active ? 'page' : undefined}
                aria-disabled={disabled}
                className={`shrink-0 px-3 py-2 text-sm border-b-2 -mb-px transition-colors whitespace-nowrap ${cls}`}
              >
                {m.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
