'use client';

import Link from 'next/link';
import type { Comparison, Item, RankList } from '@/lib/types';
import type { EloResult } from '@/lib/ranking/elo';

type Props = {
  list: RankList;
  rankings: EloResult[];
};

type PairStats = {
  a: Item;
  b: Item;
  aWins: number;
  bWins: number;
  ratingGap: number;
  flipRate: number;
};

export function HardestChoices({ list, rankings }: Props) {
  const ratings = new Map(rankings.map((r) => [r.itemId, r.score]));
  const itemsById = new Map(list.items.map((i) => [i.id, i]));

  const pairStats = collectPairs(list.items, list.comparisons, ratings, itemsById);
  if (pairStats.length === 0) return null;

  const closest = [...pairStats]
    .filter((p) => p.aWins + p.bWins >= 1)
    .sort((a, b) => a.ratingGap - b.ratingGap)
    .slice(0, 5);

  const flipped = pairStats
    .filter((p) => p.aWins > 0 && p.bWins > 0)
    .sort((a, b) => b.flipRate - a.flipRate || b.aWins + b.bWins - (a.aWins + a.bWins))
    .slice(0, 5);

  if (closest.length === 0 && flipped.length === 0) return null;

  return (
    <section className="mt-6 rounded-lg border border-black/10 dark:border-white/10 p-3 sm:p-4">
      <h3 className="text-sm font-medium mb-3">Hardest choices</h3>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <h4 className="text-xs uppercase tracking-wider text-foreground/50 mb-2">
            Closest in rating
          </h4>
          {closest.length === 0 ? (
            <p className="text-xs text-foreground/60">Not enough votes yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {closest.map((p) => (
                <PairRow key={`${p.a.id}-${p.b.id}`} p={p} list={list} />
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4 className="text-xs uppercase tracking-wider text-foreground/50 mb-2">
            You&apos;ve flipped on
          </h4>
          {flipped.length === 0 ? (
            <p className="text-xs text-foreground/60">
              Each pair has a clear winner so far.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {flipped.map((p) => (
                <PairRow key={`${p.a.id}-${p.b.id}`} p={p} list={list} showFlip />
              ))}
            </ul>
          )}
        </div>
      </div>
      <p className="mt-3 text-[11px] text-foreground/50">
        <Link href={`/lists/${list.id}/vote`} className="hover:text-foreground hover:underline">
          Revisit these pairs →
        </Link>
      </p>
    </section>
  );
}

function PairRow({
  p,
  list,
  showFlip,
}: {
  p: PairStats;
  list: RankList;
  showFlip?: boolean;
}) {
  const total = p.aWins + p.bWins;
  return (
    <li className="text-xs rounded-md border border-black/10 dark:border-white/10 px-2 py-1.5">
      <div className="flex items-center gap-2">
        <span className="truncate max-w-[45%] font-medium">{p.a.title}</span>
        <span className="text-foreground/40">vs</span>
        <span className="truncate max-w-[45%] font-medium">{p.b.title}</span>
      </div>
      <div className="text-[11px] text-foreground/60 mt-0.5 flex items-center justify-between">
        <span>
          {p.aWins}–{p.bWins} · gap {Math.round(p.ratingGap)}
        </span>
        {showFlip && total > 0 && (
          <span>{Math.round(p.flipRate * 100)}% swing</span>
        )}
      </div>
      <Link
        href={`/lists/${list.id}/vote`}
        aria-label="Vote again"
        className="sr-only"
      >
        Vote again
      </Link>
    </li>
  );
}

function collectPairs(
  items: Item[],
  comparisons: Comparison[],
  ratings: Map<string, number>,
  itemsById: Map<string, Item>,
): PairStats[] {
  const counts = new Map<string, { aId: string; bId: string; aWins: number; bWins: number }>();
  for (const c of comparisons) {
    if (c.skipped) continue;
    const [x, y] = [c.winnerId, c.loserId].sort();
    const key = `${x}|${y}`;
    const bucket = counts.get(key) ?? { aId: x, bId: y, aWins: 0, bWins: 0 };
    if (c.winnerId === x) bucket.aWins++;
    else bucket.bWins++;
    counts.set(key, bucket);
  }

  void items;
  const out: PairStats[] = [];
  for (const { aId, bId, aWins, bWins } of counts.values()) {
    const a = itemsById.get(aId);
    const b = itemsById.get(bId);
    if (!a || !b) continue;
    const ra = ratings.get(aId) ?? 0;
    const rb = ratings.get(bId) ?? 0;
    const minor = Math.min(aWins, bWins);
    const total = aWins + bWins;
    out.push({
      a,
      b,
      aWins,
      bWins,
      ratingGap: Math.abs(ra - rb),
      flipRate: total === 0 ? 0 : minor / total,
    });
  }
  return out;
}
