// Who is asking for a paid render (Phase 0.5b). 2026-10-27: renders need a
// signed-in account ("Sign-in required"), and each account has a daily limit,
// RENDER_LIMIT_PER_USER_DAY (default 20). The count lives in the database
// (take_render, supabase/migrations/20261027120000_render_usage.sql), so it
// holds across every server instance. The per-IP and daily caps of
// lib/renderGuard.ts still apply on top.
//
// The browser sends the customer's session token (Authorization: Bearer);
// the server checks it with Supabase and counts the render as that customer.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d);
export const userDailyLimit = () => num(process.env.RENDER_LIMIT_PER_USER_DAY, 20);

const SIGN_IN = "Please sign in to see your render — it only takes a moment.";
export const LIMIT_REACHED = (n: number) => `You've made today's ${n} renders — you can render again tomorrow.`;

export type RenderUser =
  /** client null: no database on this server (local development, tests) — sign-in is not checked. */
  | { ok: true; userId: string | null; client: SupabaseClient | null }
  | { ok: false; status: 401 | 503; error: string; signin?: true };

function supabaseConfig() {
  // As lib/supabase.ts: SUPABASE_* (even "") override the public values on the server.
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

/** The signed-in customer behind this request, or why there is none. */
export async function renderUser(headers: Headers): Promise<RenderUser> {
  const cfg = supabaseConfig();
  if (!cfg) {
    // Never open renders to everyone on the live site because a setting is missing.
    if (process.env.VERCEL_ENV === "production") return { ok: false, status: 503, error: "Renders are not available right now — please try again later." };
    return { ok: true, userId: null, client: null };
  }
  const token = (headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return { ok: false, status: 401, error: SIGN_IN, signin: true };
  const client = createClient(cfg.url, cfg.key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user || data.user.is_anonymous) return { ok: false, status: 401, error: SIGN_IN, signin: true };
  return { ok: true, userId: data.user.id, client };
}

// Used only if take_render is missing (the 0.5b SQL not run yet): a count in
// this instance's memory, so the limit still bounds each instance.
const fallback = new Map<string, { day: string; n: number }>();

export type TakeResult = { ok: true; left: number } | { ok: false; status: 401 | 429; error: string; signin?: true; limited?: true };

/** Counts one render for the customer, or says why not. */
export async function takeAccountRender(user: { userId: string | null; client: SupabaseClient | null }, now = Date.now()): Promise<TakeResult> {
  const limit = userDailyLimit();
  if (!user.client || !user.userId) return { ok: true, left: limit };
  const { data, error } = await user.client.rpc("take_render", { p_daily_limit: limit });
  let left: number;
  if (error || typeof data !== "number") {
    console.warn("[render] take_render unavailable, counting in memory:", error?.message ?? data);
    const day = new Date(now).toISOString().slice(0, 10);
    if (fallback.size > 5000) fallback.clear();
    const u = fallback.get(user.userId);
    const used = u && u.day === day ? u.n : 0;
    if (used >= limit) left = -2;
    else { fallback.set(user.userId, { day, n: used + 1 }); left = limit - used - 1; }
  } else {
    left = data;
  }
  if (left === -1) return { ok: false, status: 401, error: SIGN_IN, signin: true };
  if (left < 0) return { ok: false, status: 429, error: LIMIT_REACHED(limit), limited: true };
  return { ok: true, left };
}

/** Test hook. */
export function resetAccountRenderFallback() { fallback.clear(); }
