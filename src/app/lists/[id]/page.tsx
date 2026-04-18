'use client';

import { use } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { ItemPicker } from '@/components/ItemPicker';

type Params = { id: string };

export default function ListDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = use(params);
  const list = useStore((s) => s.lists[id]);
  const addItem = useStore((s) => s.addItem);
  const removeItem = useStore((s) => s.removeItem);

  if (!list) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10 text-center">
        <p className="text-foreground/70">List not found.</p>
        <Link href="/" className="mt-4 inline-block rounded-md bg-foreground text-background px-4 py-2">
          Back home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-2 text-sm">
        <Link href="/" className="text-foreground/60 hover:text-foreground">
          ← All lists
        </Link>
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">{list.title}</h1>
      {list.description && (
        <p className="mt-1 text-foreground/70">{list.description}</p>
      )}

      <div className="mt-6 flex items-center gap-3 flex-wrap">
        <Link
          href={`/lists/${list.id}/vote`}
          className={`rounded-md px-4 py-2 font-medium text-sm ${
            list.items.length < 2
              ? 'bg-foreground/20 text-foreground/50 pointer-events-none'
              : 'bg-foreground text-background'
          }`}
        >
          Start voting
        </Link>
        <Link
          href={`/lists/${list.id}/results`}
          className="rounded-md px-4 py-2 font-medium text-sm border border-foreground/20 hover:bg-foreground/5"
        >
          View results
        </Link>
        <span className="text-sm text-foreground/60 ml-auto">
          {list.items.length} items · {list.comparisons.length} votes
        </span>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold mb-3">Add items</h2>
        <ItemPicker onAdd={(item) => addItem(list.id, item)} />
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold mb-3">Items</h2>
        {list.items.length === 0 ? (
          <p className="text-sm text-foreground/60">No items yet.</p>
        ) : (
          <ul className="grid gap-2">
            {list.items.map((item) => (
              <li
                key={item.id}
                className="group flex items-center gap-3 rounded-md border border-black/10 dark:border-white/10 p-2"
              >
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="w-10 h-10 rounded object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded bg-foreground/10 flex items-center justify-center text-xs text-foreground/50">
                    {item.type.slice(0, 3)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{item.label}</div>
                  {item.description && (
                    <div className="text-xs text-foreground/60 truncate">
                      {item.description}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(list.id, item.id)}
                  className="text-xs px-2 py-1 rounded text-red-600 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-950/40"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
