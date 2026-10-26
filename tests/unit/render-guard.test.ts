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
  it("lets 6 renders through per IP in 10 minutes, then says when to come back", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await call({ renderMode: "first_generate" })).status);
    expect(statuses.slice(0, 6)).toEqual([500, 500, 500, 500, 500, 500]); // reached the handler (no key)
    const res = await call({ renderMode: "first_generate" });
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.limited).toBe(true);
    expect(json.error).toMatch(/try again in \d+ min/);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    // Another visitor is not affected.
    expect((await call({ renderMode: "first_generate" }, "198.51.100.9")).status).toBe(500);
  });

  it("the free layout-guide preview is not counted", async () => {
    for (let i = 0; i < 10; i++) await call({ debugLayoutReferenceOnly: true });
    expect((await call({ renderMode: "first_generate" })).status).toBe(500);
  });

  it("a 'preview' that asks for an edit is counted: that path calls fal first", async () => {
    for (let i = 0; i < 6; i++) await call({ debugLayoutReferenceOnly: true, renderMode: "edit_existing" });
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
    expect((await res.json()).error).toMatch(/today's render limit/);
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

  it("one render at a time per IP; the slot is freed when it ends", () => {
    const a = acquireRender("203.0.113.77");
    expect(a.ok).toBe(true);
    const b = acquireRender("203.0.113.77");
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.status).toBe(429);
    if (a.ok) a.release();
    expect(acquireRender("203.0.113.77").ok).toBe(true);
  });

  it("a new UTC day starts the counts again", () => {
    process.env.RENDER_LIMIT_PER_IP_DAY = "1";
    const t = Date.UTC(2026, 9, 26, 23, 59);
    const a = acquireRender("203.0.113.8", t); if (a.ok) a.release();
    expect(acquireRender("203.0.113.8", t + 30_000).ok).toBe(false);
    expect(acquireRender("203.0.113.8", t + 61_000 + 11 * 60_000).ok).toBe(true);
  });
});
