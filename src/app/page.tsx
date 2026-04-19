'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { useToast } from '@/components/Toaster';
import { downloadJSON, exportList, parseImport, slugify } from '@/lib/io';
import { useCurrentUserId } from '@/lib/supabase/useCurrentUser';

export default function HomePage() {
  const lists = useStore((s) => s.lists);
  const order = useStore((s) => s.order);
  const deleteList = useStore((s) => s.deleteList);
  const duplicateList = useStore((s) => s.duplicateList);
  const importList = useStore((s) => s.importList);
  const currentUserId = useCurrentUserId();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

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

  if (order.length === 0) {
    return <EmptyHero onImport={() => fileInput.current?.click()} importInput={<ImportInput ref={fileInput} onFile={handleImportFile} />} />;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-10">
      <div className="mb-6 sm:mb-8 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Your lists</h1>
          <p className="mt-1 text-foreground/60 text-sm sm:text-base">
            Create, rank, share.
          </p>
        </div>
        <div>
          <ImportInput ref={fileInput} onFile={handleImportFile} />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="text-sm px-3 py-1.5 rounded-md border border-foreground/20 hover:bg-foreground/5"
          >
            Import JSON
          </button>
        </div>
      </div>
      <ul className="grid gap-3">
        {order.map((id) => {
          const list = lists[id];
          if (!list) return null;
          const ownedByMe = !list.ownerId || list.ownerId === currentUserId;
          return (
            <li
              key={id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-black/10 dark:border-white/10 p-4 hover:border-black/30 dark:hover:border-white/30 transition"
            >
              <Link href={`/lists/${id}`} className="flex-1 min-w-0">
                <div className="font-medium truncate flex items-center gap-2">
                  <span className="truncate">{list.title}</span>
                  {!ownedByMe && (
                    <span className="shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-foreground/10 text-foreground/70 font-semibold">
                      Shared
                    </span>
                  )}
                </div>
                <div className="text-sm text-foreground/60 mt-0.5">
                  {list.items.length} items · {list.comparisons.length} votes
                  {list.tags.length > 0 && ` · ${list.tags.join(', ')}`}
                </div>
              </Link>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    downloadJSON(`${slugify(list.title)}.pairywise.json`, exportList(list));
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
                      duplicateList(id);
                      toast.push(`Duplicated "${list.title}"`, { kind: 'success' });
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
                        deleteList(id);
                        toast.push(`Deleted "${list.title}"`, { kind: 'info' });
                      }
                    }}
                    className="text-sm px-3 py-1.5 rounded-md border border-transparent text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 hover:border-red-200 dark:hover:border-red-900"
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ImportInput({
  ref,
  onFile,
}: {
  ref: React.RefObject<HTMLInputElement | null>;
  onFile: (file: File) => void;
}) {
  return (
    <input
      ref={ref}
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
