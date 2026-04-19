'use client';

import Link from 'next/link';
import { useStore } from '@/lib/store';

export default function HomePage() {
  const lists = useStore((s) => s.lists);
  const order = useStore((s) => s.order);
  const deleteList = useStore((s) => s.deleteList);
  const duplicateList = useStore((s) => s.duplicateList);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-10">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Your lists</h1>
        <p className="mt-1 text-foreground/60 text-sm sm:text-base">
          Create a list of things, vote between pairs, see them ranked.
        </p>
      </div>
      {order.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="grid gap-3">
          {order.map((id) => {
            const list = lists[id];
            if (!list) return null;
            return (
              <li
                key={id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-black/10 dark:border-white/10 p-4 hover:border-black/30 dark:hover:border-white/30 transition"
              >
                <Link href={`/lists/${id}`} className="flex-1 min-w-0">
                  <div className="font-medium truncate">{list.title}</div>
                  <div className="text-sm text-foreground/60 mt-0.5">
                    {list.items.length} items · {list.comparisons.length} votes
                    {list.tags.length > 0 && ` · ${list.tags.join(', ')}`}
                  </div>
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => duplicateList(id)}
                    className="text-sm px-3 py-1.5 rounded-md border border-foreground/20 hover:bg-foreground/5"
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete "${list.title}"?`)) deleteList(id);
                    }}
                    className="text-sm px-3 py-1.5 rounded-md border border-transparent text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 hover:border-red-200 dark:hover:border-red-900"
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-black/20 dark:border-white/20 p-12 text-center">
      <p className="text-foreground/70">No lists yet.</p>
      <Link
        href="/lists/new"
        className="mt-4 inline-block rounded-md bg-foreground text-background px-4 py-2 font-medium"
      >
        Create your first list
      </Link>
    </div>
  );
}
