'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import * as api from '@/lib/cloud/api';
import { useStore } from '@/lib/store';
import { useToast } from '@/components/Toaster';
import type { RankList } from '@/lib/types';
import { useCurrentUserId } from '@/lib/supabase/useCurrentUser';
import { errorMessage } from '@/lib/utils';

export default function ArchivedPage() {
  const toast = useToast();
  const hydrate = useStore((s) => s.hydrate);
  const currentUserId = useCurrentUserId();
  const [lists, setLists] = useState<RankList[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await api.fetchAllLists({ includeArchived: true });
        if (cancelled) return;
        setLists(all.filter((l) => Boolean(l.archivedAt)));
      } catch (err) {
        toast.push(errorMessage(err, 'Failed to load.'), {
          kind: 'error',
        });
        if (!cancelled) setLists([]);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Toast is stable from context; ignore.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function restore(l: RankList) {
    setBusy(l.id);
    try {
      await api.restoreList(l.id);
      setLists((cur) => cur?.filter((x) => x.id !== l.id) ?? null);
      await hydrate();
      toast.push(`Restored "${l.title}"`, { kind: 'success' });
    } catch (err) {
      toast.push(errorMessage(err, 'Restore failed.'), {
        kind: 'error',
      });
    } finally {
      setBusy(null);
    }
  }

  async function hardDelete(l: RankList) {
    if (!confirm(`Permanently delete "${l.title}"? This cannot be undone.`)) return;
    setBusy(l.id);
    try {
      await api.deleteList(l.id);
      setLists((cur) => cur?.filter((x) => x.id !== l.id) ?? null);
      toast.push(`Deleted "${l.title}"`, { kind: 'info' });
    } catch (err) {
      toast.push(errorMessage(err, 'Delete failed.'), {
        kind: 'error',
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-10">
      <div className="mb-2 text-sm">
        <Link href="/" className="text-foreground/60 hover:text-foreground">
          ← All lists
        </Link>
      </div>
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
        Archived lists
      </h1>
      <p className="text-sm text-foreground/60 mt-1 mb-6">
        Restore anything you archived, or permanently delete lists you&apos;re
        sure about.
      </p>

      {lists === null ? (
        <p className="text-sm text-foreground/60">Loading…</p>
      ) : lists.length === 0 ? (
        <div className="rounded-lg border border-dashed border-foreground/20 p-8 text-center text-sm text-foreground/60">
          No archived lists.
        </div>
      ) : (
        <ul className="grid gap-3">
          {lists.map((list) => {
            const ownedByMe = !list.ownerId || list.ownerId === currentUserId;
            const isBusy = busy === list.id;
            return (
              <li
                key={list.id}
                className="flex items-center gap-3 rounded-lg border border-foreground/10 p-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{list.title}</div>
                  <div className="text-xs text-foreground/50 mt-0.5">
                    {list.items.length} items · {list.comparisons.length} votes
                    {list.archivedAt && (
                      <> · archived {new Date(list.archivedAt).toLocaleDateString()}</>
                    )}
                  </div>
                </div>
                {ownedByMe ? (
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => restore(list)}
                      disabled={isBusy}
                      className="text-sm px-3 py-1.5 rounded-md border border-foreground/20 hover:bg-foreground/5 disabled:opacity-40"
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      onClick={() => hardDelete(list)}
                      disabled={isBusy}
                      className="text-sm px-3 py-1.5 rounded-md border border-transparent text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 hover:border-red-200 dark:hover:border-red-900 disabled:opacity-40"
                    >
                      Delete forever
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-foreground/40">Read-only</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
