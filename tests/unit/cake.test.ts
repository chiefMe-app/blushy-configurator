// The cake (2026-11-03): the model, its designs, its sums, reading it back and the key its render is kept under.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { THEMES, priceBreakdown, defaultConfig } from "@/lib/config";
import {
  CAKE_FIGURES, CAKE_STYLES, FIGURE_PRICE, MAX_CAKE_DECOS, MAX_CAKE_FIGURES, RAINBOW_PRICE, THEME_CAKE_CUTOUTS, THEME_CAKE_FIGURES, TOPPER_PRICE,
  addItem, cakeDesigns, cakeFiguresFor, cakePriceLines, cakeRenderKey, cakeStack, cakeTotal, defaultCake, figureKind, figurePicture, itemAt, placeItem,
  readCake, roomFor, tierColours, tierPicture, type Cake, type CakeFigure, type CakeItem,
} from "@/lib/studio/cake";
import { cakePrompt } from "@/lib/studio/cakeRender";
import { CAKE_SWEETS, SWEET_PLACES, colourWords, readSweets, sweetPicture } from "@/lib/studio/cakeSweets";
import { cakeLayout, viewOf } from "@/components/builder/cake/CakePreview";
import { fromDraft, toDraft } from "@/lib/draft";
import { resetRenderGuard } from "@/lib/renderGuard";
import { readNdjson } from "@/lib/ndjson";

const subscribe = vi.fn();
vi.mock("@fal-ai/client", () => ({ fal: { config: vi.fn(), subscribe: (...a: unknown[]) => subscribe(...a) } }));
const JPEG = Buffer.from("jpeg-bytes"), PICTURE = `data:image/jpeg;base64,${JPEG.toString("base64")}`;
vi.mock("@/lib/renderStore", () => ({ renderJpeg: async () => JPEG, storeRenderJpeg: async () => null }));
import { POST } from "@/app/api/cake-render/route";

/** A figure on the top, in the middle. */
const onTop = (id: CakeFigure, x = 0): CakeItem => ({ id, on: "top", x, y: 0.4, s: 1 });
const seed = { themeId: "unicorn", themeName: "Unicorn", name: "Olivia", age: "6", colours: ["#F8BBD0", "#FEF08A", "#BBF7D0"] };

