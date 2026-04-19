// Public Supabase config for pairywise.
//
// These are safe to commit: NEXT_PUBLIC_SUPABASE_ANON_KEY is a "publishable"
// key that Supabase designs to be exposed to browsers, and the project URL is
// inherently public. RLS policies in the database are what actually protect
// data. If we ever rotate the key, update these defaults; real environments
// can still override via env vars.
const DEFAULT_SUPABASE_URL = 'https://oyysegkrwfjztjqiyxtk.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_QedIt7b5nDkQDhoj2CuCbA_ntnbBQ3O';

export function supabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? DEFAULT_SUPABASE_URL;
}

export function supabaseAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? DEFAULT_SUPABASE_ANON_KEY;
}

export function hasSupabaseEnv(): boolean {
  return Boolean(supabaseUrl() && supabaseAnonKey());
}
