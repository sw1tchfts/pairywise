import { type NextRequest, NextResponse } from 'next/server';

// Signed-in users are redirected away from these (back to /).
const SIGNED_IN_DISALLOWED = ['/signin', '/signup'];
// Signed-out users are allowed to visit these.
const SIGNED_OUT_ALLOWED = ['/signin', '/signup', '/auth', '/shared'];

function matches(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Lightweight auth check: does the browser have a Supabase auth-token cookie
 * for *some* project? Cookie names are of the form
 * `sb-<project-ref>-auth-token` (or `.0`, `.1` for chunked sessions).
 *
 * We intentionally do NOT call `supabase.auth.getUser()` here — that would
 * round-trip to Supabase on every navigation (200–500ms tax per click).
 * Server Components and route handlers re-validate the JWT through their
 * own server client, and Supabase RLS protects the data on the wire, so
 * a cookie-presence gate is the right level of trust at the edge.
 */
function hasAuthCookie(request: NextRequest): boolean {
  for (const c of request.cookies.getAll()) {
    if (c.name.startsWith('sb-') && c.name.includes('auth-token')) return true;
  }
  return false;
}

export function proxy(request: NextRequest) {
  const signedIn = hasAuthCookie(request);
  const { pathname } = request.nextUrl;

  // Signed-in users visiting /signin or /signup go home. (/shared is NOT in
  // this list — signed-in users on /shared need to reach the auto-join flow.)
  if (signedIn && matches(pathname, SIGNED_IN_DISALLOWED)) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Signed-out users on protected routes go to /signin. /shared is public so
  // that iMessage / Slack / Twitter can unfurl the link without auth.
  if (!signedIn && !matches(pathname, SIGNED_OUT_ALLOWED)) {
    const url = request.nextUrl.clone();
    url.pathname = '/signin';
    url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    // Match everything except static assets, OG routes, and TMDB search, AND
    // skip Next.js prefetch requests so we don't fan-out auth checks for
    // every speculative <Link> in the viewport. /api/og-list is excluded so
    // link unfurlers can fetch unauthenticated.
    {
      source:
        '/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg|manifest\\.webmanifest|api/og|api/og-list|api/tmdb).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
