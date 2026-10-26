// Spending limits for the paid render API (/api/generate-controlled-render).
// Every request that can reach fal counts; the free layout-guide preview
// (debugLayoutReferenceOnly) does not.
//
// - one render at a time per client IP;
// - RENDER_LIMIT_PER_IP_10MIN (default 6) and RENDER_LIMIT_PER_IP_DAY (30) per IP;
// - RENDER_DAILY_CAP (400) across all clients — past it renders pause until
//   the next UTC day;
// - RENDERS_DISABLED=1 switches renders off at once (kill switch).
//
// The counts live in the server instance's memory, so they bound each
// instance, not the whole deployment. A durable, shared limit comes with the
// database (Phase 0.5); this stops casual abuse and runaway loops today.

const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d);
const WINDOW_MS = 10 * 60_000;

interface Usage { recent: number[]; day: string; dayCount: number }
const usage = new Map<string, Usage>();
const inflight = new Set<string>();
let global = { day: "", count: 0 };

export type GuardResult =
  | { ok: true; release: () => void }
  | { ok: false; status: 429 | 503; error: string; retryAfter: number };

const dayOf = (now: number) => new Date(now).toISOString().slice(0, 10);
const secondsToMidnightUtc = (now: number) => Math.ceil((Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate() + 1) - now) / 1000);

/** The client's IP as Vercel passes it (first hop of x-forwarded-for). */
export function clientIp(headers: Headers): string {
  return (headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || headers.get("x-real-ip") || "local";
}

/** Takes a render slot for this IP, or says why not. Call release() when the render ends. */
export function acquireRender(ip: string, now = Date.now()): GuardResult {
  if (process.env.RENDERS_DISABLED === "1") {
    return { ok: false, status: 503, error: "Renders are paused for a short while — please try again later.", retryAfter: 600 };
  }
  const day = dayOf(now);
  if (global.day !== day) global = { day, count: 0 };
  if (global.count >= num(process.env.RENDER_DAILY_CAP, 400)) {
    return { ok: false, status: 503, error: "We have reached today's render limit — please try again tomorrow.", retryAfter: secondsToMidnightUtc(now) };
  }
  if (inflight.has(ip)) {
    return { ok: false, status: 429, error: "Your render is still on its way — one moment.", retryAfter: 20 };
  }
  if (usage.size > 5000) usage.clear(); // bound the table
  const u = usage.get(ip) ?? { recent: [], day, dayCount: 0 };
  if (u.day !== day) { u.day = day; u.dayCount = 0; }
  u.recent = u.recent.filter((t) => now - t < WINDOW_MS);
  if (u.dayCount >= num(process.env.RENDER_LIMIT_PER_IP_DAY, 30)) {
    usage.set(ip, u);
    return { ok: false, status: 429, error: "You have made a lot of renders today — please try again tomorrow.", retryAfter: secondsToMidnightUtc(now) };
  }
  if (u.recent.length >= num(process.env.RENDER_LIMIT_PER_IP_10MIN, 6)) {
    usage.set(ip, u);
    const wait = Math.ceil((WINDOW_MS - (now - u.recent[0])) / 1000);
    return { ok: false, status: 429, error: `That's a lot of renders in a few minutes — please try again in ${Math.max(1, Math.ceil(wait / 60))} min.`, retryAfter: wait };
  }
  u.recent.push(now);
  u.dayCount++;
  usage.set(ip, u);
  global.count++;
  inflight.add(ip);
  let released = false;
  return { ok: true, release: () => { if (!released) { released = true; inflight.delete(ip); } } };
}

/** Test hook: forget every count. */
export function resetRenderGuard() {
  usage.clear();
  inflight.clear();
  global = { day: "", count: 0 };
}
