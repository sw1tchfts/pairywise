import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { hasSupabaseEnv, supabaseAnonKey, supabaseUrl } from '@/lib/supabase/env';
import type { ItemRow, ListRow } from '@/lib/cloud/mappers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WIDTH = 1200;
const HEIGHT = 630;

/**
 * Public OG preview image for a shared list. Unlike /api/share-card,
 * this runs as the anon role (no cookies) — RLS permits SELECT on
 * non-private lists and their items, which is exactly what we want
 * for link-unfurling in iMessage / Slack / Twitter / etc.
 */
export async function GET(request: NextRequest) {
  const listId = request.nextUrl.searchParams.get('listId');
  if (!listId) return new Response('Missing listId', { status: 400 });
  if (!hasSupabaseEnv()) return new Response('Not configured', { status: 500 });

  // Explicitly no cookies — we want anon-role access.
  const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll: () => [],
      setAll: () => {
        /* read-only */
      },
    },
  });

  const { data: listRow } = await supabase
    .from('lists')
    .select('*')
    .eq('id', listId)
    .maybeSingle();
  if (!listRow) return new Response('Not found', { status: 404 });
  const list = listRow as ListRow;
  if (list.visibility === 'private') {
    return new Response('Private', { status: 403 });
  }

  const { data: itemsData } = await supabase
    .from('items')
    .select('title')
    .eq('list_id', listId)
    .order('position', { ascending: true })
    .limit(8);
  const items = ((itemsData ?? []) as Pick<ItemRow, 'title'>[]).map((i) => i.title);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#0b0b0c',
          color: '#fafafa',
          padding: '64px 72px',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              color: '#888',
            }}
          >
            pairywise · you&apos;re invited
          </span>
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: 70,
            fontWeight: 700,
            lineHeight: 1.02,
            letterSpacing: -1.2,
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
            marginTop: 14,
            fontSize: 26,
            color: '#aaa',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {list.description ?? 'Help rank this list, one head-to-head pair at a time.'}
        </div>

        {items.length > 0 && (
          <div
            style={{
              marginTop: 34,
              flex: 1,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              alignContent: 'flex-start',
            }}
          >
            {items.map((title, i) => (
              <div
                key={i}
                style={{
                  fontSize: 22,
                  color: '#e5e5e5',
                  background: '#1a1a1d',
                  border: '1px solid #2a2a30',
                  borderRadius: 12,
                  padding: '8px 14px',
                  maxWidth: 360,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                }}
              >
                {title}
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            marginTop: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#666',
            fontSize: 22,
          }}
        >
          <span>pairywise.com</span>
          <span>Tap to join &amp; vote →</span>
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT },
  );
}
