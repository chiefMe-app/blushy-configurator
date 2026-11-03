// The giveaways (2026-11-03, the owner: "giveaway boxlarından hazırlanabilir bir çeşit box olsun … içindekileri
// … liste olarak verelim … masaya mı yoksa giveaway board mu"): the prices, what may be stored, when a render is
// still current, and the route — one picture of the preview, never without the guards.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import sharp from "sharp";
import { defaultConfig, priceBreakdown } from "@/lib/config";
import { BOX_PRICE, GIVEAWAY_BOARD_PRICE, defaultGiveaways, giveawayPriceLines, giveawaysRenderKey, giveawaysTotal, readGiveaways } from "@/lib/studio/giveaways";
import { boardShelves, giveawayPrompt } from "@/lib/studio/giveawayRender";
import { fromDraft, toDraft } from "@/lib/draft";
import { resetRenderGuard } from "@/lib/renderGuard";
import { readNdjson } from "@/lib/ndjson";

const subscribe = vi.fn();
vi.mock("@fal-ai/client", () => ({ fal: { config: vi.fn(), subscribe: (...a: unknown[]) => subscribe(...a) } }));
const JPEG = Buffer.from("jpeg-bytes"), PICTURE = `data:image/jpeg;base64,${JPEG.toString("base64")}`;
// The engine's picture: not a JPEG (the colour step lets it through as it is) unless a test makes one.
let made: Buffer = JPEG;
vi.mock("@/lib/renderStore", () => ({ renderJpeg: async () => made, storeRenderJpeg: async () => null }));
import { POST } from "@/app/api/giveaway-render/route";

const USER = "00000000-0000-4000-8000-0000000000a1";

describe("the giveaways", () => {
  it("a box a child, its contents added to each box, the board once", () => {
    const g = { ...defaultGiveaways({ kids: 12, name: "Arya", age: "6" }) };
    const each = BOX_PRICE + 6 + 5 + 6 + 4 + 12;
    expect(giveawaysTotal(g)).toBe(each * 12);
    expect(giveawaysTotal({ ...g, place: "board" })).toBe(each * 12 + GIVEAWAY_BOARD_PRICE);
    expect(giveawaysTotal({ ...g, contents: [] })).toBe(BOX_PRICE * 12);
    expect(giveawayPriceLines({ ...g, contents: ["candy", "stickers"] })[0].label).toBe("Giveaway boxes × 12 (candy, stickers)");
    expect(giveawayPriceLines({ ...g, enabled: false })).toEqual([]);
  });

  it("are in the party's total", () => {
    const base = defaultConfig();
    const g = defaultGiveaways({ kids: 10 });
    expect(priceBreakdown({ ...base, giveaways: g }).total - priceBreakdown(base).total).toBe(giveawaysTotal(g));
    expect(priceBreakdown({ ...base, giveaways: g }).lines.filter((l) => l.section === "giveaways")).toHaveLength(1);
  });

  it("are read back over the defaults, never with what does not belong", () => {
    expect(readGiveaways(null)).toBeUndefined();
    const g = readGiveaways({ enabled: true, count: 999, place: "roof", contents: ["candy", "bombs"], name: "  Arya  ", age: "6a7", font: "nope", boardColour: "red", boardLine: 5,
      render: { key: "k1", path: "https://evil.example/a.jpg" } })!;
    expect(g).toMatchObject({ count: 60, place: "table", contents: ["candy"], age: "67", font: "sacramento", boardColour: "#FFFFFF", boardLine: "Thank you for coming" });
    expect(g.render).toBeUndefined();
    expect(readGiveaways({ render: { key: "k1", path: `${USER}/g1.jpg` } })!.render).toEqual({ key: "k1", path: `${USER}/g1.jpg` });
  });

  it("are kept on the device with the design", () => {
    const g = { ...defaultGiveaways({ kids: 9, name: "Arya" }), place: "board" as const, boardColour: "#F4B6C2" };
    const back = fromDraft(JSON.stringify(toDraft({ ...defaultConfig(), giveaways: g }, 2, 0)));
    expect(back!.config.giveaways).toMatchObject({ count: 9, name: "Arya", place: "board", boardColour: "#F4B6C2" });
  });

  it("a render is current while what shows is unchanged — not the count or the contents", () => {
    const g = defaultGiveaways({ name: "Arya" });
    const k = giveawaysRenderKey(g, "frozen", "t1");
    expect(giveawaysRenderKey({ ...g, count: 30, contents: [] }, "frozen", "t1")).toBe(k);
    expect(giveawaysRenderKey({ ...g, name: "Maya" }, "frozen", "t1")).not.toBe(k);
    expect(giveawaysRenderKey(g, "frozen", "t2")).not.toBe(k);
    expect(giveawaysRenderKey(g, "unicorn", "t1")).not.toBe(k);
    // On the board, its colour shows and the table does not.
    const b = { ...g, place: "board" as const };
    expect(giveawaysRenderKey(b, "frozen", "t1")).toBe(giveawaysRenderKey(b, "frozen", "t2"));
    expect(giveawaysRenderKey({ ...b, boardColour: "#000000" }, "frozen")).not.toBe(giveawaysRenderKey(b, "frozen"));
  });

  it("the prompt keeps the boxes' words, the board's flat vinyl and neutral light", () => {
    const p = giveawayPrompt({ ...defaultGiveaways({ name: "Arya", age: "6" }), place: "board" });
    expect(p).toContain('"Arya" and "6"');
    expect(p).toMatch(/flat cut vinyl/);
    expect(p).toMatch(/never yellow or orange/);
    // Every box drawn, shelf by shelf (the test render dropped two of ten).
    expect(p).toContain("Exactly 10 gift boxes");
    expect(boardShelves(10)).toBe("three on the top shelf, three on the second shelf, three on the third shelf, one on the bottom shelf");
    expect(boardShelves(40)).toMatch(/three on the bottom shelf$/);
    expect(giveawayPrompt(defaultGiveaways({ name: "Arya" }))).toMatch(/seen from straight above/);
    // With the boxes laid on afterwards, the engine is told the shelves stay empty and never to draw characters.
    const after = giveawayPrompt({ ...defaultGiveaways({ name: "Arya", age: "6" }), place: "board" }, { boxesAfter: true });
    expect(after).toMatch(/EMPTY: nothing on them/);
    expect(after).toMatch(/no faces, no characters/);
    expect(after).not.toMatch(/gift boxes on its shelves/);
  });
});

