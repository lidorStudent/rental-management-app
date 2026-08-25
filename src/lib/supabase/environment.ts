/**
 * The two public Supabase values, read through functions that fail with a useful message instead
 * of leaving `undefined` to surface as an unrelated error later.
 *
 * Each `process.env.NAME` is written out literally, because Next.js replaces those exact
 * expressions at build time. Reading them dynamically would leave the browser bundle with nothing.
 */

export function readSupabaseUrl(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl === undefined || supabaseUrl === "") {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set. Copy .env.example to .env.local.");
  }
  return supabaseUrl;
}

export function readSupabaseAnonKey(): string {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (anonKey === undefined || anonKey === "") {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Copy .env.example to .env.local.");
  }
  return anonKey;
}
