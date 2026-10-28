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
    expect(tablePrompt(table(), frozen, [])).toContain("about 50 degrees down, not straight down");
  });
});

describe("the pictures and the prompt", () => {
  it("the chosen options' pictures, at most ten, named in the prompt in the same order", () => {
    const refs = referencePictures(table(), "frozen");
    expect(refs.slice(0, 4)).toEqual([
      { key: "table", photo: "/design/table/table-standard.webp" },
      { key: "chairs", photo: "/design/table/chairs-white_kids.webp" },
      { key: "placemats", photo: "/design/table/placemats/frozen/pattern.webp" },
      { key: "plates", photo: "/design/table/plates-iridescent.webp" },
    ]);
    const p = tablePrompt(table(), frozen, refs.map((r) => r.key));
    expect(p).toContain(`Images 1 to ${refs.length} are product photos`);
    expect(p).toContain("image 1 is the table, image 2 is the chair, image 3 is the placemat's printed design, image 4 is the plate");
    expect(p).toContain("ignore everything around it");
    // Every piece chosen: ten pictures at most; the cloth and the hat go in words only.
    const all = referencePictures(table({ tablecloth: "classic", cutleryHolder: "pocket", bottleLabel: "pattern" }), "frozen");
    expect(all).toHaveLength(MAX_REFERENCES);
    expect(all.map((r) => r.key)).not.toContain("partyHats");
    expect(all.map((r) => r.key)).not.toContain("tablecloth");
  });
  it("exactly the chosen setup: the table's shape, a bare top unless a cloth is chosen, nothing extra", () => {
    const p = tablePrompt(table({ table: "cloud" }), frozen, ["table"]);
    expect(p).toContain("whose edges are soft rounded scallops like a cloud — exactly the table in its photo");
    expect(p).toContain("no tablecloth: its own bare top and edges show");
    expect(p).toMatch(/Nothing that is not listed: no confetti/);
    expect(tablePrompt(table({ tablecloth: "classic" }), frozen, [])).toContain("covered with a smooth floor-length white tablecloth");
  });
  it("the customer's words go on the placemat, and are the only words", () => {
    const p = tablePrompt({ ...table(), words: { placemats: "Arya turns 6" } }, frozen, []);
    // In the bottom-right corner, like the owner's reference — never on the plate (her first render).
    // Bottom-right, one word a line, like the owner's reference — never on the plate (her first render).
    expect(p).toContain('with the words printed in its bottom-right corner in elegant letters, stacked one word per line ("Arya" above "turns" above "6") — never on the plate');
    expect(p).toContain('The only words anywhere are "Arya turns 6"');
    expect(tablePrompt(table(), frozen, [])).toContain("No text and no letters anywhere.");
    expect(tableRenderKey({ ...table(), words: { placemats: "Arya turns 6" } })).not.toBe(tableRenderKey(table()));
    // No placemat: no words.
    expect(tablePrompt({ ...table({ placemats: NONE }), words: { placemats: "Arya" } }, frozen, [])).not.toContain("Arya");
  });
  it("two children facing each other at one part of a big table, each with the whole setting set out as the owner wants", () => {
    const t = { ...table({ cutleryHolder: "band", bottleLabel: "watercolour", napkins: "printed", centrepiece: "florals" }), words: { cutleryHolder: "Arya", bottleLabel: "Arya turns 6" } };
    const refs = referencePictures(t, "frozen").map((r) => r.key);
    const p = tablePrompt(t, frozen, refs);
    expect(p).toContain("one part of a big, fully set children's party table");
    expect(p).toContain("clearly a table for many children, not a table for two");
    expect(p).toContain("TWO place settings facing each other");
    expect(p).toContain("Two chairs face each other on the two sides of the table");
    // The cutlery only on the left, rolled up in the chosen napkin with the band, as in the holder's picture.
    expect(p).toContain(`on the left of the placemat: a disposable natural wooden fork, knife and spoon — exactly as in image ${refs.indexOf("cutlery") + 1}, rolled up in a folded paper napkin printed with snowflakes and little stars — exactly as in image ${refs.indexOf("napkins") + 1} and held by a paper napkin band with a little name tag with the name "Arya" on it, arranged exactly like the cutlery holder in image ${refs.indexOf("cutleryHolder") + 1}`);
    expect(p).toContain("The only cutlery anywhere is the one set on the left of each placemat");
    expect(p).toContain("on the top-right corner of the placemat; just beside the cup, a small clear water bottle");
    expect(p).toContain('with "Arya turns 6" printed on the label — the cup and the bottle are both there');
    expect(p).toContain("a cone party hat standing on the top-left corner of the placemat");
    expect(p).toMatch(/Between the two settings, in the middle of the table: a small, low, compact arrangement of a few pastel flowers/);
    expect(p).toContain('The only words anywhere are "Arya" and "Arya turns 6"');
    expect(refs).toContain("centrepiece");
  });
  it("a plain napkin is its chosen colour, in words: its picture (another colour) is not sent", () => {
    const t = table({ napkins: "plain" });
    expect(referencePictures(t, "frozen").map((r) => r.key)).not.toContain("napkins");
    expect(tablePrompt(t, frozen, [])).toMatch(/a plain [a-z ]+ paper napkin/);
    // A bottle without words says so: no made-up words on it.
    expect(tablePrompt(table({ bottleLabel: "pattern" }), frozen, ["bottleLabel"])).toContain("its label with no words");
  });
  it("None has no picture; the low table has cushions, not chairs", () => {
    expect(referencePictures(table({ placemats: NONE }), "frozen").some((r) => r.key === "placemats")).toBe(false);
    const low = table({ table: "low" });
    expect(referencePictures(low, "frozen").some((r) => r.key === "chairs")).toBe(false);
    const p = tablePrompt(low, frozen, referencePictures(low, "frozen").map((r) => r.key));
    expect(p).toContain("Two white floor cushions face each other");
    expect(p).not.toMatch(/The chair is/);
  });
  it("describes every choice, skips None, and never names the theme", () => {
    const p = tablePrompt(table({ chairs: "bow_kids", table: "flower", partyHats: NONE }), frozen, []);
    expect(p).toContain("a pink metal children's chair with a round mesh seat and a back shaped like a bow");
    expect(p).toContain("shaped like a flower with six big round petals");
    expect(p).not.toMatch(/a cone party hat|crown/);
    expect(p).not.toMatch(/frozen/i); // a character-free look: colours only
    expect(p).toMatch(/No people.*no cartoon characters/);
  });
  it("a kids' party: printed paper in the theme's pattern, disposable cutlery, nothing formal", () => {
    const p = tablePrompt(table(), frozen, []);
    expect(p).toContain("A3 paper placemat printed all over with snowflakes and little stars");
    expect(p).toContain("disposable paper plate with a shimmering iridescent");
    expect(p).toContain("disposable natural wooden fork, knife and spoon");
    expect(p).toContain("a cone party hat");
    expect(p).toMatch(/children's birthday party.*no glassware, no china, no charger plates/);
    expect(tablePrompt(table(), themeById("dinosaur")!, [])).toContain("printed all over with dinosaur footprints and leaves");
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
    expect(calls[0].image_urls).toHaveLength(referencePictures(table(), "frozen").length);
    for (const u of calls[0].image_urls) expect(u).toMatch(/^data:image\/jpeg;base64,/);
    expect(calls[0].prompt).toContain("TWO place settings facing each other");
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