describe("cake", () => {
  it("starts as the theme's first design: one smooth tier in its colour, its figure, the name and age on a topper", () => {
    const k = defaultCake(seed);
    expect(k).toMatchObject({ enabled: true, design: "classic", tiers: 1, style: "smooth", figures: [{ id: "unicorn", on: "top", x: 0 }], flavour: "vanilla",
      topper: { on: true, name: "Olivia", age: "6", colour: "gold" } });
    expect(tierColours(k)).toEqual(["#F8BBD0"]);
    expect(defaultCake().topper.age).toBe("5");
  });

  it("has four designs for every theme, each its own tiers and decoration, and a plain cake", () => {
    for (const t of THEMES) {
      const d = cakeDesigns({ themeId: t.id, themeName: t.name, colours: t.balloonColors });
      // A theme with printed cutouts of its own (K-pop, Unicorn) gets a cake of them too.
      const cut = THEME_CAKE_CUTOUTS[t.id] ? ["cutouts"] : [];
      expect(d.map((x) => x.id)).toEqual(["classic", "drip", "ruffle", "grand", ...cut, "plain"]);
      expect(new Set(d.slice(0, 4).map((x) => `${x.cake.tiers}-${x.cake.style}`)).size).toBe(4);
      expect(THEME_CAKE_FIGURES[t.id], t.id).toBeDefined();
      expect(cakeFiguresFor(t.id)[0].own).toBe(true);
      expect(cakeFiguresFor(t.id)).toHaveLength(CAKE_FIGURES.filter((f) => f.kind === "sugar").length);
      if (cut.length) expect(cakeFiguresFor(t.id, "cutout")[0]).toMatchObject({ own: true, kind: "cutout" });
    }
    const plain = cakeDesigns(seed).at(-1)!.cake;
    expect(plain).toMatchObject({ figures: [], colours: ["#FFFFFF", "#FFFFFF", "#FFFFFF"], topper: { on: false } });
  });

  it("has a picture for every tier and figure, and where each tier's top and bottom are", () => {
    for (const s of CAKE_STYLES) {
      const pic = tierPicture(s.id);
      expect(fs.existsSync(path.join("public", pic.src)), s.id).toBe(true);
      expect(pic.bottom - pic.top, s.id).toBeGreaterThan(pic.h * 0.6);
    }
    for (const f of CAKE_FIGURES) expect(fs.existsSync(path.join("public", figurePicture(f.id).src)), f.id).toBe(true);
    expect(fs.existsSync("public/design/cake/stand.webp")).toBe(true);
  });

  it("stacks its tiers on the stand, each narrower, its topper above its figures, all in the photo", () => {
    for (const d of cakeDesigns(seed).filter((x) => x.id !== "cutouts")) {
      const L = cakeLayout({ ...d.cake, topper: { ...d.cake.topper, on: true } });
      expect(L.tiers).toHaveLength(d.cake.tiers);
      L.tiers.forEach((t, i) => { if (i) expect(t.w).toBeLessThan(L.tiers[i - 1].w); });
      for (const f of L.figures) expect(L.words.bottom).toBeLessThan(f.y);
      // The theme's figures stand on the top, side by side.
      expect(d.cake.figures.every((f) => f.on === "top")).toBe(true);
      expect(L.contentTop, d.id).toBeGreaterThan(40);
    }
  });

  it("is priced: its tiers, its decoration on each, the figures, the topper, the flavour", () => {
    const k = { ...defaultCake(seed), figures: [] };
    expect(cakeTotal(k)).toBe(380 + TOPPER_PRICE);
    expect(cakeTotal({ ...k, tiers: 3, style: "ruffles" })).toBe(1250 + 3 * 70 + TOPPER_PRICE);
    expect(cakeTotal({ ...k, figures: [onTop("star"), onTop("heart")] })).toBe(380 + 2 * FIGURE_PRICE + TOPPER_PRICE);
    // A copy is a figure more, on one line.
    const twice = { ...k, figures: [onTop("star"), { ...onTop("star"), on: "side" as const, y: 0.3 }] };
    expect(cakeTotal(twice)).toBe(380 + 2 * FIGURE_PRICE + TOPPER_PRICE);
    expect(cakePriceLines(twice)).toContainEqual({ label: "Cake figure: gold star ×2", amount: 2 * FIGURE_PRICE });
    expect(cakeTotal({ ...k, flavour: "red-velvet" })).toBe(380 + 40 + TOPPER_PRICE);
    // A topper with nothing to say, or off, is not priced.
    expect(cakeTotal({ ...k, topper: { ...k.topper, on: false } })).toBe(380);
    expect(cakeTotal({ ...k, topper: { ...k.topper, name: " ", age: "" } })).toBe(380);
    expect(cakePriceLines({ ...k, tiers: 2, style: "drip" })[0]).toEqual({ label: "Cake: two tiers, drip", amount: 780 + 80 });
    expect(cakePriceLines({ ...k, enabled: false })).toEqual([]);
    const config = { ...defaultConfig(), cake: k };
    expect(priceBreakdown(config).lines.filter((l) => l.section === "cake").map((l) => l.amount)).toEqual([380, TOPPER_PRICE]);
  });

  it("is read back over the defaults, never with what does not belong", () => {
    expect(readCake(null)).toBeUndefined();
    const k = readCake({ tiers: 7, style: "glitter", colours: ["red", "#112233"], figures: ["star", "dragon", "star", "heart", "rocket", "car"], flavour: "mud",
      topper: { on: true, name: "<b>Arya</b> the very long name here", age: "123", font: "../x", colour: "neon" }, design: "../x",
      render: { key: "k1", path: "https://evil.example/a.jpg" } })!;
    expect(k).toMatchObject({ enabled: true, tiers: 1, style: "smooth", flavour: "vanilla", design: "classic" });
    // A cake kept as a list of names (before they could be moved): its figures set on the top, once each, three at most.
    expect(k.figures.map((f) => [f.id, f.on])).toEqual([["star", "top"], ["heart", "top"], ["rocket", "top"]]);
    // Moved figures read back in their places, kept to the cake, eight at most.
    const moved = readCake({ figures: [{ id: "heart", on: "side", x: 9, y: -2, s: 40 }, { id: "nope" }, ...Array(10).fill({ id: "star", on: "top", x: 0.1, y: 0.2, s: 1 })] })!;
    expect(moved.figures[0]).toEqual({ id: "heart", on: "side", x: 0.5, y: 0, s: 2.5 });
    expect(moved.figures).toHaveLength(MAX_CAKE_FIGURES);
    expect(readCake({ topper: { x: 3, up: 50, s: 9 } })!.topper).toMatchObject({ x: 0.4, up: 50, s: 1.6 });
    expect(k.colours[0]).toBe("#112233");
    expect(k.colours).toHaveLength(3);
    expect(k.topper.name).not.toMatch(/[<>]/);
    expect(k.topper.name.length).toBeLessThanOrEqual(18);
    expect(k.topper).toMatchObject({ age: "12", colour: "gold" });
    expect(k.topper.font).toBe(defaultCake().topper.font);
    expect(k.render).toBeUndefined();
    expect(readCake({ topper: { age: "" } })?.topper.age).toBe("");
    expect(readCake({ tiers: 3, style: "drip", enabled: false, done: true })).toMatchObject({ tiers: 3, style: "drip", enabled: false, done: true });
  });

  it("keys its render on what shows: not the flavour, the colours only of its own tiers", () => {
    const k = defaultCake(seed);
    const key = cakeRenderKey(k, "unicorn");
    expect(cakeRenderKey({ ...k, flavour: "lemon" }, "unicorn")).toBe(key);
    expect(cakeRenderKey({ ...k, colours: [k.colours[0], "#000000", "#000000"] }, "unicorn")).toBe(key); // one tier
    expect(cakeRenderKey({ ...k, tiers: 2 }, "unicorn")).not.toBe(key);
    expect(cakeRenderKey({ ...k, style: "drip" }, "unicorn")).not.toBe(key);
    expect(cakeRenderKey({ ...k, figures: [onTop("star")] }, "unicorn")).not.toBe(key);
    // A figure or the topper moved shows: a new render.
    expect(cakeRenderKey({ ...k, figures: k.figures.map((f) => ({ ...f, x: 0.3 })) }, "unicorn")).not.toBe(key);
    expect(cakeRenderKey({ ...k, topper: { ...k.topper, up: 120 } }, "unicorn")).not.toBe(key);
    expect(cakeRenderKey({ ...k, topper: { ...k.topper, name: "Mia" } }, "unicorn")).not.toBe(key);
    const off = { ...k, topper: { ...k.topper, on: false } };
    expect(cakeRenderKey({ ...off, topper: { ...off.topper, name: "Mia" } }, "unicorn")).toBe(cakeRenderKey(off, "unicorn"));
  });

  it("asks the render for its tiers, decoration, figures and the topper's words", () => {
    const k = { ...defaultCake(seed), tiers: 2 as const, style: "drip" as const, figures: [onTop("unicorn"), onTop("star"), { ...onTop("heart"), on: "side" as const, y: 0.3 }, { ...onTop("heart"), on: "side" as const, y: 0.3, x: 0.3 }] };
    const p = cakePrompt(k);
    expect(p).toContain("a two-tier round birthday cake");
    expect(p).toContain("chocolate drip");
    expect(p).toContain("unicorn horn & ears, gold star");
    expect(p).toContain("stuck flat on the sides of the tiers exactly where image 1 has them: heart ×2");
    expect(p).toContain('reading "Olivia" and "6"');
    expect(p).toMatch(/never yellow/);
    expect(cakePrompt({ ...k, topper: { ...k.topper, on: false } })).not.toContain("topper");
    expect(cakePrompt({ ...k, figures: [] })).not.toContain("sugar-paste figures");
  });
});

