// The piñata (2026-11-03): the model, its sums, reading it back and the key its render is kept under.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { THEMES, priceBreakdown, defaultConfig } from "@/lib/config";
import {
  EXTRA_DIGIT_PRICE, NUMBER_PINATA_PRICE, PINATA_SHAPES, SHAPE_PINATA_PRICE, THEME_PINATAS, cleanAge, defaultPinata,
  digitPicture, pinataForTheme, pinataPriceLines, pinataRenderKey, pinataShapesFor, pinataTotal, readPinata, shapePicture,
} from "@/lib/studio/pinata";
import { pinataPrompt } from "@/lib/studio/pinataRender";
import { fromDraft, toDraft } from "@/lib/draft";
import { resetRenderGuard } from "@/lib/renderGuard";
import { readNdjson } from "@/lib/ndjson";

const subscribe = vi.fn();
vi.mock("@fal-ai/client", () => ({ fal: { config: vi.fn(), subscribe: (...a: unknown[]) => subscribe(...a) } }));
const JPEG = Buffer.from("jpeg-bytes"), PICTURE = `data:image/jpeg;base64,${JPEG.toString("base64")}`;
vi.mock("@/lib/renderStore", () => ({ renderJpeg: async () => JPEG, storeRenderJpeg: async () => null }));
import { POST } from "@/app/api/pinata-render/route";

describe("piñata", () => {
  it("starts as a number piñata of the age, in the theme's colours, pulled open", () => {
    const p = defaultPinata({ themeId: "unicorn", age: "6", colours: ["#F8BBD0", "#FEF08A", "#BBF7D0", "#BAE6FD"] });
    expect(p).toMatchObject({ enabled: true, kind: "number", number: "6", colours: ["#F8BBD0", "#FEF08A", "#BBF7D0"], shape: "unicorn", opening: "pull" });
    expect(defaultPinata().number).toBe("5");
  });

  it("has a shape for every theme, its own first, and pictures for every shape and digit", () => {
    for (const t of THEMES) {
      const shapes = pinataShapesFor(t.id);
      expect(shapes).toHaveLength(PINATA_SHAPES.length);
      expect(shapes[0].own).toBe(true);
      expect(THEME_PINATAS[t.id], t.id).toBeDefined();
    }
    for (const s of PINATA_SHAPES) {
      const pic = shapePicture(s.id);
      expect(pic.w, s.id).toBeGreaterThan(0);
      expect(fs.existsSync(path.join("public", pic.src)), s.id).toBe(true);
    }
    for (const d of "0123456789") expect(fs.existsSync(path.join("public", digitPicture(d).src))).toBe(true);
  });

  it("takes an age of 1 to 99 only", () => {
    expect(cleanAge("7")).toBe("7");
    expect(cleanAge("12")).toBe("12");
    expect(cleanAge("07")).toBe("7");
    expect(cleanAge("0")).toBe("");
    expect(cleanAge("abc")).toBe("");
    expect(cleanAge("123")).toBe("12");
  });

  it("is priced: the number by its digits, a shape, the stick, the fillings", () => {
    const p = { ...defaultPinata(), fillings: [] };
    expect(pinataTotal(p)).toBe(NUMBER_PINATA_PRICE.medium);
    expect(pinataTotal({ ...p, number: "10" })).toBe(NUMBER_PINATA_PRICE.medium + EXTRA_DIGIT_PRICE.medium);
    expect(pinataTotal({ ...p, kind: "shape" })).toBe(SHAPE_PINATA_PRICE.medium);
    // Large (2026-11-03: "medium ve large iki size olsun").
    expect(pinataTotal({ ...p, size: "large", number: "10" })).toBe(NUMBER_PINATA_PRICE.large + EXTRA_DIGIT_PRICE.large);
    expect(pinataTotal({ ...p, size: "large", kind: "shape" })).toBe(SHAPE_PINATA_PRICE.large);
    expect(pinataPriceLines({ ...p, size: "large" })[0].label).toBe('Number piñata "5", large');
    expect(pinataPriceLines({ ...p, opening: "stick" }).map((l) => l.label)).toContain("Piñata stick & blindfold");
    expect(pinataPriceLines({ ...p, fillings: ["candy", "confetti"] })).toHaveLength(3);
    expect(pinataPriceLines({ ...p, enabled: false })).toEqual([]);
    const config = { ...defaultConfig(), pinata: p };
    expect(priceBreakdown(config).lines.filter((l) => l.section === "pinata").map((l) => l.amount)).toEqual([NUMBER_PINATA_PRICE.medium]);
  });

  it("is read back over the defaults, never with what does not belong", () => {
    expect(readPinata(null)).toBeUndefined();
    const p = readPinata({ kind: "roof", number: "abc", colours: ["red", "#112233", "#445566", "#778899", "#AABBCC"], shape: "nope", opening: "bomb", fillings: ["candy", "rocks"],
      render: { key: "k1", path: "https://evil.example/a.jpg" } })!;
    expect(p).toMatchObject({ enabled: true, kind: "number", number: "5", colours: ["#112233", "#445566", "#778899"], shape: "star", opening: "pull", size: "medium", fillings: ["candy"] });
    expect(readPinata({ size: "large" })?.size).toBe("large");
    expect(readPinata({ size: "huge" })?.size).toBe("medium");
    expect(p.render).toBeUndefined();
    expect(readPinata({ kind: "shape", shape: "rocket", opening: "stick", enabled: false, done: true })).toMatchObject({ kind: "shape", shape: "rocket", opening: "stick", enabled: false, done: true });
  });

  it("keys its render on what shows: not the fillings, the colours only on a number", () => {
    const p = defaultPinata({ themeId: "unicorn" });
    const k = pinataRenderKey(p, "unicorn");
    expect(pinataRenderKey({ ...p, fillings: [] }, "unicorn")).toBe(k);
    expect(pinataRenderKey({ ...p, number: "7" }, "unicorn")).not.toBe(k);
    expect(pinataRenderKey({ ...p, colours: ["#000000"] }, "unicorn")).not.toBe(k);
    expect(pinataRenderKey({ ...p, opening: "stick" }, "unicorn")).not.toBe(k);
    expect(pinataRenderKey({ ...p, size: "large" }, "unicorn")).not.toBe(k);
    const s = { ...p, kind: "shape" as const };
    expect(pinataRenderKey({ ...s, colours: ["#000000"] }, "unicorn")).toBe(pinataRenderKey(s, "unicorn"));
  });

  it("asks the render for the number and the opening it shows", () => {
    const p = defaultPinata({ age: "4" });
    expect(pinataPrompt(p)).toContain("the number 4");
    expect(pinataPrompt(p)).toContain("about 50 cm tall");
    expect(pinataPrompt({ ...p, size: "large" })).toContain("about 75 cm tall");
    expect(pinataPrompt(p)).toContain("pull strings");
    expect(pinataPrompt({ ...p, kind: "shape", shape: "rocket", opening: "stick" })).toMatch(/rocket piñata.*blindfold/);
  });
});

