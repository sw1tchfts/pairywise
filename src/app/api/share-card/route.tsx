import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import {
  comparisonFromRow,
  itemFromRow,
  listFromRow,
  type ComparisonRow,
  type ItemRow,
  type ListRow,
} from '@/lib/cloud/mappers';
import { rankElo } from '@/lib/ranking/elo';
import {
  OGFrame,
  OG_HEIGHT,
  OG_PALETTE,
  OG_WIDTH,
  getOgSupabase,
} from '../_og/frame';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const listId = request.nextUrl.searchParams.get('listId');
  if (!listId) {
    return new Response('Missing listId', { status: 400 });
  }
  if (!hasSupabaseEnv()) {
    return new Response('Not configured', { status: 500 });
  }

  const supabase = await getOgSupabase(true);

  const { data: listRow } = await supabase
    .from('lists')
    .select('*')
    .eq('id', listId)
    .maybeSingle();
  if (!listRow) {
    return new Response('Not found', { status: 404 });
  }
  const [itemsRes, compsRes] = await Promise.all([
    supabase
      .from('items')
      .select('*')
      .eq('list_id', listId)
      .order('position', { ascending: true }),
    supabase
      .from('comparisons')
      .select('*')
      .eq('list_id', listId)
      .order('created_at', { ascending: true }),
  ]);

  const list = listFromRow(
    listRow as ListRow,
    ((itemsRes.data ?? []) as ItemRow[]).map(itemFromRow),
    ((compsRes.data ?? []) as ComparisonRow[]).map(comparisonFromRow),
  );

  const rankings = rankElo(list.items, list.comparisons);
  const itemsById = new Map(list.items.map((i) => [i.id, i]));
  const top = rankings
    .filter((r) => r.comparisons > 0)
    .slice(0, 10)
    .map((r, i) => ({
      rank: i + 1,
      title: itemsById.get(r.itemId)?.title ?? '—',
      score: r.rating,
    }));

  return new ImageResponse(
    (
      <OGFrame padding="56px 64px" footerRight="Rank anything">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              color: '#999',
            }}
          >
            pairywise ranking
          </span>
          <span style={{ color: '#555', fontSize: 18 }}>·</span>
          <span style={{ color: '#999', fontSize: 18 }}>
            {list.items.length} items · {list.comparisons.length} votes
          </span>
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -1,
            color: '#fff',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {list.title}
        </div>

        <div
          style={{
            marginTop: 36,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {top.length === 0 ? (
            <div style={{ color: OG_PALETTE.footer, fontSize: 28 }}>
              No ranking data yet.
            </div>
          ) : (
            top.map((row) => (
              <div
                key={row.rank}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 18,
                  fontSize: 30,
                }}
              >
                <span
                  style={{
                    width: 52,
                    textAlign: 'right',
                    color: OG_PALETTE.footer,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {row.rank}.
                </span>
                <span
                  style={{
                    flex: 1,
                    color: OG_PALETTE.fg,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.title}
                </span>
                <span
                  style={{
                    color: OG_PALETTE.faint,
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: 24,
                  }}
                >
                  {row.score.toFixed(0)}
                </span>
              </div>
            ))
          )}
        </div>
      </OGFrame>
    ),
    { width: OG_WIDTH, height: OG_HEIGHT },
  );
}
