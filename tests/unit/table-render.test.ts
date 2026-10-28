// The real render of the kids' table (F3): when a render is still current,
// what may be stored, the option pictures and choices in the prompt, and the
// route — one close-up from the option pictures, never without the guards.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { themeById } from "@/lib/config";
import { NONE } from "@/lib/studio/tableCatalog";
import { defaultTableSetup, readTableRender, readTableSetup } from "@/lib/studio/tableSetup";
import { MAX_REFERENCES, referencePictures, tablePrompt, tableRenderKey } from "@/lib/studio/tableRender";
import { resetRenderGuard } from "@/lib/renderGuard";
import { readNdjson } from "@/lib/ndjson";

const subscribe = vi.fn();
vi.mock("@fal-ai/client", () => ({ fal: { config: vi.fn(), subscribe: (...a: unknown[]) => subscribe(...a) } }));
// A signed-in customer's session with Supabase (for the route's storing).
const getUser = vi.fn(), createSignedUrls = vi.fn(), rpc = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: { getUser }, rpc, storage: { from: () => ({ createSignedUrls }) } }) }));
const storeRenderJpeg = vi.fn();
const JPEG = Buffer.from("jpeg-bytes"), PICTURE = `data:image/jpeg;base64,${JPEG.toString("base64")}`;
vi.mock("@/lib/renderStore", () => ({ renderJpeg: async () => JPEG, storeRenderJpeg: (...a: unknown[]) => storeRenderJpeg(...a) }));

const frozen = themeById("frozen")!;
const table = (over: Partial<ReturnType<typeof defaultTableSetup>["choices"]> = {}, kids = 10) =>
  ({ ...defaultTableSetup(frozen), kids, choices: { ...defaultTableSetup(frozen).choices, ...over } });
const FAL = "https://v3.fal.media/files/rabbit/abc_123.jpg";
const USER = "00000000-0000-4000-8000-0000000000a1";
const P = `${USER}/1abc.jpg`, T = `${USER}/2def.jpg`, C = `${USER}/3ghi.jpg`;

describe("is the render current?", () => {
  it("the key follows every choice, colour and child — not the render itself", () => {
    const t = table();
    expect(tableRenderKey({ ...t, render: { key: "x", close: C } })).toBe(tableRenderKey(t));
    expect(tableRenderKey(table({ chairs: "bow_kids" }))).not.toBe(tableRenderKey(t));
    expect(tableRenderKey({ ...t, napkinColor: "#000000" })).not.toBe(tableRenderKey(t));
    expect(tableRenderKey(table({}, 11))).not.toBe(tableRenderKey(t));
  });
});

describe("what may be stored", () => {
  it("only a file in one customer's folder — never a link", () => {
    expect(readTableRender({ key: "abc1", close: C })).toEqual({ key: "abc1", close: C });
    for (const bad of [FAL, "/design/x.jpg", `../${USER}/a.jpg`, `${USER}/a.png`, `${USER}/a/b.jpg`, "javascript:alert(1)"]) {
      expect(readTableRender({ key: "abc1", close: bad })).toBeUndefined();
    }
    expect(readTableRender({ key: "<b>", close: C })).toBeUndefined();
  });
  it("a three-view render kept before 2026-10-28 reads back by its close-up; one without a close-up is dropped", () => {
    expect(readTableRender({ key: "abc1", perspective: P, top: T, close: C })).toEqual({ key: "abc1", close: C });
    expect(readTableRender({ key: "abc1", perspective: P, top: T })).toBeUndefined();
  });
  it("a stored table keeps a good render and drops a bad one", () => {
    expect(readTableSetup({ ...table(), render: { key: "k1", close: C } }, frozen)!.render).toEqual({ key: "k1", close: C });
    expect(readTableSetup({ ...table(), render: { key: "k1", close: FAL } }, frozen)!.render).toBeUndefined();
  });
});

