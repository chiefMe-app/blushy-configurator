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
  it("the close-up is kept when it is in the same folder, and older renders without one still read", () => {
    expect(readTableRender({ key: "abc1", perspective: P, top: T, close: C })?.close).toBe(C);
    expect(readTableRender({ key: "abc1", perspective: P, top: T, close: "other/3ghi.jpg" })).toEqual({ key: "abc1", perspective: P, top: T });
  });
  it("a stored table keeps a good render and drops a bad one", () => {
    expect(readTableSetup({ ...table(), render: { key: "k1", perspective: P, top: T } }, frozen)!.render).toEqual({ key: "k1", perspective: P, top: T });
    expect(readTableSetup({ ...table(), render: { key: "k1", perspective: FAL, top: FAL } }, frozen)!.render).toBeUndefined();
  });
});

describe("where and how it is photographed", () => {
  it("a garden unless indoors is chosen; the choice is part of the render's key and reads back", () => {
    expect(tablePrompt(table(), frozen, "perspective")).toContain("outdoors in a sunny garden");
    expect(tablePrompt({ ...table(), scene: "indoor" }, frozen, "perspective")).toContain("bright, airy party room");
    expect(tableRenderKey({ ...table(), scene: "indoor" })).not.toBe(tableRenderKey(table()));
    expect(tableRenderKey({ ...table(), scene: "garden" })).toBe(tableRenderKey(table()));
    expect(readTableSetup({ ...table(), scene: "indoor" }, frozen)!.scene).toBe("indoor");
    expect(readTableSetup({ ...table(), scene: "moon" }, frozen)!.scene).toBeUndefined();
  });
  it("each view has its own lens, as in the owner's reference shots", () => {
    expect(tablePrompt(table(), frozen, "perspective")).toMatch(/85mm lens .* looking down the whole length of the table/);
    expect(tablePrompt(table(), frozen, "top")).toContain("straight down from directly above");
    expect(tablePrompt(table(), frozen, "close")).toMatch(/50mm lens .* one place setting/);
  });
});

describe("the prompt", () => {
  it("says the seating exactly as the drawings lay it out", () => {
    expect(seatingWords(table())).toContain("exactly 5 chairs along the left side and 5 along the right side");
    expect(seatingWords(table(), "top")).toContain("5 along the bottom side");
    expect(seatingWords(table({}, 11))).toContain("exactly 6 chairs along the left side and 5");
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

  it("the front view from the drawing first; the top view and the close-up from that photo", async () => {
    const FRONT = "https://v3.fal.media/files/front.jpg";
    subscribe.mockImplementation(async (_m: string, { input }: { input: { prompt: string } }) =>
      ({ data: { images: [{ url: input.prompt.startsWith("Turn this simple line drawing") ? FRONT : FAL }] } }));
    const { POST } = await import("@/app/api/table-render/route");
    const res = await POST(post({ table: table(), theme: "frozen" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("ndjson");
    const got = await lines(res);
    // The pictures come in the answer itself, the front view first: no other address to look up.
    expect(got[0]).toEqual({ view: "perspective", url: PICTURE });
    expect(got.slice(1, 3).map((l) => l.view).sort()).toEqual(["close", "top"]);
    expect(got.slice(0, 3).every((l) => l.url === PICTURE)).toBe(true);
    expect(got[3]).toMatchObject({ done: true });
    expect(got[3].render).toBeUndefined(); // no database here: nothing is kept
    const calls = (subscribe.mock.calls as [string, { input: { image_urls: string[]; prompt: string } }][]).map(([model, { input }]) => ({ model, ...input }));
    expect(calls).toHaveLength(3);
    expect(calls.every((c) => c.model === "fal-ai/bytedance/seedream/v5/lite/edit")).toBe(true);
    const [front, ...after] = calls;
    expect(front.image_urls).toHaveLength(1);
    expect(front.image_urls[0]).toMatch(/^data:image\/png;base64,/);
    expect(front.prompt).toContain("10 chairs in all");
    const top = after.find((c) => c.prompt.includes("from directly above"))!, close = after.find((c) => c.prompt.includes("close-up"))!;
    expect(top.image_urls).toEqual([expect.stringMatching(/^data:image\/png;base64,/), FRONT]); // the layout, then the look
    expect(close.image_urls).toEqual([FRONT]);
    for (const c of calls) expect(c.prompt).not.toMatch(/frozen/i);
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

  it("the front view goes out before the other two are made", async () => {
    let finish!: () => void;
    const held = new Promise<void>((r) => { finish = r; });
    subscribe.mockImplementation(async (_m: string, { input }: { input: { prompt: string } }) => {
      if (!input.prompt.startsWith("Turn this simple line drawing")) await held;
      return { data: { images: [{ url: FAL }] } };
    });
    const { POST } = await import("@/app/api/table-render/route");
    const reader = (await POST(post({ table: table(), theme: "frozen" }))).body!.getReader();
    const first = JSON.parse(new TextDecoder().decode((await reader.read()).value));
    expect(first).toEqual({ view: "perspective", url: PICTURE });
    finish();
    while (!(await reader.read()).done) { /* the rest */ }
  }, 30_000);

  it("fal refusing the account says renders are paused, not to try again", async () => {
    subscribe.mockRejectedValue(Object.assign(new Error("Forbidden"), { status: 403, body: { detail: "User is locked. Reason: TOP_UP." } }));
    const { POST } = await import("@/app/api/table-render/route");
    expect(await lines(await POST(post({ table: table(), theme: "frozen" })))).toEqual([{ error: expect.stringMatching(/paused/) }]);
  });

  it("signed in: both pictures are kept in the customer's folder, and come in the answer", async () => {
    vi.stubEnv("SUPABASE_URL", "https://db.test");
    vi.stubEnv("SUPABASE_ANON_KEY", "anon");
    getUser.mockResolvedValue({ data: { user: { id: USER, is_anonymous: false } }, error: null });
    rpc.mockResolvedValue({ data: 5, error: null });
    subscribe.mockImplementation(async () => ({ data: { images: [{ url: FAL }] } }));
    storeRenderJpeg.mockImplementation(async (_c: unknown, _u: string, _jpeg: Buffer, hash: string) => ({ path: hash.includes("top") ? T : hash.includes("close") ? C : P, key: "k" }));
    const { POST } = await import("@/app/api/table-render/route");
    const got = await lines(await POST(post({ table: table(), theme: "frozen" }, { authorization: "Bearer tok" })));
    expect(got.at(-1)).toMatchObject({ done: true, render: { key: tableRenderKey(table()), perspective: P, top: T, close: C } });
    expect(got.slice(0, 3).every((l) => l.url === PICTURE)).toBe(true);
    expect(storeRenderJpeg.mock.calls.map((c) => [c[1], c[2]])).toEqual([[USER, JPEG], [USER, JPEG], [USER, JPEG]]);
  }, 30_000);
});
