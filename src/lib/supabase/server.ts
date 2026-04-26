import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAnonKey, supabaseUrl } from './env';

/**
 * Server-side Supabase client. Reads the user's session from request cookies,
 * so it can be used in Server Components and route handlers to do RLS-aware
 * queries on behalf of the signed-in user.
 *
 * `setAll` is wrapped in try/catch because Server Components are not allowed
 * to write cookies. We don't refresh tokens server-side — the browser client
 * rotates them via onAuthStateChange. A stale-but-not-expired token here will
 * silently fail; the client recovers on next mount.
 */
export async function getServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component context — cookies are read-only here.
        }
      },
    },
  });
}
