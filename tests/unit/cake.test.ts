// The cake (2026-11-03): the model, its designs, its sums, reading it back and the key its render is kept under.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { THEMES, priceBreakdown, defaultConfig } from "@/lib/config";
import {
  CAKE_BOARD, CART_BOARD, CAKE_STAND, cakeViews, holderOf, topperColour,
  CAKE_FIGURES, CAKE_STYLES, FIGURE_PRICE, MAX_CAKE_DECOS, MAX_CAKE_FIGURES, RAINBOW_PRICE, THEME_CAKE_CUTOUTS, THEME_CAKE_FIGURES, TOPPER_PRICE,
  addItem, cakeDesigns, cakeFiguresFor, cakePriceLines, cakeRenderKey, cakeStack, cakeTotal, defaultCake, figureKind, figurePicture, itemAt, placeItem,
  plainCake, readCake, roomFor, tierColours, tierPicture, type Cake, type CakeFigure, type CakeItem,
} from "@/lib/studio/cake";
import { cakePrompt } from "@/lib/studio/cakeRender";
import {
  CAKE_CART, CAKE_PLINTHS, CAKE_SWEETS, CART_BALLOONS_PRICE, CART_PRICE, CART_SWEET_PLACES, PLINTH_SPOTS, PLINTHS_PRICE, SWEET_FLAVOURS, SWEET_PLACES, SWEET_SPOTS, colourWords,
  readSweets, sweetPicture, sweetPlaces,
} from "@/lib/studio/cakeSweets";
import { cakeLayout, viewBoxOf, viewOf } from "@/components/builder/cake/CakePreview";
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
  it("puts the unicorn face's flower mane down the bottom tier's left, off its face", () => {
    // 2026-11-04 (the owner: "çiçekler unicorn'un suratında geliyor … örnekte koyduğum yere koy").
    const face = cakeDesigns(seed).find((d) => d.id === "face")!.cake;
    const mane = face.figures.find((f) => f.id === "flower-mane")!;
    const st = cakeStack(face);
    expect(mane).toMatchObject({ on: "side" });
    expect(mane.x).toBeLessThan(-0.3);
    const mid = st.base - mane.y * (st.base - st.top);
    expect(mid).toBeGreaterThan(st.tiers[0].top); // on the bottom tier
  });

  it("opens as the plain white cake (2026-11-04, the owner: \"cake plain white default gelsin\")", () => {
    expect(plainCake(seed)).toMatchObject({ enabled: true, design: "plain", tiers: 1, figures: [], topper: { on: false } });
    expect(tierColours(plainCake(seed))).toEqual(["#FFFFFF"]);
  });
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
      // The unicorn's face and its sugar unicorns (2026-11-03).
      const own = t.id === "unicorn" ? ["face", "sweet"] : [];
      expect(d.map((x) => x.id)).toEqual(["classic", "drip", "ruffle", "grand", ...cut, ...own, "plain"]);
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
    for (const d of cakeDesigns(seed).filter((x) => !["cutouts", "face", "sweet"].includes(x.id))) {
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
    // The light (2026-11-03, the owner: "çok sarı, kaliteli durmuyor hiç"): clean white, and the tiers counted.
    // 2026-11-04 (the owner: "şu örnekteki gibi içim açılsın … ışık ve renkler"): a party photo shoot's light, candy pastels.
    // Later (her render "gene karanlık ve kasvet çıktı"): high-key, even, from the front, never darker than the preview.
    // Then ("aşırı aydınlık ortam"): well exposed, the wall a step below the white cake.
    expect(p).toMatch(/well-exposed kids' birthday party photo.*from the front and from both sides.*the left side of the cake.*as bright as the right.*never overexposed.*a step darker than the white of the cake.*never yellow, cream, ivory, beige or grey.*candy-bright pastel colours.*never darker.*no dim, moody, dramatic or low-key light/);
    expect(p).toContain("a pink heart stays pink, never turned gold or glitter");
    // Real, not the preview's flat pieces kept (her Seedream render: "bu sefer de gerçek gibi durmadı").
    expect(p).toMatch(/Rebuild every part as a real object photographed by a real camera — nothing flat, drawn, pasted on/);
    // Sugar figures hand-made (the owner: "rainbow daha gerçekçi nasıl olabilir"), smooth buttercream kept smooth, no hard shadow.
    expect(p).toContain("hand-rolled and hand-cut — soft rounded edges a little uneven, fine seams");
    expect(cakePrompt({ ...k, style: "smooth" })).toContain("no ridges, comb lines or spatula marks");
    expect(p).not.toContain("no ridges");
    expect(p).toContain("No direct sunlight and no hard shadows anywhere");
    expect(cakePrompt({ ...k, colours: ["#FFFFFF", "#FFFFFF", "#FFFFFF"] })).toContain("the bottom tier and its border in pure bright white (never ivory, cream or yellow) buttercream".replace(/^./, "T"));
    expect(p).toMatch(/exactly two tiers stacked, never more and never fewer/);
    // Each tier's colour by name (a test render greyed a mint tier to sage), its border too.
    const named = cakePrompt({ ...k, colours: ["#F8BBD0", "#BBF7D0", "#FFFFFF"] });
    expect(named).toMatch(/The bottom tier and its border in pink buttercream, the top tier and its border in mint green buttercream — bright, clean and fresh/);
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
    // Cut along its own outline (2026-11-04: Seedream set a rainbow cutout on a grey rectangle of card).
    expect(cakePrompt({ ...kpop, enabled: true })).toContain("cut out exactly along the picture's own outline with a thin white edge — never a rectangle");
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

  it("one picture of the preview to Seedream 4.5 edit, at its shape scaled up to Seedream's least, with its words", async () => {
    subscribe.mockImplementation(async () => ({ data: { images: [{ url: "https://fal.example/x.jpg" }] } }));
    const drawn = await sharp({ create: { width: 1200, height: 1500, channels: 3, background: "#eeeeee" } }).jpeg().toBuffer();
    const k = defaultCake(seed);
    const got = await lines(await post({ cake: k, theme: "unicorn", preview: `data:image/jpeg;base64,${drawn.toString("base64")}` }));
    expect(got[0]).toEqual({ url: PICTURE });
    expect(got.at(-1)).toMatchObject({ done: true });
    const [model, { input }] = subscribe.mock.calls[0] as [string, { input: { prompt: string; image_urls: string[]; image_size: { width: number; height: number } } }];
    expect(model).toBe("fal-ai/bytedance/seedream/v4.5/edit");
    expect(input.image_urls).toHaveLength(1);
    expect(input.image_size).toEqual({ width: 1728, height: 2160 });
    expect(input.prompt).toBe(cakePrompt(k));
    // A close-up of what is on it: its own words and its own key; a view of what is not there is the whole picture.
    subscribe.mockClear();
    const sweet: Cake = { ...k, sweets: [{ id: "cookies", count: 6, colour: "#F8BBD0", print: "age" }] };
    await lines(await post({ cake: sweet, theme: "unicorn", view: "cookies", preview: `data:image/jpeg;base64,${drawn.toString("base64")}` }));
    expect((subscribe.mock.calls[0] as [string, { input: { prompt: string } }])[1].input.prompt).toBe(cakePrompt(sweet, "cookies"));
    subscribe.mockClear();
    await lines(await post({ cake: k, theme: "unicorn", view: "donuts", preview: `data:image/jpeg;base64,${drawn.toString("base64")}` }));
    expect((subscribe.mock.calls[0] as [string, { input: { prompt: string } }])[1].input.prompt).toBe(cakePrompt(k));
  }, 30_000);

  it("refuses a missing or skipped cake, or no preview, without calling fal", async () => {
    const preview = `data:image/jpeg;base64,${JPEG.toString("base64")}`;
    expect((await post({ theme: "unicorn", preview })).status).toBe(400);
    expect((await post({ cake: { ...defaultCake(), enabled: false }, theme: "unicorn", preview })).status).toBe(400);
    expect((await post({ cake: defaultCake(), theme: "unicorn" })).status).toBe(400);
    expect((await post({ cake: defaultCake(), theme: "nope", preview })).status).toBe(400);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("refuses a preview whose photos did not paint (bare white), without calling fal", async () => {
    // 2026-11-04: on the owner's iPhone the close-ups came with only their lettering, and the engine made up a cake.
    const blank = await sharp({ create: { width: 1200, height: 1500, channels: 3, background: "#ffffff" } }).jpeg().toBuffer();
    const res = await post({ cake: defaultCake(seed), theme: "unicorn", preview: `data:image/jpeg;base64,${blank.toString("base64")}` });
    expect(res.status).toBe(422);
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
    expect(cakePriceLines(k)).toEqual(expect.arrayContaining([{ label: "Cupcakes ×12, vanilla, sprinkles", amount: 12 * (12 + 1) }, { label: "Macarons ×6, vanilla", amount: 48 }]));
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

  it("has a flavour of its own for each sweet", () => {
    // 2026-11-03 (the owner: "flavour her sweet için ayrı seçilsin"): read back, priced as before, named on its line, not in the picture.
    for (const s of CAKE_SWEETS) expect(SWEET_FLAVOURS[s.id].length, s.id).toBeGreaterThan(2);
    const back = readSweets([{ id: "macarons", count: 6, colour: "#DDD6FE", flavour: "pistachio" }, { id: "donuts", count: 6, colour: "#FFFFFF", flavour: "pistachio" }])!;
    expect(back).toEqual([{ id: "macarons", count: 6, colour: "#DDD6FE", flavour: "pistachio" }, { id: "donuts", count: 6, colour: "#FFFFFF" }]);
    const k: Cake = { ...defaultCake(seed), sweets: back };
    expect(cakePriceLines(k)).toEqual(expect.arrayContaining([{ label: "Macarons ×6, pistachio", amount: 48 }, { label: "Donuts ×6, classic", amount: 66 }]));
    expect(cakeRenderKey(k, "unicorn")).toBe(cakeRenderKey({ ...k, sweets: [{ ...back[0], flavour: undefined }, back[1]] }, "unicorn"));
  });

  it("puts the cupcakes in liners of her colour", () => {
    // 2026-11-03 (the owner: "cupcake kağıdının rengini de seçebilsin"): gold foil, silver foil or paper in a colour.
    expect(fs.existsSync(path.join("public", sweetPicture("cupcakes").liner))).toBe(true);
    const cup = { id: "cupcakes" as const, count: 12 as const, colour: "#FFFFFF" };
    expect(readSweets([{ ...cup, liner: "#f8bbd0" }])![0].liner).toBe("#F8BBD0");
    expect(readSweets([{ ...cup, liner: "silver" }])![0].liner).toBe("silver");
    expect(readSweets([{ ...cup, liner: "copper" }])![0].liner).toBeUndefined();
    expect(readSweets([{ id: "donuts", count: 6, colour: "#FFFFFF", liner: "silver" }])![0].liner).toBeUndefined();
    const k = (liner?: string): Cake => ({ ...defaultCake(seed), sweets: [{ ...cup, ...(liner ? { liner } : {}) }] });
    expect(cakePrompt(k())).toMatch(/cupcakes in gold foil liners/);
    expect(cakePrompt(k("silver"))).toMatch(/cupcakes in shiny silver foil liners/);
    expect(cakePrompt(k("#F8BBD0"))).toMatch(/cupcakes in pink paper liners/);
    // Rainbow confetti paper (2026-11-04, the owner: "rainbow liners'ta güzelmiş, onu da ekleyelim"); bare without sprinkles.
    expect(readSweets([{ ...cup, liner: "rainbow" }])![0].liner).toBe("rainbow");
    expect(cakePrompt(k("rainbow"))).toMatch(/cupcakes in white paper liners printed all over with tiny rainbow confetti dots, each with/);
    expect(cakePrompt(k(), "cupcakes")).toMatch(/with no sprinkles on them at all/);
    expect(cakePrompt({ ...k(), sweets: [{ ...cup, sprinkles: true }, { id: "cookies", count: 6, colour: "#FFFFFF" }] }, "cupcakes")).toMatch(/the iced cookies beside them, every one of them kept/);
    expect(cakeRenderKey(k("#F8BBD0"), "unicorn")).not.toBe(cakeRenderKey(k(), "unicorn"));
  });

  it("prints a cookie's picture as big as its face, the back ones too", () => {
    // 2026-11-03 (the owner: "cookies'de daha büyümeli şekiller, o yuvarlak büyüklüğünde olsun, taşmasın").
    const k: Cake = { ...defaultCake(seed), sweets: [{ id: "cookies", count: 12, colour: "#FFFFFF", print: "rainbow" }] };
    expect(cakePrompt(k, "cookies")).toMatch(/each printed with a big rainbow filling its iced face nearly to the edge but never over it/);
    // Without sprinkles, nothing but the print (2026-11-04, the owner: "sprinkle seçmemiştim ama sprinkle'lı gelmiş").
    expect(cakePrompt(k, "cookies")).toMatch(/on plain smooth icing with nothing else on it — no sprinkles/);
    expect(cakePrompt(k, "cookies")).toMatch(/no fresh flowers, no sprinkles, no extra words/);
    // Every cookie in sight has its print, inside the photo.
    for (const p of SWEET_SPOTS.cookies!) {
      expect(p.x - p.w / 2).toBeGreaterThanOrEqual(0);
      expect(p.x + p.w / 2).toBeLessThanOrEqual(1);
    }
    expect(SWEET_SPOTS.cookies!.length).toBe(6);
    // Every face about as wide as the front ones' (2026-11-04, the owner: "arkadakilerin üstündeki rainbowlar küçülmüş").
    for (const p of SWEET_SPOTS.cookies!) expect(p.w).toBeGreaterThan(0.36);
  });
});

describe("the sweet cart", () => {
  // 2026-11-03 (the owner: "cake cart opsiyonu da olabilir"; later "stripe olmasın artık, bu şekilde olsun … fiyonkları
  // yapma … burdaki gibi balon seçeneği olsun"): a white wooden cart, its roof white or in her colour, balloons if she likes.
  it("has its photo and roof, prices the cart, and says it in the render", () => {
    expect(fs.existsSync(path.join("public", CAKE_CART.src))).toBe(true);
    expect(fs.existsSync(path.join("public", CAKE_CART.awning))).toBe(true);
    // The sweets stand between the cart's posts, on its counter.
    for (const s of CAKE_SWEETS) {
      const x = CART_SWEET_PLACES[s.id].x * CAKE_CART.scale + CAKE_CART.x;
      expect(x, s.id).toBeGreaterThan(258);
      expect(x, s.id).toBeLessThan(752);
    }
    const k: Cake = { ...defaultCake(seed), cart: { roof: "#FFFFFF" } };
    expect(cakePriceLines(k)).toContainEqual({ label: "Sweet cart", amount: CART_PRICE });
    expect(cakeTotal(k)).toBe(cakeTotal(defaultCake(seed)) + CART_PRICE);
    expect(cakePrompt(k)).toMatch(/on the counter of a white wooden sweet cart with a flat white wooden roof with a scalloped trim/);
    expect(cakePrompt(k)).not.toMatch(/stripe|balloon/);
    expect(cakePrompt({ ...k, cart: { roof: "#F8BBD0" } })).toMatch(/a flat pink wooden roof/);
    expect(cakePrompt(defaultCake(seed))).not.toMatch(/cart/);
    expect(cakeRenderKey(k, "unicorn")).not.toBe(cakeRenderKey(defaultCake(seed), "unicorn"));
    expect(cakeRenderKey({ ...k, cart: { roof: "#BAE6FD" } }, "unicorn")).not.toBe(cakeRenderKey(k, "unicorn"));
  });

  it("stands a three-tier cake clear of the roof", () => {
    // Anything on the cake stands under the roof (its scalloped edge at y 250 in the cart photo).
    expect(CAKE_CART.room * CAKE_CART.scale + CAKE_CART.y).toBeLessThan(380);
    expect(CAKE_CART.room * CAKE_CART.scale + CAKE_CART.y).toBeGreaterThan(250);
    for (const d of cakeDesigns(seed)) {
      const L = cakeLayout({ ...d.cake, tiers: 3, cart: { roof: "#FFFFFF" } });
      // The cake itself a good way under it.
      expect(L.st.top * CAKE_CART.scale + CAKE_CART.y, d.id).toBeGreaterThan(330);
    }
  });

  it("puts a balloon garland on it, in the party's balloons, priced and said", () => {
    const k: Cake = { ...defaultCake(seed), cart: { roof: "#FFFFFF", balloons: ["#F8BBD0", "#BAE6FD", "#FEF08A"] } };
    expect(cakePriceLines(k)).toContainEqual({ label: "Balloon garland on the cart", amount: CART_BALLOONS_PRICE });
    expect(cakeTotal(k)).toBe(cakeTotal(defaultCake(seed)) + CART_PRICE + CART_BALLOONS_PRICE);
    expect(cakePrompt(k)).toMatch(/garland of real matte latex balloons in pink, baby blue, yellow/);
    expect(cakeRenderKey(k, "unicorn")).not.toBe(cakeRenderKey({ ...k, cart: { roof: "#FFFFFF" } }, "unicorn"));
    expect(cakeRenderKey(k, "unicorn")).not.toBe(cakeRenderKey({ ...k, cart: { roof: "#FFFFFF", balloons: ["#FFFFFF"] } }, "unicorn"));
  });

  it("reads the cart back: its colour or white, its balloons", () => {
    expect(readCake({ cart: { roof: "#bae6fd" } })!.cart).toEqual({ roof: "#BAE6FD" });
    expect(readCake({ cart: { roof: "blue" } })!.cart).toEqual({ roof: "#FFFFFF" });
    // The striped awning's colour, kept before the wooden cart: its roof starts white (the owner: "çatısı default beyaz gelsin").
    expect(readCake({ cart: { awning: "#F8BBD0" } })!.cart).toEqual({ roof: "#FFFFFF" });
    expect(readCake({ cart: { roof: "#FFFFFF", balloons: ["#f8bbd0", "nope", 3] } })!.cart).toEqual({ roof: "#FFFFFF", balloons: ["#F8BBD0"] });
    expect(readCake({ cart: { roof: "#FFFFFF", balloons: [] } })!.cart).toEqual({ roof: "#FFFFFF" });
    expect(readCake({})!.cart).toBeUndefined();
  });
});

describe("the plinths", () => {
  // 2026-11-03 (the owner: "pastayı plinth üzerinde de görmek isteyebilir … diğer sweet'leri seçtiyse onlar da diğer
  // plinth'lerde olacak").
  it("stands the cake on the tall middle plinth and each sweet on a plinth of its own", () => {
    expect(fs.existsSync(path.join("public", CAKE_PLINTHS.src))).toBe(true);
    expect(fs.existsSync(path.join("public", CAKE_PLINTHS.board))).toBe(true);
    const all: Cake = { ...defaultCake(seed), plinths: true, sweets: CAKE_SWEETS.map((s) => ({ id: s.id, count: 12, colour: "#F8BBD0" })) };
    const at = sweetPlaces(all);
    expect(new Set(CAKE_SWEETS.map((s) => `${at[s.id].x},${at[s.id].foot}`)).size).toBe(5);
    expect(CAKE_SWEETS.map((s) => ({ x: at[s.id].x, foot: at[s.id].foot }))).toEqual(PLINTH_SPOTS);
    // Two sweets: the plinths beside the cake.
    const two: Cake = { ...all, sweets: all.sweets!.filter((s) => s.id === "cookies" || s.id === "macarons") };
    expect([sweetPlaces(two).cookies, sweetPlaces(two).macarons].map((p) => ({ x: p.x, foot: p.foot }))).toEqual(PLINTH_SPOTS.slice(0, 2));
    expect(cakePriceLines(all)).toContainEqual({ label: "Plinth display", amount: PLINTHS_PRICE });
    const words = cakePrompt(all);
    expect(words).toMatch(/standing on a white cake stand on top of a tall round white plinth/);
    expect(words).toMatch(/On the other plinths, each on its own, keep the sweets/);
    expect(words).toMatch(/the five white round plinths exactly as image 1 has them/);
    expect(cakePrompt(all, "cookies")).toMatch(/on a round white plinth/);
    expect(cakeRenderKey(all, "unicorn")).not.toBe(cakeRenderKey({ ...all, plinths: undefined }, "unicorn"));
    // Three tiers on a board there; the whole display in view, inside its photo.
    expect(holderOf({ tiers: 3, plinths: true }).board).toBe(true);
    expect(cakeStack({ ...all, tiers: 3 }).base).toBe(holderOf({ tiers: 3, plinths: true }).plate.y);
    expect(viewBoxOf(all, "whole")).toEqual(CAKE_PLINTHS.view);
    const b = viewBoxOf(all, "cake");
    expect(b.y + b.h).toBeLessThanOrEqual(CAKE_PLINTHS.h + 0.01);
  });

  it("is read back only without the cart", () => {
    expect(readCake({ plinths: true })!.plinths).toBe(true);
    expect(readCake({ plinths: true, cart: { roof: "#FFFFFF" } })!.plinths).toBeUndefined();
    expect(readCake({ plinths: "yes" })!.plinths).toBeUndefined();
  });
});

describe("the card behind the name", () => {
  // 2026-11-03 (the owner: "yazının arkasındaki cloud kartın rengini seçebilsin").
  it("is white or in her colour, read back, said and kept apart in the render", () => {
    const k: Cake = { ...defaultCake(seed), topper: { ...defaultCake(seed).topper, card: "cloud", cardColour: "#bae6fd" } };
    const back = readCake(k)!;
    expect(back.topper.cardColour).toBe("#BAE6FD");
    expect(cakePrompt(back)).toMatch(/a baby blue cloud-shaped card/);
    expect(cakePrompt({ ...back, topper: { ...back.topper, cardColour: undefined } })).toMatch(/a white cloud-shaped card/);
    expect(cakeRenderKey(back, "unicorn")).not.toBe(cakeRenderKey({ ...back, topper: { ...back.topper, cardColour: undefined } }, "unicorn"));
    // No card, no card colour.
    expect(readCake({ ...k, topper: { ...k.topper, card: undefined } })!.topper.cardColour).toBeUndefined();
    expect(readCake({ ...k, topper: { ...k.topper, cardColour: "nope" } })!.topper.cardColour).toBeUndefined();
  });

  it("has a border of the letters' colour, hers, or none", () => {
    // 2026-11-03 (the owner: "card color beyaz seçtim ama dışında pembe border oldu, onu da seçtirsin").
    const k: Cake = { ...defaultCake(seed), topper: { ...defaultCake(seed).topper, card: "plaque", colour: "gold" } };
    expect(cakePrompt(k)).toMatch(/a white rounded plaque with a thin gold border/);
    const none = readCake({ ...k, topper: { ...k.topper, cardBorder: "none" } })!;
    expect(none.topper.cardBorder).toBe("none");
    expect(cakePrompt(none)).toMatch(/a white rounded plaque with no border/);
    const blue = readCake({ ...k, topper: { ...k.topper, cardBorder: "#bae6fd" } })!;
    expect(blue.topper.cardBorder).toBe("#BAE6FD");
    expect(cakePrompt(blue)).toMatch(/with a thin baby blue border/);
    expect(new Set([k, none, blue].map((x) => cakeRenderKey(x, "unicorn"))).size).toBe(3);
    expect(readCake({ ...k, topper: { ...k.topper, card: undefined, cardBorder: "none" } })!.topper.cardBorder).toBeUndefined();
  });
});

describe("the board, the lettering and the close-ups", () => {
  // 2026-11-03 (the owner: "3 katlı olunca alttaki cake holder'ın ayaksızı olsun … name text her renkte olabilsin …
  // name on board or name on cake … unicorn face … sugar unicorn figure … cart ile render alınca birkaç çeşit görüntü").
  it("stands a three-tier cake on a flat board, on the table or the cart", () => {
    const k: Cake = { ...defaultCake(seed), tiers: 3 };
    expect(fs.existsSync(path.join("public", CAKE_BOARD.src))).toBe(true);
    expect(fs.existsSync(path.join("public", CART_BOARD.src))).toBe(true);
    expect(holderOf(defaultCake(seed))).toMatchObject({ board: false, plate: CAKE_STAND.plate });
    expect(cakeStack(k).base).toBe(CAKE_BOARD.plate.y);
    expect(cakeStack({ ...k, cart: { roof: "#F8BBD0" } }).base).toBe(CART_BOARD.plate.y);
    expect(cakePrompt(k)).toMatch(/standing on a wide round white cake board on a table/);
    expect(cakePrompt(defaultCake(seed))).toMatch(/standing on a white cake stand on a table/);
  });

  it("has the unicorn's face and its sugar unicorns", () => {
    const d = cakeDesigns(seed);
    const face = d.find((x) => x.id === "face")!.cake, sweet = d.find((x) => x.id === "sweet")!.cake;
    expect(face.figures.map((f) => [f.id, f.on])).toEqual([["unicorn", "top"], ["unicorn-lashes", "side"], ["flower-mane", "side"], ["rainbow", "side"]]);
    expect(face.topper.at).toBe("board");
    expect(sweet.figures.map((f) => f.id)).toEqual(expect.arrayContaining(["sugar-unicorn", "peeking-unicorn"]));
    // Read back as they are: the thin sleepy eyes keep their size.
    expect(readCake(face)!.figures).toEqual(face.figures);
    expect(cakePrompt({ ...face, enabled: true })).toMatch(/stuck flat on the sides.*rainbow, sleepy eyes, flower mane/);
  });

  it("puts the name on the board, in any colour, as real sugar letters", () => {
    const k: Cake = { ...defaultCake(seed), topper: { ...defaultCake(seed).topper, at: "board", colour: "#f8bbd0", card: "cloud" } };
    const back = readCake(k)!;
    expect(back.topper).toMatchObject({ at: "board", colour: "#F8BBD0" });
    const L = cakeLayout(back);
    expect(L.words.board).toBe(true);
    // Its letters' foot just in front of the cake's foot; not above the cake.
    expect(L.words.bottom).toBeGreaterThan(L.st.base);
    expect(L.contentTop).toBe(cakeLayout({ ...back, topper: { ...back.topper, on: false } }).contentTop);
    expect(topperColour("#F8BBD0")).toMatchObject({ shiny: false, words: "pink" });
    expect(topperColour("gold").shiny).toBe(true);
    const words = cakePrompt(back);
    expect(words).toMatch(/On the cake stand's plate at the foot of the cake.*pink sugar-paste letters reading "Olivia" and "6"/);
    expect(words).toMatch(/never flat print/);
    expect(cakePrompt({ ...back, topper: { ...back.topper, at: "front", colour: "gold" } })).toMatch(/gold-painted sugar-paste letters with a soft metallic shine/);
    expect(readCake({ topper: { colour: "nope" } })!.topper.colour).toBe("gold");
  });

  it("has a close-up of the cake and of each sweet on it, each its own picture", () => {
    const k: Cake = { ...defaultCake(seed), cart: { roof: "#F8BBD0" }, sweets: [{ id: "cookies", count: 12, colour: "#F8BBD0", print: "age" }] };
    expect(cakeViews(k)).toEqual(["whole", "cake", "cookies"]);
    expect(cakeRenderKey(k, "unicorn", "cookies")).toBe(`${cakeRenderKey(k, "unicorn")}:cookies`);
    for (const v of cakeViews(k)) {
      const b = viewBoxOf(k, v);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(CAKE_CART.w + 0.01);
      expect(b.y + b.h).toBeLessThanOrEqual(CAKE_CART.h + 0.01);
      if (v !== "whole") expect(b.w / b.h).toBeCloseTo(0.8, 2);
    }
    // A close-up is nearer than the whole cart.
    expect(viewBoxOf(k, "cake").w).toBeLessThan(viewBoxOf(k, "whole").w);
    expect(cakePrompt(k, "cookies")).toMatch(/^Image 1 is a close-up preview of round sugar cookies.*printed with a big number "6"/);
    expect(cakePrompt(k, "cake")).toMatch(/close-up preview of a birthday cake.*softly out of focus/);
    // The sweets at the close-up's edge named with their icing (2026-11-04: a test render dropped the cupcakes).
    expect(cakePrompt(k, "cake")).toContain("the iced cookies with their pink icing beside the cake, every one of them kept in its colours");
    // No wall left over the cake for a topper that is not on top (the engine filled it with a tier and more unicorns).
    const front = { ...k, cart: undefined, topper: { ...k.topper, at: "front" as const } };
    const onTop = { ...front, topper: { ...front.topper, at: undefined } };
    expect(viewBoxOf(front, "cake").y).toBeGreaterThan(viewBoxOf(onTop, "cake").y + 20);
    expect(cakePrompt(k)).toMatch(/the whole sweet cart in view, never zoomed in or cropped/);
    // The close-ups' renders are kept, and read back only when they are a close-up's.
    const kept = readCake({ ...k, views: { cookies: { key: "abc123:cookies", path: "u1/k1.jpg" }, whole: { key: "x", path: "u1/k2.jpg" }, nope: { key: "y", path: "u1/k3.jpg" } } })!;
    expect(kept.views).toEqual({ cookies: { key: "abc123:cookies", path: "u1/k1.jpg" } });
  });
});