describe("where and how it is photographed", () => {
  it("a garden unless indoors is chosen; the choice is part of the render's key and reads back", () => {
    expect(tablePrompt(table(), frozen, [])).toContain("outdoors in a sunny garden");
    expect(tablePrompt({ ...table(), scene: "indoor" }, frozen, [])).toContain("bright, airy party room");
    expect(tableRenderKey({ ...table(), scene: "indoor" })).not.toBe(tableRenderKey(table()));
    expect(tableRenderKey({ ...table(), scene: "garden" })).toBe(tableRenderKey(table()));
    expect(readTableSetup({ ...table(), scene: "indoor" }, frozen)!.scene).toBe("indoor");
    expect(readTableSetup({ ...table(), scene: "moon" }, frozen)!.scene).toBeUndefined();
  });
  it("one place setting up close", () => {
    expect(tablePrompt(table(), frozen, [])).toMatch(/50mm lens .* one place setting/);
  });
});

describe("the pictures and the prompt", () => {
  it("the chosen options' pictures, at most ten, named in the prompt in the same order", () => {
    const refs = referencePictures(table());
    expect(refs).toHaveLength(MAX_REFERENCES);
    expect(refs.slice(0, 3)).toEqual([
      { key: "chairs", photo: "/design/table/chairs-white_kids.webp" },
      { key: "table", photo: "/design/table/table-standard.webp" },
      { key: "plates", photo: "/design/table/plates-themed.webp" },
    ]);
    const p = tablePrompt(table(), frozen, refs.map((r) => r.key));
    expect(p).toContain("Images 1 to 10 are product photos");
    expect(p).toContain("image 1 is the chair, image 2 is the table, image 3 is the plate");
    expect(p).toContain("ignore everything around it");
  });
  it("None has no picture; the low table has cushions, not chairs", () => {
    expect(referencePictures(table({ placemats: NONE })).some((r) => r.key === "placemats")).toBe(false);
    const low = table({ table: "low", chairDecor: "tulle_bow" });
    expect(referencePictures(low).some((r) => r.key === "chairs" || r.key === "chairDecor")).toBe(false);
    const p = tablePrompt(low, frozen, referencePictures(low).map((r) => r.key));
    expect(p).toContain("a white floor cushion in front of the low table");
    expect(p).not.toMatch(/The chair is/);
  });
  it("describes every choice, skips None, and never names the theme", () => {
    const p = tablePrompt(table({ chairs: "bow_kids", table: "flower", partyHats: NONE }), frozen, []);
    expect(p).toContain("a pink metal children's chair with a round mesh seat and a back shaped like a bow");
    expect(p).toContain("shaped like a flower with six round petals");
    expect(p).not.toMatch(/a cone party hat|crown/);
    expect(p).not.toMatch(/frozen/i); // a character-free look: colours only
    expect(p).toMatch(/No people.*no cartoon characters/);
  });
  it("a kids' party: printed paper in the theme's pattern, disposable cutlery, nothing formal", () => {
    const p = tablePrompt(table(), frozen, []);
    expect(p).toContain("paper placemat printed with snowflakes and little stars");
    expect(p).toContain("disposable paper party plate printed with snowflakes and little stars");
    expect(p).toContain("disposable pastel plastic cutlery");
    expect(p).toContain("a cone party hat");
    expect(p).toMatch(/children's birthday party.*no glassware, no china, no charger plates/);
    expect(tablePrompt(table(), themeById("dinosaur")!, [])).toContain("printed with dinosaur footprints and leaves");
  });
});

/** The streamed answer's lines, in order. */
async function lines(res: Response) {
  const out: Record<string, unknown>[] = [];
  await readNdjson(res.body!, (l) => out.push(l as Record<string, unknown>));
  return out;
}

describe("reading the stream", () => {
  it("lines split anywhere across chunks, and the last one without a newline", async () => {
    const text = ['{"view":"perspective","url":"a"}', "", '{"view":"top","url":"ü"}', '{"done":true}'].join("\n");
    const bytes = new TextEncoder().encode(text);
    const body = new ReadableStream<Uint8Array>({ start(c) { for (let i = 0; i < bytes.length; i += 7) c.enqueue(bytes.slice(i, i + 7)); c.close(); } });
    const got: unknown[] = [];
    await readNdjson(body, (l) => got.push(l));
    expect(got).toEqual([{ view: "perspective", url: "a" }, { view: "top", url: "ü" }, { done: true }]);
  });
});

describe("the route", () => {
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    new NextRequest("http://localhost/api/table-render", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", ...headers } });
  beforeEach(() => {
    vi.stubEnv("FAL_KEY", "test-key");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_URL", "");
    subscribe.mockReset(); storeRenderJpeg.mockReset(); createSignedUrls.mockReset(); getUser.mockReset(); rpc.mockReset();
    resetRenderGuard();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("one close-up, from the chosen options' pictures", async () => {
    subscribe.mockImplementation(async () => ({ data: { images: [{ url: FAL }] } }));
    const { POST } = await import("@/app/api/table-render/route");
    const res = await POST(post({ table: table(), theme: "frozen" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("ndjson");
    const got = await lines(res);
    // The picture comes in the answer itself: no other address to look up.
    expect(got).toHaveLength(2);
    expect(got[0]).toEqual({ view: "close", url: PICTURE });
    expect(got[1]).toMatchObject({ done: true });
    expect(got[1].render).toBeUndefined(); // no database here: nothing is kept
    const calls = (subscribe.mock.calls as [string, { input: { image_urls: string[]; prompt: string; image_size: string } }][]).map(([model, { input }]) => ({ model, ...input }));
    expect(calls).toHaveLength(1);
    expect(calls[0].model).toBe("fal-ai/bytedance/seedream/v5/lite/edit");
    expect(calls[0].image_size).toBe("landscape_4_3");
    expect(calls[0].image_urls).toHaveLength(MAX_REFERENCES);
    for (const u of calls[0].image_urls) expect(u).toMatch(/^data:image\/jpeg;base64,/);
    expect(calls[0].prompt).toContain("close-up photograph of ONE place setting");
    expect(calls[0].prompt).not.toMatch(/frozen/i);
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
    for (let i = 0; i < 4; i++) { // more than the three at a time one IP may have
      expect(await lines(await POST(post({ table: table(), theme: "frozen" })))).toEqual([{ error: expect.stringMatching(/didn't come out/) }]);
    }
    subscribe.mockImplementation(async () => ({ data: { images: [{ url: FAL }] } }));
    expect((await lines(await POST(post({ table: table(), theme: "frozen" })))).at(-1)).toMatchObject({ done: true });
  }, 30_000);

  it("fal refusing the account says renders are paused, not to try again", async () => {
    subscribe.mockRejectedValue(Object.assign(new Error("Forbidden"), { status: 403, body: { detail: "User is locked. Reason: TOP_UP." } }));
    const { POST } = await import("@/app/api/table-render/route");
    expect(await lines(await POST(post({ table: table(), theme: "frozen" })))).toEqual([{ error: expect.stringMatching(/paused/) }]);
  });

  it("signed in: the close-up is kept in the customer's folder, and comes in the answer", async () => {
    vi.stubEnv("SUPABASE_URL", "https://db.test");
    vi.stubEnv("SUPABASE_ANON_KEY", "anon");
    getUser.mockResolvedValue({ data: { user: { id: USER, is_anonymous: false } }, error: null });
    rpc.mockResolvedValue({ data: 5, error: null });
    subscribe.mockImplementation(async () => ({ data: { images: [{ url: FAL }] } }));
    storeRenderJpeg.mockImplementation(async () => ({ path: C, key: "k" }));
    const { POST } = await import("@/app/api/table-render/route");
    const got = await lines(await POST(post({ table: table(), theme: "frozen" }, { authorization: "Bearer tok" })));
    expect(got[0]).toEqual({ view: "close", url: PICTURE });
    expect(got[1]).toMatchObject({ done: true, render: { key: tableRenderKey(table()), close: C } });
    expect(storeRenderJpeg.mock.calls.map((c) => [c[1], c[2], c[3]])).toEqual([[USER, JPEG, `table:close:${tableRenderKey(table())}`]]);
  }, 30_000);
});
