import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { hasSupabaseEnv, supabaseAnonKey, supabaseUrl } from '@/lib/supabase/env';

// Signed-in users are redirected away from these (back to /).
const SIGNED_IN_DISALLOWED = ['/signin', '/signup'];
// Signed-out users are allowed to visit these.
const SIGNED_OUT_ALLOWED = ['/signin', '/signup', '/auth', '/shared'];

function matches(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const signedIn = Boolean(data.user);
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

  return response;
}

export const config = {
  matcher: [
    /*
     * Match everything except static assets, OG routes, and TMDB search.
     * /api/og-list is excluded so bots like Apple's link preview can fetch
     * the image without hitting the auth gate.
     */
    '/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg|manifest\\.webmanifest|api/og|api/og-list|api/tmdb).*)',
  ],
};
