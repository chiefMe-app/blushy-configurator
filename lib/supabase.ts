import { createClient } from "@supabase/supabase-js";

// SUPABASE_URL / SUPABASE_ANON_KEY, when set (even to ""), override the
// public values for the server only. Next.js bakes NEXT_PUBLIC_* into the
// build, so this is how the e2e tests give the browser a stand-in Supabase
// while the server keeps no database at all. Production sets neither.
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Don't throw at import time in dev so the UI still renders without keys;
  // the orders route surfaces a clear error instead.
  // eslint-disable-next-line no-console
  console.warn(
    "[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set."
  );
}

/**
 * Server-side Supabase client. The anon key is used with the `orders` table's
 * insert policy. Created lazily so a missing env var can be reported cleanly.
 */
export function getSupabase() {
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false },
  });
}