describe("the figures moved on the cake", () => {
  const st = cakeStack({ tiers: 2, style: "smooth" });
  const star = onTop("star");
  it("stands on the top where its foot is on it, and stays there when the tiers change", () => {
    const at = placeItem(star, st);
    expect(at.y + at.h).toBeCloseTo(st.top + 0.4 * st.depth);
    const moved = itemAt(star, st, 447 + 30, st.top - at.h / 2);
    expect(moved).toMatchObject({ on: "top", x: 30 / st.topW });
    // Three tiers: still on the top, however tall the cake.
    const st3 = cakeStack({ tiers: 3, style: "smooth" });
    const at3 = placeItem(moved, st3);
    expect(at3.y + at3.h).toBeLessThan(st3.top + st3.depth);
  });

  it("sticks on a tier's side lower down, never off the cake", () => {
    const t0 = st.tiers[0];
    const moved = itemAt(star, st, 447 + 1000, (t0.top + t0.bottom) / 2);
    expect(moved.on).toBe("side");
    const at = placeItem(moved, st);
    expect(at.x + at.w / 2).toBeLessThanOrEqual(447 + t0.w * 0.45 + 0.01);
    expect(at.y + at.h / 2).toBeGreaterThan(t0.top);
    expect(itemAt(star, st, 447, 5000).y).toBeGreaterThan(0); // not under the cake
  });

  it("adds a figure on the top while there is room, then on the bottom tier's front, eight at most", () => {
    let k = { tiers: 2 as const, style: "smooth" as const, figures: [] as CakeItem[] };
    for (let i = 0; i < 10; i++) k = { ...k, figures: addItem(k, "heart") };
    expect(k.figures).toHaveLength(MAX_CAKE_FIGURES);
    expect(k.figures.slice(0, 3).every((f) => f.on === "top")).toBe(true);
    expect(k.figures.slice(3).every((f) => f.on === "side")).toBe(true);
    // The three on the top apart from each other.
    const xs = k.figures.slice(0, 3).map((f) => f.x).sort((a, b) => a - b);
    expect(xs[1] - xs[0]).toBeGreaterThan(0.18);
  });
});

