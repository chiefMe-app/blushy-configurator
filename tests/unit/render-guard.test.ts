// Spending limits on the paid render API (lib/renderGuard.ts and its wrapper
// in /api/generate-controlled-render). No key is set here, so a request that
// gets through is answered "Missing FAL_KEY." — nothing can reach fal.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/generate-controlled-render/route";
import { acquireRender, resetRenderGuard } from "@/lib/renderGuard";

const call = (body: unknown, ip = "203.0.113.5") => POST(new NextRequest("http://localhost/api/generate-controlled-render", {
  method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body),
}));
const ENV = ["FAL_KEY", "RENDERS_DISABLED", "RENDER_DAILY_CAP", "RENDER_LIMIT_PER_IP_10MIN", "RENDER_LIMIT_PER_IP_DAY"];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV) { saved[k] = process.env[k]; delete process.env[k]; }
  resetRenderGuard();
});
afterEach(() => { for (const k of ENV) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

describe("render guard", () => {
  it("lets 10 renders through per IP in 10 minutes, then says when to come back", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 10; i++) statuses.push((await call({ renderMode: "first_generate" })).status);
    expect(statuses).toEqual(Array(10).fill(500)); // reached the handler (no key)
    const res = await call({ renderMode: "first_generate" });
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.limited).toBe(true);
    expect(json.error).toMatch(/^You've reached your render limit — you can render again in \d+ min\.$/);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    // Another visitor is not affected.
    expect((await call({ renderMode: "first_generate" }, "198.51.100.9")).status).toBe(500);
  });

  it("the free layout-guide preview is not counted", async () => {
    for (let i = 0; i < 10; i++) await call({ debugLayoutReferenceOnly: true });
    expect((await call({ renderMode: "first_generate" })).status).toBe(500);
  });

  it("a 'preview' that asks for an edit is counted: that path calls fal first", async () => {
    for (let i = 0; i < 10; i++) await call({ debugLayoutReferenceOnly: true, renderMode: "edit_existing" });
    expect((await call({ debugLayoutReferenceOnly: true, renderMode: "edit_existing" })).status).toBe(429);
  });

  it("a daily limit per IP, and a daily cap for everyone", async () => {
    process.env.RENDER_LIMIT_PER_IP_10MIN = "100";
    process.env.RENDER_LIMIT_PER_IP_DAY = "3";
    for (let i = 0; i < 3; i++) await call({});
    expect((await call({})).status).toBe(429);
    resetRenderGuard();
    process.env.RENDER_DAILY_CAP = "2";
    await call({}, "192.0.2.1"); await call({}, "192.0.2.2");
    const res = await call({}, "192.0.2.3");
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/^Today's render limit has been reached/);
  });

  it("a request without a scene is refused (400), not a crash", async () => {
    process.env.FAL_KEY = "not-a-real-key";
    const res = await call({ renderMode: "first_generate" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Missing sceneModel/);
  });

  it("the kill switch stops every render at once", async () => {
    process.env.RENDERS_DISABLED = "1";
    const res = await call({});
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/paused/);
  });

  it("three at a time per IP (a shared mobile or office IP); a slot is freed when its render ends", () => {
    const ip = "203.0.113.77";
    const slots = [acquireRender(ip), acquireRender(ip), acquireRender(ip)];
    expect(slots.every((s) => s.ok)).toBe(true);
    const fourth = acquireRender(ip);
    expect(fourth.ok).toBe(false);
    if (!fourth.ok) {
      expect(fourth.status).toBe(429);
      expect(fourth.busy).toBe(true); // not a limit: try again shortly
      expect(fourth.error).toMatch(/still being made/);
    }
    const first = slots[0];
    if (first.ok) { first.release(); first.release(); } // releasing twice frees one slot only
    expect(acquireRender(ip).ok).toBe(true);
    expect(acquireRender(ip).ok).toBe(false);
  });

  it("a render that never ended (stopped at the time limit) stops blocking after the longest route's limit", () => {
    const ip = "203.0.113.78", t = Date.UTC(2026, 9, 26, 12);
    for (let i = 0; i < 3; i++) acquireRender(ip, t); // never released
    expect(acquireRender(ip, t + 200_000).ok).toBe(false); // a table render may still be running
    expect(acquireRender(ip, t + 321_000).ok).toBe(true);
  });

  it("the route answers busy with busy: true, a limit with limited: true", async () => {
    for (let i = 0; i < 3; i++) acquireRender("203.0.113.5");
    const json = await (await call({ renderMode: "first_generate" })).json();
    expect(json).toEqual({ error: expect.stringMatching(/still being made/), busy: true });
  });

  it("a new UTC day starts the counts again", () => {
    process.env.RENDER_LIMIT_PER_IP_DAY = "1";
    const t = Date.UTC(2026, 9, 26, 23, 59);
    const a = acquireRender("203.0.113.8", t); if (a.ok) a.release();
    expect(acquireRender("203.0.113.8", t + 30_000).ok).toBe(false);
    expect(acquireRender("203.0.113.8", t + 61_000 + 11 * 60_000).ok).toBe(true);
  });
});
