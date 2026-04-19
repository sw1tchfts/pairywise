import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { hasSupabaseEnv, supabaseAnonKey, supabaseUrl } from '@/lib/supabase/env';

const PUBLIC_ROUTES = ['/signin', '/signup', '/auth'];

function isPublic(pathname: string) {
  return PUBLIC_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
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

  // Signed-in users visiting /signin or /signup go home.
  if (signedIn && isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Signed-out users on protected routes go to /signin.
  if (!signedIn && !isPublic(pathname)) {
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
     * Match everything except static assets and API routes that don't need auth.
     * OG image + TMDB search remain public since they're server-rendered utilities.
     */
    '/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg|manifest\\.webmanifest|api/og|api/tmdb).*)',
  ],
};
