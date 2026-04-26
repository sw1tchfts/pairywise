'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAnonKey, supabaseUrl } from './env';

let _client: SupabaseClient | null = null;

export function getBrowserClient(): SupabaseClient {
  if (_client) return _client;
  _client = createBrowserClient(supabaseUrl(), supabaseAnonKey());
  return _client;
}
