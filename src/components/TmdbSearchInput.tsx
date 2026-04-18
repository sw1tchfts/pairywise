'use client';

import { useState } from 'react';
import type { Item } from '@/lib/types';

type Props = {
  onAdd: (item: Omit<Item, 'id'>) => void;
};

type TmdbResult = {
  id: number;
  media_type: 'movie' | 'tv';
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
};

export function TmdbSearchInput({ onAdd }: Props) {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<TmdbResult[]>([]);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(q.trim())}`);
      if (res.status === 503) {
        throw new Error('TMDB is not configured (set TMDB_API_KEY).');
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { results: TmdbResult[] };
      setResults(data.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  function handleAdd(r: TmdbResult) {
    const label = r.title ?? r.name ?? 'Untitled';
    const year = (r.release_date ?? r.first_air_date ?? '').slice(0, 4);
    onAdd({
      type: 'tmdb',
      label: year ? `${label} (${year})` : label,
      description: r.overview,
      imageUrl: r.poster_path
        ? `https://image.tmdb.org/t/p/w300${r.poster_path}`
        : undefined,
      externalId: `${r.media_type}:${r.id}`,
      metadata: { mediaType: r.media_type },
    });
  }

  return (
    <div className="grid gap-3">
      <form className="flex gap-2" onSubmit={search}>
        <input
          className="input flex-1"
          placeholder="Search movies or TV…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="submit"
          className="px-3 rounded-md border border-foreground/30 font-medium text-sm disabled:opacity-40"
          disabled={!q.trim() || loading}
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {results.length > 0 && (
        <ul className="grid gap-2 max-h-80 overflow-y-auto">
          {results.slice(0, 20).map((r) => {
            const label = r.title ?? r.name ?? 'Untitled';
            return (
              <li
                key={`${r.media_type}-${r.id}`}
                className="flex gap-3 items-center rounded-md border border-black/10 dark:border-white/10 p-2"
              >
                {r.poster_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`https://image.tmdb.org/t/p/w92${r.poster_path}`}
                    alt=""
                    className="w-10 h-14 object-cover rounded"
                  />
                ) : (
                  <div className="w-10 h-14 rounded bg-foreground/10" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{label}</div>
                  <div className="text-xs text-foreground/60">
                    {r.media_type === 'movie' ? 'Movie' : 'TV'}
                    {(r.release_date ?? r.first_air_date) &&
                      ` · ${(r.release_date ?? r.first_air_date)!.slice(0, 4)}`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleAdd(r)}
                  className="text-sm px-3 py-1 rounded-md bg-foreground text-background"
                >
                  Add
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