describe("cutouts, balls, the name on the front, rainbows and sprinkles", () => {
  // 2026-11-03 (the owner: "cutout topperlar … kpop'ta çıkmalı, unicorn için de"; "pastanın önüne de yazılabilir";
  // "topperı bigger smaller yapınca bütün pasta büyüyüp küçülüyor"; "sprinkles ve rainbow color seçenekleri").
  const st = cakeStack({ tiers: 1, style: "smooth" });
  it("stands a printed cutout on a stick on the top, and puts a ball round the foot; each kind priced and kept apart", () => {
    let k: Cake = { ...defaultCake(seed), figures: [] };
    k = { ...k, figures: addItem(k, "idols") };
    const at = placeItem(k.figures[0], st);
    expect(at.stick).toBeDefined();
    expect(at.y + at.h).toBeLessThan(st.top); // lifted over the top on its stick
    expect(itemAt(k.figures[0], st, at.x + at.w / 2, at.y + at.h / 2)).toMatchObject({ on: "top" });
    k = { ...k, figures: addItem(k, "disco-ball") };
    expect(k.figures[1]).toMatchObject({ on: "side" });
    expect(k.figures[1].y).toBeLessThan(0.1);
    expect(cakePriceLines(k)).toEqual(expect.arrayContaining([{ label: "Cake cutout: pop star trio", amount: 30 }, { label: "Cake decoration: mirror ball", amount: 15 }]));
    for (let i = 0; i < 12; i++) k = { ...k, figures: addItem(k, "silver-ball") };
    expect(k.figures.filter((f) => figureKind(f.id) === "deco")).toHaveLength(MAX_CAKE_DECOS);
    expect(roomFor(k.figures, "heart")).toBe(MAX_CAKE_FIGURES - 1);
  });

  it("has a K-pop cake of pop stars with the name on the front, and a Unicorn one with the name on a cloud", () => {
    const kpop = cakeDesigns({ themeId: "kpop", themeName: "K-Pop" }).find((d) => d.id === "cutouts")!.cake;
    expect(kpop.figures.map((f) => f.id)).toContain("idols");
    expect(kpop.topper).toMatchObject({ at: "front" });
    const L = cakeLayout(kpop);
    expect(L.words.bottom).toBeGreaterThan(st.top); // on the cake's face
    expect(L.words.bottom).toBeLessThan(st.base);
    const uni = cakeDesigns(seed).find((d) => d.id === "cutouts")!.cake;
    expect(uni.topper.card).toBe("cloud");
    expect(cakePrompt({ ...uni, enabled: true })).toMatch(/white cloud-shaped card .*on two thin white sticks/);
    expect(cakePrompt({ ...kpop, enabled: true, topper: { ...kpop.topper, name: "Arya" } })).toMatch(/On the front of the cake keep the name/);
    expect(cakePrompt({ ...kpop, enabled: true })).toMatch(/printed card cutout toppers exactly: pop star trio/);
  });

  it("keeps the picture's view when the topper is made bigger, smaller or moved", () => {
    const k = defaultCake(seed);
    const v = viewOf(k);
    expect(viewOf({ ...k, topper: { ...k.topper, s: 0.7 } })).toEqual(v);
    expect(viewOf({ ...k, topper: { ...k.topper, s: 1.2 } })).toEqual(v);
    expect(viewOf({ ...k, topper: { ...k.topper, at: "front", y: 0.5 } })).toEqual(v);
  });

  it("reads back the topper's place and card, rainbow tiers and sprinkles, and prices them", () => {
    const k = readCake({ tiers: 2, colours: ["rainbow-pastel", "rainbow-nope", "#ffffff"], sprinkles: "base", topper: { on: true, name: "Arya", age: "4", at: "front", y: 3, x: -2, card: "cloud", up: 50 } })!;
    expect(k.colours[0]).toBe("rainbow-pastel");
    expect(k.colours[1]).toBe("#FFFFFF");
    expect(k.sprinkles).toBe("base");
    expect(k.topper).toMatchObject({ at: "front", y: 0.95, x: -0.3, card: "cloud" });
    expect(k.topper.up).toBeUndefined();
    expect(readCake({ sprinkles: "glitter", topper: { card: "square" } })).not.toHaveProperty("sprinkles");
    expect(cakePriceLines(k)).toEqual(expect.arrayContaining([{ label: "Cake: rainbow buttercream ×1 tier", amount: RAINBOW_PRICE }, { label: "Cake sprinkles: a band at the foot", amount: 30 }]));
    const words = cakePrompt(k);
    expect(words).toMatch(/the bottom tier in smoothed patches of pastel/);
    expect(words).toMatch(/thick band of rainbow sprinkles/);
    expect(words).not.toMatch(/no sprinkles/);
    expect(cakeRenderKey(k, "unicorn")).not.toBe(cakeRenderKey({ ...k, sprinkles: undefined }, "unicorn"));
  });
});

