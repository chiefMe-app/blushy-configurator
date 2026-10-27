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
// A signed-in customer's session with Supabase (for the route's storing).
const getUser = vi.fn(), createSignedUrls = vi.fn(), rpc = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: { getUser }, rpc, storage: { from: () => ({ createSignedUrls }) } }) }));
const storeRender = vi.fn();
vi.mock("@/lib/renderStore", () => ({ storeRender: (...a: unknown[]) => storeRender(...a) }));

const frozen = themeById("frozen")!;
const table = (over: Partial<ReturnType<typeof defaultTableSetup>["choices"]> = {}, kids = 10) =>
  ({ ...defaultTableSetup(frozen), kids, choices: { ...defaultTableSetup(frozen).choices, ...over } });
const FAL = "https://v3.fal.media/files/rabbit/abc_123.jpg";
const USER = "00000000-0000-4000-8000-0000000000a1";
const P = `${USER}/1abc.jpg`, T = `${USER}/2def.jpg`;

describe("is the render current?", () => {
  it("the key follows every choice, colour and child — not the render itself", () => {
    const t = table();
    expect(tableRenderKey({ ...t, render: { key: "x", perspective: P, top: T } })).toBe(tableRenderKey(t));
    expect(tableRenderKey(table({ chairs: "gold_chiavari" }))).not.toBe(tableRenderKey(t));
    expect(tableRenderKey({ ...t, napkinColor: "#000000" })).not.toBe(tableRenderKey(t));
    expect(tableRenderKey(table({}, 11))).not.toBe(tableRenderKey(t));
  });
});

describe("what may be stored", () => {
  it("only files in one customer's folder — never a link", () => {
    expect(readTableRender({ key: "abc1", perspective: P, top: T })).toEqual({ key: "abc1", perspective: P, top: T });
    for (const bad of [FAL, "/design/x.jpg", `../${USER}/a.jpg`, `${USER}/a.png`, `${USER}/a/b.jpg`, "javascript:alert(1)"]) {
      expect(readTableRender({ key: "abc1", perspective: bad, top: T })).toBeUndefined();
    }
    expect(readTableRender({ key: "abc1", perspective: P, top: "someone-else/2def.jpg" })).toBeUndefined();
    expect(readTableRender({ key: "<b>", perspective: P, top: T })).toBeUndefined();
  });
  it("a stored table keeps a good render and drops a bad one", () => {
    expect(readTableSetup({ ...table(), render: { key: "k1", perspective: P, top: T } }, frozen)!.render).toEqual({ key: "k1", perspective: P, top: T });
    expect(readTableSetup({ ...table(), render: { key: "k1", perspective: FAL, top: FAL } }, frozen)!.render).toBeUndefined();
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
    subscribe.mockReset(); storeRender.mockReset(); createSignedUrls.mockReset(); getUser.mockReset(); rpc.mockReset();
    resetRenderGuard();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("renders both views from the drawings with the pro model", async () => {
    subscribe.mockImplementation(async () => ({ data: { images: [{ url: FAL }] } }));
    const { POST } = await import("@/app/api/table-render/route");
    const res = await POST(post({ table: table(), theme: "frozen" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.urls).toEqual({ perspective: FAL, top: FAL }); // no database here: nothing is kept
    expect(json.render).toBeUndefined();
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

  it("signed in: both pictures are kept in the customer's folder and shown through signed links", async () => {
    vi.stubEnv("SUPABASE_URL", "https://db.test");
    vi.stubEnv("SUPABASE_ANON_KEY", "anon");
    getUser.mockResolvedValue({ data: { user: { id: USER, is_anonymous: false } }, error: null });
    rpc.mockResolvedValue({ data: 5, error: null });
    subscribe.mockImplementation(async () => ({ data: { images: [{ url: FAL }] } }));
    storeRender.mockImplementation(async (_c: unknown, _u: string, _url: string, hash: string) => ({ path: hash.includes("top") ? T : P, key: "k" }));
    createSignedUrls.mockResolvedValue({ data: [{ signedUrl: "https://db.test/sign/p?token=1" }, { signedUrl: "https://db.test/sign/t?token=1" }], error: null });
    const { POST } = await import("@/app/api/table-render/route");
    const json = await (await POST(post({ table: table(), theme: "frozen" }, { authorization: "Bearer tok" }))).json();
    expect(json.render).toEqual({ key: tableRenderKey(table()), perspective: P, top: T });
    expect(json.urls).toEqual({ perspective: "https://db.test/sign/p?token=1", top: "https://db.test/sign/t?token=1" });
    expect(storeRender.mock.calls.map((c) => c[1])).toEqual([USER, USER]);
    expect(createSignedUrls).toHaveBeenCalledWith([P, T], 3600);
  }, 30_000);
});