describe("the piñata kept and rendered", () => {
  it("is kept with the design on the device", () => {
    const config = { ...defaultConfig(), pinata: { ...defaultPinata({ age: "7" }), kind: "shape" as const, shape: "rocket" as const, shapeTheme: defaultConfig().theme } };
    expect(fromDraft(JSON.stringify(toDraft(config, 2, 0)))?.config.pinata).toMatchObject({ kind: "shape", shape: "rocket", number: "7" });
  });

  // 2026-11-07, the owner: "pinata bozuk" — a Unicorn party's piñata kept as a Frozen snowflake from before.
  it("opened again, another theme's shape gives way to this theme's; one she picked here stays", () => {
    const kept = (p: object) => fromDraft(JSON.stringify(toDraft({ ...defaultConfig(), theme: "unicorn", pinata: { ...defaultPinata({ themeId: "unicorn" }), kind: "shape" as const, ...p } } as never, 2, 0)))?.config.pinata;
    const { shapeTheme: _, ...legacy } = { ...defaultPinata(), shape: "snowflake" as const };
    void _;
    expect(fromDraft(JSON.stringify(toDraft({ ...defaultConfig(), theme: "unicorn", pinata: { ...legacy, kind: "shape" } } as never, 2, 0)))?.config.pinata).toMatchObject({ shape: "unicorn", shapeTheme: "unicorn" });
    expect(kept({ shape: "snowflake", shapeTheme: "frozen" })).toMatchObject({ shape: "unicorn" });
    expect(kept({ shape: "snowflake", shapeTheme: "unicorn" })).toMatchObject({ shape: "snowflake" });
    expect(kept({ shape: "heart", shapeTheme: "frozen" })).toMatchObject({ shape: "heart" });
  });

  const post = (body: unknown) => POST(new NextRequest("http://localhost/api/pinata-render", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));
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
    const drawn = await sharp({ create: { width: 1200, height: 1381, channels: 3, background: "#eeeeee" } }).jpeg().toBuffer();
    const p = defaultPinata({ age: "4" });
    const got = await lines(await post({ pinata: p, theme: "unicorn", preview: `data:image/jpeg;base64,${drawn.toString("base64")}` }));
    expect(got[0]).toEqual({ url: PICTURE });
    expect(got.at(-1)).toMatchObject({ done: true });
    const [model, { input }] = subscribe.mock.calls[0] as [string, { input: { prompt: string; image_urls: string[]; image_size: { width: number; height: number } } }];
    expect(model).toBe("fal-ai/flux-2/edit");
    expect(input.image_urls).toHaveLength(1);
    expect(input.image_size).toEqual({ width: 1200, height: 1376 });
    expect(input.prompt).toBe(pinataPrompt(p));
  }, 30_000);

  it("refuses a missing or skipped piñata, or no preview, without calling fal", async () => {
    const preview = `data:image/jpeg;base64,${JPEG.toString("base64")}`;
    expect((await post({ theme: "unicorn", preview })).status).toBe(400);
    expect((await post({ pinata: { ...defaultPinata(), enabled: false }, theme: "unicorn", preview })).status).toBe(400);
    expect((await post({ pinata: defaultPinata(), theme: "unicorn" })).status).toBe(400);
    expect((await post({ pinata: defaultPinata(), theme: "nope", preview })).status).toBe(400);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("never opens to everyone on the live site when sign-in is not set up", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect((await post({ pinata: defaultPinata(), theme: "unicorn", preview: `data:image/jpeg;base64,${JPEG.toString("base64")}` })).status).toBe(503);
    expect(subscribe).not.toHaveBeenCalled();
  });
});

describe("a new theme brings its own piñata shape", () => {
  it("turns the old theme's snowflake into a unicorn; a shape she picked from the rest stays", () => {
    const p = { ...defaultPinata({ themeId: "frozen" }), kind: "shape" as const };
    expect(p.shape).toBe("snowflake");
    expect(pinataForTheme(p, "frozen", "unicorn").shape).toBe("unicorn");
    expect(pinataForTheme({ ...p, shape: "rocket" }, "frozen", "unicorn").shape).toBe("rocket");
    // A shape the new theme has too stays (princess → barbie: crown).
    expect(pinataForTheme({ ...p, shape: "crown" }, "princess", "barbie").shape).toBe("crown");
    expect(pinataForTheme(p, "frozen", "frozen")).toBe(p);
  });
});
