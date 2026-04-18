'use client';

import { useState } from 'react';
import type { Item, ItemType } from '@/lib/types';
import { UrlPreviewInput } from './UrlPreviewInput';
import { TmdbSearchInput } from './TmdbSearchInput';

type Props = {
  onAdd: (item: Omit<Item, 'id'>) => void;
};

type Tab = ItemType;

export function ItemPicker({ onAdd }: Props) {
  const [tab, setTab] = useState<Tab>('text');
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageLabel, setImageLabel] = useState('');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'text', label: 'Text' },
    { key: 'image', label: 'Image' },
    { key: 'url', label: 'URL' },
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
      </div>

      {tab === 'text' && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            onAdd({ type: 'text', label: text.trim() });
            setText('');
          }}
        >
          <input
            className="input flex-1"
            placeholder="Add a text item…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
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

      {tab === 'image' && (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!imageUrl.trim()) return;
            onAdd({
              type: 'image',
              label: imageLabel.trim() || 'Image',
              imageUrl: imageUrl.trim(),
            });
            setImageUrl('');
            setImageLabel('');
          }}
        >
          <input
            className="input"
            placeholder="Image URL (https://…)"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
          <input
            className="input"
            placeholder="Label (optional)"
            value={imageLabel}
            onChange={(e) => setImageLabel(e.target.value)}
          />
          <button
            type="submit"
            className="justify-self-end px-4 py-1.5 rounded-md bg-foreground text-background font-medium text-sm disabled:opacity-40"
            disabled={!imageUrl.trim()}
          >
            Add image
          </button>
        </form>
      )}

      {tab === 'url' && <UrlPreviewInput onAdd={onAdd} />}
      {tab === 'tmdb' && <TmdbSearchInput onAdd={onAdd} />}
    </div>
  );
}