describe("the cake kept and rendered", () => {
  it("is kept with the design on the device", () => {
    const config = { ...defaultConfig(), cake: { ...defaultCake(seed), tiers: 3 as const, style: "rosettes" as const } };
    expect(fromDraft(JSON.stringify(toDraft(config, 2, 0)))?.config.cake).toMatchObject({ tiers: 3, style: "rosettes", topper: { name: "Olivia" } });
  });

  const post = (body: unknown) => POST(new NextRequest("http://localhost/api/cake-render", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));
  const lines = async (res: Response) => { const out: Record<string, unknown>[] = []; await readNdjson(res.body!, (l) => out.push(l as Record<string, unknown>)); return out; };
  beforeEach(() => {
    vi.stubEnv("FAL_KEY", "test-key");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_URL", "");
    subscribe.mockReset();
    resetRenderGuard();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("one picture of the preview to FLUX.2 edit, at its own size, with its words", async () => {
    subscribe.mockImplementation(async () => ({ data: { images: [{ url: "https://fal.example/x.jpg" }] } }));
    const drawn = await sharp({ create: { width: 1200, height: 1500, channels: 3, background: "#eeeeee" } }).jpeg().toBuffer();
    const k = defaultCake(seed);
    const got = await lines(await post({ cake: k, theme: "unicorn", preview: `data:image/jpeg;base64,${drawn.toString("base64")}` }));
    expect(got[0]).toEqual({ url: PICTURE });
    expect(got.at(-1)).toMatchObject({ done: true });
    const [model, { input }] = subscribe.mock.calls[0] as [string, { input: { prompt: string; image_urls: string[]; image_size: { width: number; height: number } } }];
    expect(model).toBe("fal-ai/flux-2/edit");
    expect(input.image_urls).toHaveLength(1);
    expect(input.image_size).toEqual({ width: 1120, height: 1408 });
    expect(input.prompt).toBe(cakePrompt(k));
  }, 30_000);

  it("refuses a missing or skipped cake, or no preview, without calling fal", async () => {
    const preview = `data:image/jpeg;base64,${JPEG.toString("base64")}`;
    expect((await post({ theme: "unicorn", preview })).status).toBe(400);
    expect((await post({ cake: { ...defaultCake(), enabled: false }, theme: "unicorn", preview })).status).toBe(400);
    expect((await post({ cake: defaultCake(), theme: "unicorn" })).status).toBe(400);
    expect((await post({ cake: defaultCake(), theme: "nope", preview })).status).toBe(400);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("never opens to everyone on the live site when sign-in is not set up", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect((await post({ cake: defaultCake(), theme: "unicorn", preview: `data:image/jpeg;base64,${JPEG.toString("base64")}` })).status).toBe(503);
    expect(subscribe).not.toHaveBeenCalled();
  });
});

describe("the sweets beside the cake", () => {
  // 2026-11-03 (the owner: "cupcake, cookie, cake pops … ve donut … macaron da olabilir"; on the table, in her colours).
  it("has a photo and its icing for each, a place on the table, and prices by how many", () => {
    for (const s of CAKE_SWEETS) {
      const pic = sweetPicture(s.id);
      expect(fs.existsSync(path.join("public", pic.src)), s.id).toBe(true);
      expect(fs.existsSync(path.join("public", pic.icing)), s.id).toBe(true);
      expect(pic.w).toBeGreaterThan(0);
      expect(SWEET_PLACES[s.id].foot).toBeLessThanOrEqual(1262);
    }
    const k: Cake = { ...defaultCake(seed), sweets: [{ id: "cupcakes", count: 12, colour: "#F8BBD0", topper: "unicorn", sprinkles: true }, { id: "macarons", count: 6, colour: "#DDD6FE" }] };
    expect(cakePriceLines(k)).toEqual(expect.arrayContaining([{ label: "Cupcakes ×12, sprinkles", amount: 12 * (12 + 1) }, { label: "Macarons ×6", amount: 48 }]));
    // On the table: the picture shows the whole table.
    expect(viewOf(k).w).toBe(896);
    const words = cakePrompt(k);
    expect(words).toMatch(/cupcakes in gold foil liners, each with a tall swirl of pink buttercream.*topped with a little sugar-paste unicorn horn/);
    expect(words).toMatch(/French macarons with lilac shells/);
    expect(words).not.toMatch(/no sprinkles/);
    // How many does not change the picture; the colour does.
    const more = { ...k, sweets: [{ ...k.sweets![0], count: 24 as const }, k.sweets![1]] };
    expect(cakeRenderKey(more, "unicorn")).toBe(cakeRenderKey(k, "unicorn"));
    expect(cakeRenderKey({ ...k, sweets: [{ ...k.sweets![0], colour: "#BAE6FD" }] }, "unicorn")).not.toBe(cakeRenderKey(k, "unicorn"));
  });

  it("reads back each sweet once, with what belongs to it", () => {
    const s = readSweets([{ id: "cookies", count: 99, colour: "red", print: "age", topper: "star" }, { id: "cookies" }, { id: "cupcakes", topper: "disco-ball", print: "age" }, { id: "nope" }])!;
    expect(s).toEqual([{ id: "cookies", count: 12, colour: "#FFFFFF", print: "age" }, { id: "cupcakes", count: 12, colour: "#FFFFFF" }]);
    expect(readCake({ sweets: [{ id: "donuts", count: 6, colour: "#bae6fd", sprinkles: true }] })!.sweets).toEqual([{ id: "donuts", count: 6, colour: "#BAE6FD", sprinkles: true }]);
    expect(colourWords("#A855F7")).toBe("purple");
  });
});
