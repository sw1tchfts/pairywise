import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase/env';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const FONT_STACK = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const OG_PALETTE = {
  bg: '#0b0b0c',
  fg: '#fafafa',
  muted: '#aaa',
  faint: '#888',
  border: '#2a2a30',
  surface: '#1a1a1d',
  footer: '#666',
} as const;

/**
 * Outer chrome shared by every public OG image: dark background, system font,
 * `pairywise.com` footer with a tagline. Children render as the body.
 */
export function OGFrame({
  padding = '64px 72px',
  footerRight,
  children,
}: {
  padding?: string;
  footerRight: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: OG_PALETTE.bg,
        color: OG_PALETTE.fg,
        padding,
        fontFamily: FONT_STACK,
      }}
    >
      {children}
      <div
        style={{
          marginTop: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: OG_PALETTE.footer,
          fontSize: 22,
        }}
      >
        <span>pairywise.com</span>
        <span>{footerRight}</span>
      </div>
    </div>
  );
}

/**
 * Anon-role Supabase client for OG routes. `withCookies: true` reads the
 * caller's auth cookies (used by share-card so the user's RLS-visible lists
 * are reachable). `false` runs as the bare anon role (used by og-list for
 * unauthenticated link unfurling).
 */
export async function getOgSupabase(
  withCookies: boolean,
): Promise<SupabaseClient> {
  const cookieStore = withCookies ? await cookies() : null;
  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll: () => cookieStore?.getAll() ?? [],
      setAll: () => {
        /* read-only */
      },
    },
  });
}
