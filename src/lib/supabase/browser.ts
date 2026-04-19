'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hasSupabaseEnv, supabaseAnonKey, supabaseUrl } from './env';

let _client: SupabaseClient | null = null;

export function isCloudEnabled() {
  return hasSupabaseEnv();
}

export function getBrowserClient(): SupabaseClient {
  if (!isCloudEnabled()) {
    throw new Error(
      'Supabase env vars are not set. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  if (_client) return _client;
  _client = createBrowserClient(supabaseUrl(), supabaseAnonKey());
  return _client;
}
