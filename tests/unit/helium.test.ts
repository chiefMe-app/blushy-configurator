// The helium balloons (2026-11-04): the model, its sums, reading it back, where each balloon goes, the words for its
// render and the route that makes it.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { defaultConfig, priceBreakdown } from "@/lib/config";
import {
  BUBBLE_PRICE, HELIUM_ROOM, LETTER_PRICE, PLAIN_FOIL_PRICE, THEME_FOILS, PLAIN_FOILS, THEME_FOIL_PRICE, THEME_FOIL_PICKS,
  cleanLetters, defaultHelium, foilsFor, heliumEmpty, heliumPicture, heliumPriceLines, heliumRenderKey, heliumTotal, readHelium, type Helium,
} from "@/lib/studio/helium";
import { heliumLayout } from "@/lib/studio/heliumLayout";
import { heliumPrompt } from "@/lib/studio/heliumRender";
import { finishedPieces } from "@/lib/finishedDesigns";
import { fromDraft, toDraft } from "@/lib/draft";
import { resetRenderGuard } from "@/lib/renderGuard";
import { readNdjson } from "@/lib/ndjson";

const subscribe = vi.fn();
vi.mock("@fal-ai/client", () => ({ fal: { config: vi.fn(), subscribe: (...a: unknown[]) => subscribe(...a) } }));
const JPEG = Buffer.from("jpeg-bytes"), PICTURE = `data:image/jpeg;base64,${JPEG.toString("base64")}`;
vi.mock("@/lib/renderStore", () => ({ renderJpeg: async () => JPEG, storeRenderJpeg: async () => null }));
import { POST } from "@/app/api/helium-render/route";

const seed = { themeId: "unicorn", age: "6", name: "Arya", balloons: ["pastel-matte-609-pink", "pastel-matte-650-lilac"] };
const full = (): Helium => ({
  ...defaultHelium(seed), bouquets: 3, size: "large", foils: ["star"], topperColour: "#D9B45A",
  number: { ...defaultHelium(seed).number, on: true },
  letters: { on: true, text: "ARYA", colour: "#D9A08E" }, ceiling: 50,
  bubble: { on: true, name: "Arya", filling: "mini", colour: "#FFFFFF" },
});

