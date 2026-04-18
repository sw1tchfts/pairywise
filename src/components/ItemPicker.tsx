'use client';

import { useState } from 'react';
import type { Item, ItemType } from '@/lib/types';
import { UrlPreviewInput } from './UrlPreviewInput';
import { TmdbSearchInput } from './TmdbSearchInput';

type Props = {
  onAdd: (item: Omit<Item, 'id'>) => void;
  onOpenEditor?: () => void;
};

type Tab = ItemType | 'manual';

export function ItemPicker({ onAdd, onOpenEditor }: Props) {
  const [tab, setTab] = useState<Tab>('manual');
  const [text, setText] = useState('');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'manual', label: 'Quick add' },
    { key: 'url', label: 'From URL' },
    { key: 'tmdb', label: 'Movie/TV' },
  ];

  return (
    <div className="rounded-lg border border-black/10 dark:border-white/10 p-4">
      <div className="flex items-center gap-1 mb-4 border-b border-black/10 dark:border-white/10">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm font-medium -mb-px border-b-2 ${
              tab === t.key
                ? 'border-foreground text-foreground'
                : 'border-transparent text-foreground/60 hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
        {onOpenEditor && (
          <button
            type="button"
            onClick={onOpenEditor}
            className="ml-auto text-sm px-3 py-1.5 rounded-md border border-foreground/20 hover:bg-foreground/5"
          >
            Detailed editor…
          </button>
        )}
      </div>

      {tab === 'manual' && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            onAdd({ type: 'text', title: text.trim(), tags: [] });
            setText('');
          }}
        >
          <input
            className="input flex-1"
            placeholder="Quick add a title…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            type="submit"
            className="px-4 rounded-md bg-foreground text-background font-medium text-sm disabled:opacity-40"
            disabled={!text.trim()}
          >
            Add
          </button>
        </form>
      )}

      {tab === 'url' && <UrlPreviewInput onAdd={onAdd} />}
      {tab === 'tmdb' && <TmdbSearchInput onAdd={onAdd} />}
    </div>
  );
}
