'use client';

import Link from 'next/link';
import { TIERS, type RankList, type Tier } from '@/lib/types';

const TIER_COLORS: Record<Tier, string> = {
  S: 'bg-red-500/90 text-white',
  A: 'bg-orange-500/90 text-white',
  B: 'bg-yellow-500/90 text-black',
  C: 'bg-green-600/90 text-white',
  D: 'bg-blue-600/90 text-white',
};

export function TierResults({ list }: { list: RankList }) {
  const assigned = Object.keys(list.tierAssignments).length;
  if (assigned === 0) {
    return (
      <div className="text-sm text-foreground/60">
        No tier assignments yet.{' '}
        <Link className="underline" href={`/lists/${list.id}/tiers`}>
          Open the tier editor
        </Link>{' '}
        to place items.
      </div>
    );
  }

  const byTier: Record<Tier, string[]> = { S: [], A: [], B: [], C: [], D: [] };
  for (const [itemId, tier] of Object.entries(list.tierAssignments)) {
    byTier[tier].push(itemId);
  }
  const itemById = new Map(list.items.map((it) => [it.id, it]));
  const unranked = list.items.filter((it) => !list.tierAssignments[it.id]);

  return (
    <div className="space-y-2">
      {TIERS.map((tier) => {
        const ids = byTier[tier];
        return (
          <div key={tier} className="flex items-stretch gap-2">
            <div
              className={`w-12 shrink-0 grid place-items-center text-lg font-bold rounded-md ${TIER_COLORS[tier]}`}
            >
              {tier}
            </div>
            <div className="flex-1 min-h-[52px] flex flex-wrap gap-2 p-2 rounded-md bg-foreground/5 border border-foreground/10">
              {ids.length === 0 && (
                <span className="text-xs text-foreground/40 self-center">
                  (empty)
                </span>
              )}
              {ids.map((id) => {
                const item = itemById.get(id);
                if (!item) return null;
                return (
                  <div
                    key={id}
                    className="px-2.5 py-1 rounded border border-foreground/15 bg-background text-sm"
                  >
                    {item.title}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {unranked.length > 0 && (
        <div className="flex items-stretch gap-2">
          <div className="w-12 shrink-0 grid place-items-center text-xs font-medium rounded-md bg-foreground/10 text-foreground/60">
            —
          </div>
          <div className="flex-1 min-h-[52px] flex flex-wrap gap-2 p-2 rounded-md bg-foreground/5 border border-dashed border-foreground/20">
            <span className="w-full text-xs text-foreground/50 mb-1">Unranked</span>
            {unranked.map((item) => (
              <div
                key={item.id}
                className="px-2.5 py-1 rounded border border-foreground/15 bg-background text-sm text-foreground/60"
              >
                {item.title}
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="text-xs text-foreground/50 mt-4">
        {assigned} of {list.items.length} items assigned.{' '}
        <Link className="underline" href={`/lists/${list.id}/tiers`}>
          Edit tiers
        </Link>
      </p>
    </div>
  );
}