describe("the helium balloons", () => {
  it("start from the party: one bouquet with the theme's own foil in its colours; the age ready but off, letters and bubble off", () => {
    // The owner's first look (2026-11-04): "default olarak 1 buket olsun, age balon olmasın hemen".
    const h = defaultHelium(seed);
    expect(h).toMatchObject({ enabled: true, bouquets: 1, size: "medium", foils: ["unicorn"], balloons: seed.balloons, ceiling: 0 });
    expect(h.number).toMatchObject({ on: false, value: "6" });
    expect(h.letters).toMatchObject({ on: false, text: "ARYA" });
    expect(h.bubble).toMatchObject({ on: false, name: "Arya" });
    // A theme without a foil of its own starts on the plain star.
    expect(defaultHelium({ themeId: "luxury_neutral" }).foils).toEqual(["star"]);
  });

  it("offer the theme's own foils first, then the plain ones, then every other shape — never a licensed character", () => {
    const list = foilsFor("frozen");
    expect(list.slice(0, 2).map((f) => f.id)).toEqual(["snowflake", "crown"]);
    expect(list.slice(2, 6).map((f) => f.id)).toEqual(PLAIN_FOILS.map((f) => f.id));
    expect(list).toHaveLength(THEME_FOILS.length + PLAIN_FOILS.length);
    for (const picks of Object.values(THEME_FOIL_PICKS)) for (const id of picks) expect(THEME_FOILS.some((f) => f.id === id)).toBe(true);
    // Every foil and latex balloon has its picture.
    for (const id of [...THEME_FOILS.map((f) => f.id), ...PLAIN_FOILS.map((f) => f.id), "latex-a", "latex-d"]) {
      const pic = heliumPicture(id);
      expect(pic.w).toBeGreaterThan(50);
      expect(fs.existsSync(path.join(process.cwd(), "public", pic.src))).toBe(true);
    }
  });

  it("price every piece on its own line and add to the party", () => {
    const h = full();
    const lines = heliumPriceLines(h);
    expect(lines.map((l) => l.label)).toEqual([
      "3 helium bouquets, 9 balloons (Sempertex 609, 650), star foil", 'Foil number "6", 80 cm', 'Foil letters "ARYA"', "50 ceiling balloons", 'Name bubble balloon "Arya", mini balloons',
    ]);
    expect(lines[0].amount).toBe((210 + PLAIN_FOIL_PRICE) * 3);
    expect(lines[2].amount).toBe(LETTER_PRICE * 4);
    expect(lines[4].amount).toBe(BUBBLE_PRICE + 40);
    expect(heliumPriceLines({ ...h, foils: ["unicorn"] })[0].amount).toBe((210 + THEME_FOIL_PRICE) * 3);
    // Several foils on each bouquet (the owner, 2026-11-04: "birkaç tane foil balon seçebilsin"), priced each.
    const three = heliumPriceLines({ ...h, foils: ["unicorn", "star", "heart"] })[0];
    expect(three).toEqual({ label: "3 helium bouquets, 9 balloons (Sempertex 609, 650), unicorn + star + heart foils", amount: (210 + THEME_FOIL_PRICE + 2 * PLAIN_FOIL_PRICE) * 3 });
    expect(heliumPriceLines({ ...h, foils: [] })[0]).toEqual({ label: "3 helium bouquets, 9 balloons (Sempertex 609, 650)", amount: 630 });
    expect(heliumPriceLines({ ...h, number: { ...h.number, value: "10", size: "100" } })[1].amount).toBe(240);
    const config = { ...defaultConfig(), helium: h };
    const base = priceBreakdown({ ...defaultConfig() }).total;
    expect(priceBreakdown(config).total).toBe(base + heliumTotal(h));
    expect(priceBreakdown(config).lines.filter((l) => l.section === "helium")).toHaveLength(5);
    // Skipped: nothing.
    expect(heliumPriceLines({ ...h, enabled: false })).toEqual([]);
    expect(heliumEmpty({ ...defaultHelium(), bouquets: 0, number: { ...defaultHelium().number, on: false } })).toBe(true);
  });

  it("read back over the defaults, whatever comes in", () => {
    const h = full();
    expect(readHelium(JSON.parse(JSON.stringify(h)))).toEqual(h);
    const bad = readHelium({ bouquets: 40, size: "huge", foils: ["mickey", "star", "star", "heart", "round", "cloud"], balloons: ["nope", "reflex-970-gold", "reflex-970-gold"], ceiling: 33,
      number: { on: true, value: "x7y", colour: "#123456" }, letters: { on: true, text: "ar ya 5!" }, bubble: { on: true, name: "<b>Arya</b>", filling: "gold" },
      render: { key: "../x", path: "nope" } })!;
    expect(bad).toMatchObject({ bouquets: 6, size: "medium", foils: ["star", "heart", "round"], balloons: ["reflex-970-gold"], ceiling: 0 });
    // Kept before the Sempertex balloons, as colours: each the nearest balloon, the matte one on a tie.
    expect(readHelium({ colours: ["#F8BBD0", "#FFFFFF", "red"] })!.balloons).toEqual(["pastel-matte-174-pink", "fashion-002-white"]);
    // Kept before several foils: one topper, or none.
    expect(readHelium({ topper: "unicorn" })!.foils).toEqual(["unicorn"]);
    expect(readHelium({ topper: "none" })!.foils).toEqual([]);
    expect(readHelium({ topper: "mickey" })!.foils).toEqual(["star"]);
    expect(bad.number).toMatchObject({ on: true, value: "7", colour: "#D9B45A" });
    expect(bad.letters.text).toBe("ARYA");
    expect(bad.bubble).toMatchObject({ name: "bAryab", filling: "confetti" });
    expect(bad).not.toHaveProperty("render");
    expect(readHelium(null)).toBeUndefined();
    expect(cleanLetters("Mia-Rose")).toBe("MIAROSE");
  });

  it("are kept with the design on the device, and shown with the finished designs", () => {
    const config = { ...defaultConfig(), helium: full() };
    expect(fromDraft(JSON.stringify(toDraft(config, 2, 0)))?.config.helium).toEqual(config.helium);
    expect(finishedPieces(config).map((p) => p.id)).toContain("helium");
    expect(finishedPieces({ ...config, helium: { ...config.helium, enabled: false } }).map((p) => p.id)).not.toContain("helium");
  });

  it("change the render's key with what shows, and only with that", () => {
    const h = full();
    const k = heliumRenderKey(h, "unicorn");
    expect(heliumRenderKey({ ...h, done: true, render: { key: "a", path: "u/a.jpg" } }, "unicorn")).toBe(k);
    expect(heliumRenderKey({ ...h, ceiling: 25 }, "unicorn")).not.toBe(k);
    expect(heliumRenderKey({ ...h, bubble: { ...h.bubble, name: "Mia" } }, "unicorn")).not.toBe(k);
    expect(heliumRenderKey(h, "frozen")).not.toBe(k);
  });

  it("stand in the room: bouquets either side of the number and the bubble, the ceiling's balloons up top", () => {
    const h = full();
    const L = heliumLayout(h);
    expect(L.bouquets).toHaveLength(3);
    for (const q of L.bouquets) {
      expect(q.balloons).toHaveLength(9);
      expect(q.foils).toHaveLength(1);
      // Every balloon leaning along its ribbon: left of the weight, its top to the left (anticlockwise).
      for (const b of q.balloons) if (Math.abs(b.x - q.weight.x) > 30) expect(Math.sign(b.tilt)).toBe(Math.sign(b.x - q.weight.x));
      // Clear of the middle, where the number and the bubble stand.
      expect(q.x < 480 || q.x > 870).toBe(true);
    }
    // Her colours, each as often as the other, mixed: never two of a colour side by side where it can be helped,
    // and the bouquets not all alike.
    expect(new Set(L.bouquets.flatMap((q) => q.balloons.map((b) => b.sempertex)))).toEqual(new Set(h.balloons));
    expect(L.bouquets[0].balloons.find((b) => b.sempertex === "pastel-matte-609-pink")!.colour).toBe("#F8BBD0");
    for (const q of L.bouquets) {
      const count = h.balloons.map((c) => q.balloons.filter((b) => b.sempertex === c).length);
      expect(Math.max(...count) - Math.min(...count)).toBeLessThanOrEqual(1);
    }
    const rows = (q: (typeof L.bouquets)[number]) => q.balloons.map((b) => b.colour).join();
    expect(new Set(L.bouquets.map(rows)).size).toBeGreaterThan(1);
    // The foils their real size: the star 60 cm, a unicorn 75 cm, on the longest side.
    const star = L.bouquets[0].foils[0];
    expect(Math.max(star.w, star.h)).toBeCloseTo(60 * HELIUM_ROOM.perCm);
    const uni = heliumLayout({ ...h, foils: ["unicorn"] }).bouquets[0].foils[0];
    expect(Math.max(uni.w, uni.h)).toBeCloseTo(75 * HELIUM_ROOM.perCm);
    // Three foils fanned: the first in the middle and highest, drawn last (in front), the others either side.
    const fan = heliumLayout({ ...h, foils: ["unicorn", "star", "heart"] }).bouquets[0];
    const mid = fan.foils.at(-1)!;
    expect(mid.id).toBe("unicorn");
    expect(mid.x).toBeCloseTo(fan.x);
    const sides = fan.foils.slice(0, 2);
    expect(sides.map((f) => Math.sign(f.x - fan.x)).sort()).toEqual([-1, 1]);
    for (const f of sides) expect(f.y).toBeGreaterThan(mid.y);
    expect(L.number).toBeDefined();
    expect(L.bubble).toBeDefined();
    expect(Math.abs(L.number!.x - L.bubble!.x)).toBeGreaterThan(L.bubble!.r + 60);
    expect(L.letters).toBeDefined();
    expect(L.ceiling).toHaveLength(50);
    for (const b of L.ceiling) expect(b.y).toBeLessThan(260);
    // Nothing in the middle: the bouquets spread across the room, and no foil asked for, none drawn.
    const lone = heliumLayout({ ...h, number: { ...h.number, on: false }, bubble: { ...h.bubble, on: false }, foils: [], bouquets: 1 });
    expect(lone.bouquets[0].x).toBe(672);
    expect(lone.bouquets[0].foils).toEqual([]);
    expect(lone.number).toBeUndefined();
    // One bouquet alone: the picture closes in on it, the room's shape kept, the bouquet and its weight in it.
    const one = heliumLayout(defaultHelium(seed));
    const v = one.view;
    expect(L.view).toEqual(HELIUM_ROOM.view); // balloons on the ceiling: all of the room
    expect(v.w).toBeLessThan(HELIUM_ROOM.view.w * 0.9);
    expect(v.w / v.h).toBeCloseTo(HELIUM_ROOM.view.w / HELIUM_ROOM.view.h);
    const q = one.bouquets[0];
    expect(q.foils[0].y - q.foils[0].h / 2).toBeGreaterThan(v.y);
    expect(q.weight.y).toBeLessThan(v.y + v.h);
    expect(v.y + v.h).toBeLessThanOrEqual(HELIUM_ROOM.h);
    // A 100 cm number is taller than an 80 cm one.
    expect(heliumLayout({ ...h, number: { ...h.number, size: "100" } }).number!.h).toBeGreaterThan(L.number!.h);
  });

  it("are told to the engine as they are: each piece, the letters spelled out, the room kept, no characters", () => {
    const p = heliumPrompt(full());
    expect(p).toMatch(/3 helium balloon bouquets standing on the floor, each 9 28 cm latex balloons: Sempertex 609 Pastel Matte Pink \(soft baby pink, matte pastel\) and Sempertex 650 Pastel Matte Lilac \(pastel matte lilac\) mixed together, with a big gold star foil balloon on top, 60 cm/);
    expect(p).toMatch(/The bouquets' latex balloons, from left to right, are exactly ([54] Sempertex (609|650) [^;]+ and [54] Sempertex (609|650) [^;]+(; )?){3}, each in the colour and the place image 1 shows/);
    expect(heliumPrompt(defaultHelium(seed))).toMatch(/The bouquet's latex balloons are exactly 4 Sempertex (609|650) .+ and 3 Sempertex (609|650) /);
    // Every finish of the catalogue said as it is: chrome, metallic.
    expect(heliumPrompt({ ...full(), balloons: ["reflex-970-gold", "metallic-570-gold"] })).toMatch(/Sempertex 970 Reflex Gold .* and Sempertex 570 Metallic Gold/);
    expect(p).toMatch(/a giant gold foil number 6 balloon, 80 cm tall/);
    expect(p).toMatch(/The foil letters spell exactly A R Y A/);
    expect(p).toMatch(/about 50 loose latex helium balloons floating against the ceiling/);
    expect(p).toMatch(/clear bubble balloon filled with small pastel balloons, the name "Arya" on it/);
    expect(p).toMatch(/well-exposed/);
    expect(p).toMatch(/latex balloons in image 1 are only drawn stand-ins: photograph each one anew/);
    expect(p).toMatch(/never drawn, illustrated, smooth CGI or 3D-rendered/);
    expect(p).toMatch(/the white wall/);
    expect(p).not.toMatch(/pink wall/);
    expect(p).toMatch(/Nothing added: no people, no characters/);
    expect(heliumPrompt({ ...full(), foils: ["unicorn", "heart"] })).toMatch(/with 2 foil balloons on top, side by side: a big printed unicorn shaped foil balloon, 75 cm; a big gold heart foil balloon, 60 cm, the first the one in the middle/);
    const plain = heliumPrompt({ ...full(), foils: ["unicorn"], letters: { on: false, text: "", colour: "#D9B45A" }, bubble: { ...full().bubble, on: false }, ceiling: 0 });
    expect(plain).toMatch(/a big printed unicorn shaped foil balloon on top, 75 cm/);
    expect(plain).not.toMatch(/foil letter|against the ceiling|bubble balloon filled/);
  });
});

describe("the helium balloons' render", () => {
  const post = (body: unknown) => POST(new NextRequest("http://localhost/api/helium-render", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));
  const lines = async (res: Response) => { const out: Record<string, unknown>[] = []; await readNdjson(res.body!, (l) => out.push(l as Record<string, unknown>)); return out; };
  beforeEach(() => {
    vi.stubEnv("FAL_KEY", "test-key");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_URL", "");
    subscribe.mockReset();
    resetRenderGuard();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("one picture of the preview to FLUX.2 [pro] edit, at its own size and a steady seed, with its words", async () => {
    subscribe.mockImplementation(async () => ({ data: { images: [{ url: "https://fal.example/x.jpg" }] } }));
    const drawn = await sharp({ create: { width: 1344, height: 1008, channels: 3, background: "#f3c6cc" } }).jpeg().toBuffer();
    const h = full();
    const got = await lines(await post({ helium: h, theme: "unicorn", preview: `data:image/jpeg;base64,${drawn.toString("base64")}` }));
    expect(got[0]).toEqual({ url: PICTURE });
    expect(got.at(-1)).toMatchObject({ done: true });
    const [model, { input }] = subscribe.mock.calls[0] as [string, { input: { prompt: string; image_urls: string[]; image_size: { width: number; height: number }; seed?: number } }];
    expect(model).toBe("fal-ai/flux-2-pro/edit");
    expect(input.image_urls).toHaveLength(1);
    expect(input.image_size).toEqual({ width: 1344, height: 1008 });
    expect(input).toMatchObject({ seed: 777 });
    expect(input.prompt).toBe(heliumPrompt(h));
  }, 30_000);

  it("refuses skipped or empty balloons, or no preview, without calling fal", async () => {
    const preview = `data:image/jpeg;base64,${JPEG.toString("base64")}`;
    expect((await post({ theme: "unicorn", preview })).status).toBe(400);
    expect((await post({ helium: { ...full(), enabled: false }, theme: "unicorn", preview })).status).toBe(400);
    const none = { ...defaultHelium(), bouquets: 0, number: { ...defaultHelium().number, on: false } };
    expect((await post({ helium: none, theme: "unicorn", preview })).status).toBe(400);
    expect((await post({ helium: full(), theme: "unicorn" })).status).toBe(400);
    expect(subscribe).not.toHaveBeenCalled();
  });
});
