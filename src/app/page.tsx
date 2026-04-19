'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { useToast } from '@/components/Toaster';
import { downloadJSON, exportList, parseImport, slugify } from '@/lib/io';
import { useCurrentUserId } from '@/lib/supabase/useCurrentUser';
import { summarize, timeAgo } from '@/lib/listSummary';
import { profileLabel, useProfiles } from '@/lib/cloud/useProfiles';
import type { RankList } from '@/lib/types';

type SortKey = 'recent' | 'votes' | 'alpha';
type OwnerFilter = 'all' | 'mine' | 'shared';

export default function HomePage() {
  const lists = useStore((s) => s.lists);
  const order = useStore((s) => s.order);
  const deleteList = useStore((s) => s.deleteList);
  const duplicateList = useStore((s) => s.duplicateList);
  const importList = useStore((s) => s.importList);
  const currentUserId = useCurrentUserId();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('all');
  const [activeTag, setActiveTag] = useState<string | null>(null);

  async function handleImportFile(file: File) {
    try {
      const text = await file.text();
      const parsed = parseImport(JSON.parse(text));
      const newId = importList(parsed);
      toast.push(`Imported "${parsed.title}"`, { kind: 'success' });
      return newId;
    } catch (err) {
      toast.push(
        err instanceof Error ? err.message : 'Could not import file.',
        { kind: 'error' },
      );
      return null;
    }
  }

  const allLists = useMemo(
    () => order.map((id) => lists[id]).filter((l): l is RankList => Boolean(l)),
    [order, lists],
  );

  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const l of allLists) for (const t of l.tags) s.add(t);
    return Array.from(s).sort();
  }, [allLists]);

  const hasShared = useMemo(
    () => allLists.some((l) => l.ownerId && l.ownerId !== currentUserId),
    [allLists, currentUserId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allLists.filter((l) => {
      if (activeTag && !l.tags.includes(activeTag)) return false;
      if (ownerFilter !== 'all') {
        const mine = !l.ownerId || l.ownerId === currentUserId;
        if (ownerFilter === 'mine' && !mine) return false;
        if (ownerFilter === 'shared' && mine) return false;
      }
      if (!q) return true;
      if (l.title.toLowerCase().includes(q)) return true;
      if (l.description?.toLowerCase().includes(q)) return true;
      if (l.tags.some((t) => t.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [allLists, query, activeTag, ownerFilter, currentUserId]);

  const ownerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const l of allLists) {
      if (l.ownerId && l.ownerId !== currentUserId) ids.add(l.ownerId);
    }
    return Array.from(ids);
  }, [allLists, currentUserId]);

  const profiles = useProfiles(ownerIds);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sort) {
      case 'alpha':
        arr.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'votes':
        arr.sort((a, b) => b.comparisons.length - a.comparisons.length);
        break;
      case 'recent':
      default:
        arr.sort(
          (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
        );
        break;
    }
    return arr;
  }, [filtered, sort]);

  if (allLists.length === 0) {
    return (
      <EmptyHero
        onImport={() => fileInput.current?.click()}
        importInput={<ImportInput inputRef={fileInput} onFile={handleImportFile} />}
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-10">
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Your lists
          </h1>
          <p className="mt-1 text-foreground/60 text-sm">
            Create, rank, share.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportInput inputRef={fileInput} onFile={handleImportFile} />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="text-sm px-3 py-1.5 rounded-md border border-foreground/20 hover:bg-foreground/5"
          >
            Import JSON
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search lists…"
          className="input flex-1 min-w-[180px] max-w-[280px]"
          aria-label="Search lists"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="input w-auto"
          aria-label="Sort"
        >
          <option value="recent">Recent</option>
          <option value="votes">Most voted</option>
          <option value="alpha">A–Z</option>
        </select>
        {hasShared && (
          <div className="inline-flex items-center rounded-md border border-foreground/15 p-0.5 bg-foreground/5 text-xs">
            {(['all', 'mine', 'shared'] as OwnerFilter[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setOwnerFilter(k)}
                className={`px-2.5 py-1 rounded font-medium transition ${
                  ownerFilter === k
                    ? 'bg-background shadow-sm'
                    : 'text-foreground/60 hover:text-foreground'
                }`}
              >
                {k === 'all' ? 'All' : k === 'mine' ? 'Mine' : 'Shared'}
              </button>
            ))}
          </div>
        )}
      </div>

      {allTags.length > 0 && (
        <div className="mb-4 flex items-center gap-1.5 flex-wrap">
          <span className="text-xs uppercase tracking-wider text-foreground/50 mr-1">
            Tags
          </span>
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            className={`text-xs px-2 py-0.5 rounded-full border ${
              activeTag === null
                ? 'border-foreground bg-foreground text-background'
                : 'border-foreground/15 hover:border-foreground/40'
            }`}
          >
            all
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTag((prev) => (prev === t ? null : t))}
              className={`text-xs px-2 py-0.5 rounded-full border ${
                activeTag === t
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-foreground/15 hover:border-foreground/40'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed border-foreground/20 p-8 text-center text-sm text-foreground/60">
          No lists match your filters.
        </div>
      ) : (
        <ul className="grid gap-3">
          {sorted.map((list) => {
            const ownedByMe = !list.ownerId || list.ownerId === currentUserId;
            const summary = summarize(list);
            return (
              <li
                key={list.id}
                className="rounded-lg border border-black/10 dark:border-white/10 p-4 hover:border-black/30 dark:hover:border-white/30 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <Link href={`/lists/${list.id}`} className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{list.title}</span>
                      {!ownedByMe && (
                        <span className="shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-foreground/10 text-foreground/70 font-semibold">
                          {list.ownerId
                            ? `Shared by ${profileLabel(profiles.get(list.ownerId), list.ownerId)}`
                            : 'Shared'}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-foreground/50 mt-0.5">
                      {list.items.length} items ·{' '}
                      {summary.pairsTotal > 0
                        ? `${summary.pairsDone} / ${summary.pairsTotal} pairs`
                        : `${summary.pairsDone} votes`}
                      {summary.lastActivity > 0 && (
                        <> · {timeAgo(summary.lastActivity)}</>
                      )}
                      {list.tags.length > 0 && <> · {list.tags.join(', ')}</>}
                    </div>
                    {summary.topItems.length > 0 && (
                      <ol className="mt-2 flex flex-wrap gap-1.5 text-xs">
                        {summary.topItems.map((t, i) => (
                          <li
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-foreground/5 border border-foreground/10"
                          >
                            <span className="text-foreground/40 tabular-nums">
                              {i + 1}.
                            </span>
                            <span className="truncate max-w-[180px]">
                              {t.title}
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}
                    {summary.pairsTotal > 0 && (
                      <div className="mt-2 h-1 rounded-full bg-foreground/10 overflow-hidden">
                        <div
                          className="h-full bg-foreground/60"
                          style={{ width: `${summary.progress * 100}%` }}
                        />
                      </div>
                    )}
                  </Link>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        downloadJSON(
                          `${slugify(list.title)}.pairywise.json`,
                          exportList(list),
                        );
                        toast.push(`Exported "${list.title}"`);
                      }}
                      className="text-sm px-3 py-1.5 rounded-md border border-foreground/20 hover:bg-foreground/5"
                    >
                      Export
                    </button>
                    {ownedByMe && (
                      <button
                        type="button"
                        onClick={() => {
                          duplicateList(list.id);
                          toast.push(`Duplicated "${list.title}"`, {
                            kind: 'success',
                          });
                        }}
                        className="text-sm px-3 py-1.5 rounded-md border border-foreground/20 hover:bg-foreground/5"
                      >
                        Duplicate
                      </button>
                    )}
                    {ownedByMe && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Delete "${list.title}"?`)) {
                            deleteList(list.id);
                            toast.push(`Deleted "${list.title}"`, {
                              kind: 'info',
                            });
                          }
                        }}
                        className="text-sm px-3 py-1.5 rounded-md border border-transparent text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 hover:border-red-200 dark:hover:border-red-900"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ImportInput({
  inputRef,
  onFile,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFile: (file: File) => void;
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept="application/json,.json"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) onFile(file);
        e.target.value = '';
      }}
    />
  );
}

