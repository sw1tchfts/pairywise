import { NextRequest } from 'next/server';
import { errorMessage } from '@/lib/utils';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'TMDB_API_KEY not configured' }, { status: 503 });
  }
  const q = request.nextUrl.searchParams.get('q');
  if (!q) return Response.json({ error: 'Missing q' }, { status: 400 });

  const url = `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(
    q,
  )}&api_key=${apiKey}&include_adult=false`;

  try {
    const res = await fetch(url, { next: { revalidate: 60 * 5 } });
    if (!res.ok) {
      return Response.json({ error: `TMDB ${res.status}` }, { status: 502 });
    }
    const data = (await res.json()) as {
      results?: Array<{ media_type: string }>;
    };
    const filtered = (data.results ?? []).filter(
      (r) => r.media_type === 'movie' || r.media_type === 'tv',
    );
    return Response.json({ results: filtered });
  } catch (err) {
    return Response.json(
      { error: errorMessage(err, 'Fetch failed') },
      { status: 502 },
    );
  }
}
