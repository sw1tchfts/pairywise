'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { TIERS, type Tier, type Item } from '@/lib/types';
import { useToast } from '@/components/Toaster';
import { ModeSwitcher } from '@/components/ModeSwitcher';

const DRAG_MIME = 'application/x-pairywise-item';

type Params = { id: string };

const TIER_COLORS: Record<Tier, string> = {
  S: 'bg-red-500/90 text-white',
  A: 'bg-orange-500/90 text-white',
  B: 'bg-yellow-500/90 text-black',
  C: 'bg-green-600/90 text-white',
  D: 'bg-blue-600/90 text-white',
};

export default function TiersPage({ params }: { params: Promise<Params> }) {
  const { id } = use(params);
  const list = useStore((s) => s.lists[id]);
  const setTier = useStore((s) => s.setTier);
  const clearTiers = useStore((s) => s.clearTiers);
  const toast = useToast();

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

  const assignments = list.tierAssignments ?? {};
  const byTier: Record<Tier | 'unranked', Item[]> = {
    S: [],
    A: [],
    B: [],
    C: [],
    D: [],
    unranked: [],
  };
  for (const item of list.items) {
    const t = assignments[item.id];
    if (t && TIERS.includes(t)) byTier[t].push(item);
    else byTier.unranked.push(item);
  }

  const placed = list.items.length - byTier.unranked.length;

  return (
    <>
      <ModeSwitcher
        listId={list.id}
        listTitle={list.title}
        current="tiers"
        itemCount={list.items.length}
      />
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Tier list</h1>
          <p className="text-sm text-foreground/60 mt-1">
            {list.items.length === 0
              ? 'Add items to the list, then drag or tap to place them.'
              : `Drag or tap an item to change its tier. ${placed} / ${list.items.length} placed.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (confirm('Clear all tier placements?')) {
                clearTiers(list.id);
                toast.push('Cleared tiers');
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

      <div className="space-y-2">
        {TIERS.map((tier) => (
          <TierRow
            key={tier}
            tier={tier}
            items={byTier[tier]}
            onChange={(itemId, next) => setTier(list.id, itemId, next)}
          />
        ))}
      </div>

      <UnrankedSection
        items={byTier.unranked}
        onDropUnrank={(itemId) => setTier(list.id, itemId, null)}
        onChange={(itemId, next) => setTier(list.id, itemId, next)}
      />
    </div>
    </>
  );
}

function TierRow({
  tier,
  items,
  onChange,
}: {
  tier: Tier;
  items: Item[];
  onChange: (itemId: string, next: Tier | null) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={`flex items-stretch rounded-md border overflow-hidden transition-colors ${
        over
          ? 'border-foreground shadow-[0_0_0_2px_var(--tw-ring-color)] ring-foreground/20'
          : 'border-black/10 dark:border-white/10'
      }`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(DRAG_MIME)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (!over) setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        const id = e.dataTransfer.getData(DRAG_MIME);
        if (id) {
          e.preventDefault();
          onChange(id, tier);
        }
        setOver(false);
      }}
    >
      <div
        className={`flex items-center justify-center w-12 sm:w-14 font-bold text-xl ${TIER_COLORS[tier]}`}
      >
        {tier}
      </div>
      <ul className="flex-1 p-2 flex flex-wrap gap-1.5 min-h-[56px] bg-foreground/5">
        {items.length === 0 ? (
          <li className="text-xs text-foreground/50 self-center">
            Drag or tap items here
          </li>
        ) : (
          items.map((item) => (
            <ItemChip key={item.id} item={item} onChange={(next) => onChange(item.id, next)} />
          ))
        )}
      </ul>
    </div>
  );
}

function UnrankedSection({
  items,
  onDropUnrank,
  onChange,
}: {
  items: Item[];
  onDropUnrank: (itemId: string) => void;
  onChange: (itemId: string, next: Tier | null) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <section
      className={`mt-6 rounded-md border border-dashed transition-colors p-3 ${
        over ? 'border-foreground bg-foreground/5' : 'border-foreground/20'
      }`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(DRAG_MIME)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (!over) setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        const id = e.dataTransfer.getData(DRAG_MIME);
        if (id) {
          e.preventDefault();
          onDropUnrank(id);
        }
        setOver(false);
      }}
    >
      <h2 className="text-sm font-medium mb-2 text-foreground/70">
        Unranked ({items.length})
      </h2>
      {items.length === 0 ? (
        <p className="text-xs text-foreground/50">
          Everything is placed. Drag anything back here to unrank it.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <ItemChip
              key={item.id}
              item={item}
              onChange={(next) => onChange(item.id, next)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ItemChip({
  item,
  onChange,
}: {
  item: Item;
  onChange: (next: Tier | null) => void;
}) {
  return (
    <li className="relative group">
      <details className="list-none">
        <summary
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(DRAG_MIME, item.id);
            e.dataTransfer.effectAllowed = 'move';
          }}
          className="cursor-grab active:cursor-grabbing list-none text-xs rounded-md bg-background border border-foreground/20 px-2 py-1 flex items-center gap-1.5 hover:border-foreground/40"
          aria-label={`${item.title} — drag to a tier or tap to pick one`}
        >
          {item.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt="" className="w-4 h-4 rounded object-cover" />
          )}
          <span className="truncate max-w-[140px]">{item.title}</span>
        </summary>
        <div className="absolute left-0 top-full mt-1 z-10 rounded-md border border-foreground/20 bg-background shadow-lg p-1 flex gap-0.5">
          {TIERS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChange(t)}
              className={`w-6 h-6 rounded font-bold text-xs ${TIER_COLORS[t]}`}
            >
              {t}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onChange(null)}
            className="w-6 h-6 rounded font-bold text-xs border border-foreground/20 bg-background"
            aria-label="Unrank"
          >
            ×
          </button>
        </div>
      </details>
    </li>
  );
}
