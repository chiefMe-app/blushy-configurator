// Spending limits for the paid render API (/api/generate-controlled-render).
// Every request that can reach fal counts; the free layout-guide preview
// (debugLayoutReferenceOnly) does not.
//
// - RENDER_CONCURRENT_PER_IP (default 3) renders at a time per client IP —
//   not 1: phones on a mobile network, and an office or hotel, share an IP;
// - RENDER_LIMIT_PER_IP_10MIN (default 10) and RENDER_LIMIT_PER_IP_DAY (40) per IP;
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
// Renders in progress per IP, by start time. One that never ended (the
// function was stopped at its time limit) stops counting after STALE_MS.
const inflight = new Map<string, number[]>();
const STALE_MS = 320_000; // the longest route (the table render) may run 300 s
let global = { day: "", count: 0 };

export type GuardResult =
  | { ok: true; release: () => void }
  | { ok: false; status: 429 | 503; error: string; retryAfter: number; busy?: boolean };

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
    return { ok: false, status: 503, error: "Today's render limit has been reached — please try again tomorrow.", retryAfter: secondsToMidnightUtc(now) };
  }
  const running = (inflight.get(ip) ?? []).filter((t) => now - t < STALE_MS);
  if (running.length >= num(process.env.RENDER_CONCURRENT_PER_IP, 3)) {
    inflight.set(ip, running);
    // Not a limit: one of them will finish shortly.
    return { ok: false, status: 429, busy: true, error: "A render from this connection is still being made — please try again in a few seconds.", retryAfter: 20 };
  }
  if (usage.size > 5000) usage.clear(); // bound the table
  const u = usage.get(ip) ?? { recent: [], day, dayCount: 0 };
  if (u.day !== day) { u.day = day; u.dayCount = 0; }
  u.recent = u.recent.filter((t) => now - t < WINDOW_MS);
  if (u.dayCount >= num(process.env.RENDER_LIMIT_PER_IP_DAY, 40)) {
    usage.set(ip, u);
    return { ok: false, status: 429, error: "You've reached today's render limit — you can render again tomorrow.", retryAfter: secondsToMidnightUtc(now) };
  }
  if (u.recent.length >= num(process.env.RENDER_LIMIT_PER_IP_10MIN, 10)) {
    usage.set(ip, u);
    const wait = Math.ceil((WINDOW_MS - (now - u.recent[0])) / 1000);
    return { ok: false, status: 429, error: `You've reached your render limit — you can render again in ${Math.max(1, Math.ceil(wait / 60))} min.`, retryAfter: wait };
  }
  u.recent.push(now);
  u.dayCount++;
  usage.set(ip, u);
  global.count++;
  const started = now;
  running.push(started);
  inflight.set(ip, running);
  let released = false;
  return {
    ok: true,
    release: () => {
      if (released) return;
      released = true;
      const left = inflight.get(ip) ?? [];
      const i = left.indexOf(started);
      if (i >= 0) left.splice(i, 1);
      if (!left.length) inflight.delete(ip);
    },
  };
}

/** Test hook: forget every count. */
export function resetRenderGuard() {
  usage.clear();
  inflight.clear();
  global = { day: "", count: 0 };
}
