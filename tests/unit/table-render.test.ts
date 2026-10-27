// The real render of the kids' table (F3): when a render is still current,
// what may be stored, the seating and choices in the prompt, and the route —
// both views from the drawings, never without the guards.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { themeById } from "@/lib/config";
import { NONE } from "@/lib/studio/tableCatalog";
import { defaultTableSetup, readTableRender, readTableSetup } from "@/lib/studio/tableSetup";
import { seatingWords, tablePrompt, tableRenderKey } from "@/lib/studio/tableRender";
import { resetRenderGuard } from "@/lib/renderGuard";

const subscribe = vi.fn();
vi.mock("@fal-ai/client", () => ({ fal: { config: vi.fn(), subscribe: (...a: unknown[]) => subscribe(...a) } }));

const frozen = themeById("frozen")!;
const table = (over: Partial<ReturnType<typeof defaultTableSetup>["choices"]> = {}, kids = 10) =>
  ({ ...defaultTableSetup(frozen), kids, choices: { ...defaultTableSetup(frozen).choices, ...over } });
const FAL = "https://v3.fal.media/files/rabbit/abc_123.jpg";

describe("is the render current?", () => {
  it("the key follows every choice, colour and child — not the render itself", () => {
    const t = table();
    expect(tableRenderKey({ ...t, render: { key: "x", perspective: FAL, top: FAL } })).toBe(tableRenderKey(t));
    expect(tableRenderKey(table({ chairs: "gold_chiavari" }))).not.toBe(tableRenderKey(t));
    expect(tableRenderKey({ ...t, napkinColor: "#000000" })).not.toBe(tableRenderKey(t));
    expect(tableRenderKey(table({}, 11))).not.toBe(tableRenderKey(t));
  });
});

describe("what may be stored", () => {
  it("only fal's own picture addresses read back", () => {
    expect(readTableRender({ key: "abc1", perspective: FAL, top: FAL })).toEqual({ key: "abc1", perspective: FAL, top: FAL });
    for (const bad of ["http://v3.fal.media/x.jpg", "https://evil.example/x.jpg", "https://fal.media.evil.com/x.jpg", "javascript:alert(1)", "https://v3.fal.media/x.jpg\"onerror=1"]) {
      expect(readTableRender({ key: "abc1", perspective: bad, top: FAL })).toBeUndefined();
    }
    expect(readTableRender({ key: "<b>", perspective: FAL, top: FAL })).toBeUndefined();
  });
  it("a stored table keeps a good render and drops a bad one", () => {
    expect(readTableSetup({ ...table(), render: { key: "k1", perspective: FAL, top: FAL } }, frozen)!.render).toEqual({ key: "k1", perspective: FAL, top: FAL });
    expect(readTableSetup({ ...table(), render: { key: "k1", perspective: "https://x.com/a.jpg", top: FAL } }, frozen)!.render).toBeUndefined();
  });
});

describe("the prompt", () => {
  it("says the seating exactly as the drawings lay it out", () => {
    expect(seatingWords(table())).toContain("exactly 5 chairs along the far side and 5 along the near side");
    expect(seatingWords(table(), "top")).toContain("5 along the bottom side");
    expect(seatingWords(table({}, 11))).toContain("exactly 6 chairs along the far side and 5");
    expect(seatingWords(table({ table: "round" }, 12))).toContain("2 separate round kids' tables");
    expect(seatingWords(table({ table: "round" }, 12))).toContain("exactly 6 chairs");
    expect(seatingWords(table({}, 20))).toContain("2 parallel rows");
  });
  it("describes every choice, skips None, and never names the theme", () => {
    const p = tablePrompt(table({ chairs: "gold_chiavari", chargers: "gold", partyHats: NONE }), frozen, "perspective");
    expect(p).toContain("gold chiavari chairs");
    expect(p).toContain("gold charger plate");
    expect(p).not.toMatch(/party hat|crown/);
    expect(p).not.toMatch(/frozen/i); // a character-free look: colours only
    expect(p).toMatch(/No people.*no cartoon characters/);
  });
});

describe("the route", () => {
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    new NextRequest("http://localhost/api/table-render", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", ...headers } });
  beforeEach(() => {
    vi.stubEnv("FAL_KEY", "test-key");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_URL", "");
    subscribe.mockReset();
    resetRenderGuard();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("renders both views from the drawings with the pro model", async () => {
    subscribe.mockImplementation(async () => ({ data: { images: [{ url: FAL }] } }));
    const { POST } = await import("@/app/api/table-render/route");
    const res = await POST(post({ table: table(), theme: "frozen" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.render).toEqual({ key: tableRenderKey(table()), perspective: FAL, top: FAL });
    expect(subscribe).toHaveBeenCalledTimes(2);
    for (const [model, { input }] of subscribe.mock.calls as [string, { input: { image_urls: string[]; prompt: string } }][]) {
      expect(model).toBe("fal-ai/flux-2-pro/edit");
      expect(input.image_urls[0]).toMatch(/^data:image\/png;base64,/);
      expect(input.prompt).toContain("10 chairs in all");
    }
  }, 30_000);

  it("refuses a missing or skipped table without calling fal", async () => {
    const { POST } = await import("@/app/api/table-render/route");
    expect((await POST(post({ theme: "frozen" }))).status).toBe(400);
    expect((await POST(post({ table: { ...table(), enabled: false }, theme: "frozen" }))).status).toBe(400);
    expect((await POST(post({ table: table(), theme: "nope" }))).status).toBe(400);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("never opens to everyone on the live site when sign-in is not set up", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const { POST } = await import("@/app/api/table-render/route");
    expect((await POST(post({ table: table(), theme: "frozen" }))).status).toBe(503);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("a failed render says so, and frees the slot", async () => {
    subscribe.mockRejectedValue(new Error("boom"));
    const { POST } = await import("@/app/api/table-render/route");
    expect((await POST(post({ table: table(), theme: "frozen" }))).status).toBe(502);
    subscribe.mockImplementation(async () => ({ data: { images: [{ url: FAL }] } }));
    expect((await POST(post({ table: table(), theme: "frozen" }))).status).toBe(200);
  }, 30_000);
});