describe("the route", () => {
  const post = (body: unknown) => POST(new NextRequest("http://localhost/api/giveaway-render", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));
  const lines = async (res: Response) => { const out: Record<string, unknown>[] = []; await readNdjson(res.body!, (l) => out.push(l as Record<string, unknown>)); return out; };
  beforeEach(() => {
    vi.stubEnv("FAL_KEY", "test-key");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_URL", "");
    subscribe.mockReset();
    made = JPEG;
    resetRenderGuard();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("one picture of the preview to FLUX.2 edit, at its own size", async () => {
    subscribe.mockImplementation(async () => ({ data: { images: [{ url: "https://fal.example/x.jpg" }] } }));
    const drawn = await sharp({ create: { width: 1400, height: 1800, channels: 3, background: "#eeeeee" } }).jpeg().toBuffer();
    const g = { ...defaultGiveaways({ name: "Arya", age: "6" }), place: "board" as const };
    const got = await lines(await post({ giveaways: g, theme: "frozen", preview: `data:image/jpeg;base64,${drawn.toString("base64")}` }));
    expect(got[0]).toEqual({ url: PICTURE });
    expect(got.at(-1)).toMatchObject({ done: true });
    const [model, { input }] = subscribe.mock.calls[0] as [string, { input: { prompt: string; image_urls: string[]; image_size: { width: number; height: number } } }];
    expect(model).toBe("fal-ai/flux-2/edit");
    expect(input.image_urls).toHaveLength(1);
    expect(input.image_size).toEqual({ width: 1088, height: 1408 });
    expect(input.prompt).toBe(giveawayPrompt(g));
  }, 30_000);

  it("the boxes sent on their own are laid on the render afterwards, the engine told the shelves are empty", async () => {
    subscribe.mockImplementation(async () => ({ data: { images: [{ url: "https://fal.example/x.jpg" }] } }));
    made = await sharp({ create: { width: 640, height: 832, channels: 3, background: "#d0c8c8" } }).jpeg().toBuffer();
    const drawn = await sharp({ create: { width: 640, height: 832, channels: 3, background: "#d0c8c8" } }).jpeg().toBuffer();
    // One box: a red block on a clear ground.
    const boxes = await sharp({ create: { width: 640, height: 832, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: { create: { width: 80, height: 100, channels: 4, background: { r: 220, g: 20, b: 20, alpha: 1 } } }, left: 280, top: 300 }]).png().toBuffer();
    const g = { ...defaultGiveaways({ name: "Arya" }), place: "board" as const };
    const got = await lines(await post({ giveaways: g, theme: "frozen", preview: `data:image/jpeg;base64,${drawn.toString("base64")}`, boxes: `data:image/png;base64,${boxes.toString("base64")}` }));
    const [, { input }] = subscribe.mock.calls[0] as [string, { input: { prompt: string } }];
    expect(input.prompt).toBe(giveawayPrompt(g, { boxesAfter: true }));
    const out = Buffer.from(String(got[0].url).split(",")[1], "base64");
    const px = async (x: number, y: number) => Array.from((await sharp(out).extract({ left: x, top: y, width: 1, height: 1 }).raw().toBuffer()));
    const [r, gg, b] = await px(320, 350);
    expect(r).toBeGreaterThan(180); expect(gg).toBeLessThan(60); expect(b).toBeLessThan(60);
    // Its soft shadow just under it.
    const [r2] = await px(320, 405);
    expect(r2).toBeLessThan(200);
  }, 30_000);

  it("refuses missing or skipped giveaways, or no preview, without calling fal", async () => {
    const preview = `data:image/jpeg;base64,${JPEG.toString("base64")}`;
    expect((await post({ theme: "frozen", preview })).status).toBe(400);
    expect((await post({ giveaways: { ...defaultGiveaways(), enabled: false }, theme: "frozen", preview })).status).toBe(400);
    expect((await post({ giveaways: defaultGiveaways(), theme: "frozen" })).status).toBe(400);
    expect((await post({ giveaways: defaultGiveaways(), theme: "nope", preview })).status).toBe(400);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("never opens to everyone on the live site when sign-in is not set up", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect((await post({ giveaways: defaultGiveaways(), theme: "frozen", preview: `data:image/jpeg;base64,${JPEG.toString("base64")}` })).status).toBe(503);
    expect(subscribe).not.toHaveBeenCalled();
  });
});