const IDEAS = [
  'Movies you want to watch',
  'Coffee shops in your neighborhood',
  'Songs on your current playlist',
  'Restaurants for date night',
  'Features to build next',
  'Job candidates',
  'Books to read this year',
];

function EmptyHero({
  onImport,
  importInput,
}: {
  onImport: () => void;
  importInput: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12 sm:py-20">
      {importInput}
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
        Rank anything, together.
      </h1>
      <p className="mt-3 text-foreground/70 sm:text-lg">
        Add a list of things — movies, coffee shops, job candidates. Vote
        between pairs, tier them S-to-D, score them 1–10, or run a bracket.
        pairywise combines every signal into a single ranked list.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/lists/new"
          className="rounded-md bg-foreground text-background px-5 py-2.5 font-medium"
        >
          Create your first list
        </Link>
        <button
          type="button"
          onClick={onImport}
          className="rounded-md border border-foreground/20 px-5 py-2.5 font-medium text-sm hover:bg-foreground/5"
        >
          Import JSON
        </button>
      </div>
      <div className="mt-10">
        <p className="text-xs uppercase tracking-wider text-foreground/50 mb-3">
          Ideas to start
        </p>
        <ul className="flex flex-wrap gap-2">
          {IDEAS.map((idea) => (
            <li key={idea}>
              <Link
                href={`/lists/new?title=${encodeURIComponent(idea)}`}
                className="text-sm px-3 py-1.5 rounded-full border border-foreground/15 hover:bg-foreground/5 hover:border-foreground/30"
              >
                {idea}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
