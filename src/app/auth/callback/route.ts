import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { hasSupabaseEnv, supabaseAnonKey, supabaseUrl } from '@/lib/supabase/env';

/**
 * Supabase sends the user here after they click the email confirmation link.
 * We exchange the ?code=... for a session cookie, then redirect to ?next=...
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';
  const destination = new URL(next, url.origin);

  if (!code || !hasSupabaseEnv()) {
    return NextResponse.redirect(destination);
  }

  const response = NextResponse.redirect(destination);
  const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const fallback = new URL('/signin', url.origin);
    fallback.searchParams.set('error', error.message);
    if (next !== '/') fallback.searchParams.set('next', next);
    return NextResponse.redirect(fallback);
  }

  return response;
}
