'use client';

import { useState } from 'react';
import type { Item } from '@/lib/types';

type Props = {
  onAdd: (item: Omit<Item, 'id'>) => void;
};

type Preview = {
  title: string;
  description?: string;
  image?: string;
  url: string;
};

export function UrlPreviewInput({ onAdd }: Props) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  async function fetchPreview(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/og?url=${encodeURIComponent(url.trim())}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Preview;
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch preview');
    } finally {
      setLoading(false);
    }
  }

  function handleAdd() {
    if (!preview) return;
    onAdd({
      type: 'url',
      label: preview.title || preview.url,
      description: preview.description,
      imageUrl: preview.image,
      linkUrl: preview.url,
    });
    setPreview(null);
    setUrl('');
  }

  return (
    <div className="grid gap-3">
      <form className="flex gap-2" onSubmit={fetchPreview}>
        <input
          className="input flex-1"
          placeholder="Paste a URL…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button
          type="submit"
          className="px-3 rounded-md border border-foreground/30 font-medium text-sm disabled:opacity-40"
          disabled={!url.trim() || loading}
        >
          {loading ? 'Fetching…' : 'Preview'}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {preview && (
        <div className="rounded-md border border-black/10 dark:border-white/10 p-3 flex gap-3">
          {preview.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.image}
              alt=""
              className="w-20 h-20 object-cover rounded-md flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{preview.title}</div>
            {preview.description && (
              <div className="text-sm text-foreground/70 line-clamp-2">
                {preview.description}
              </div>
            )}
            <div className="mt-2 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="text-sm px-3 py-1 rounded-md hover:bg-foreground/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAdd}
                className="text-sm px-3 py-1 rounded-md bg-foreground text-background font-medium"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
