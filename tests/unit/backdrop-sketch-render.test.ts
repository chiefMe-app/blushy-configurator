// The backdrop's first render made from the live sketch (2026-11-03: "live sketch ve render farklı oldu … text
// renderda çok kabarık duruyor flat olsun vinyl olacak çünkü"): one picture to FLUX.2 [dev] edit at the sketch's
// size, the words left out and laid flat on the render afterwards, its colours brought back to the sketch's.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import sharp from "sharp";
import { buildSceneModel } from "@/lib/buildSceneModel";
import { backdropPhotoPrompt } from "@/lib/renderPrompts/backdropPhotoPrompt";
import { colourGains, finishSketchRender } from "@/lib/sketchRenderFinish";
import { resetRenderGuard } from "@/lib/renderGuard";
import { fixtureById } from "../fixtures/configs";
import { withBuilderLettering } from "../fixtures/builder";

const subscribe = vi.fn();
vi.mock("@fal-ai/client", () => ({ fal: { config: vi.fn(), subscribe: (...a: unknown[]) => subscribe(...a) } }));
// The engine's picture: a warm grey square (as the test's render came back, warmer than the sketch).
let made: Buffer;
vi.mock("@/lib/renderStore", () => ({ renderJpeg: async () => made, storeRender: async () => null }));
import { POST } from "@/app/api/generate-controlled-render/route";

const square = (rgb: [number, number, number], size = 1408) =>
  sharp({ create: { width: size, height: size, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } } }).jpeg().toBuffer();
/** A clear square with one red block where the words are. */
const wordsPng = () => sharp({ create: { width: 1408, height: 1408, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: { create: { width: 200, height: 100, channels: 4, background: { r: 220, g: 20, b: 20, alpha: 1 } } }, left: 600, top: 500 }]).png().toBuffer();
const uri = (b: Buffer, type: string) => `data:image/${type};base64,${b.toString("base64")}`;
const scene = () => buildSceneModel(withBuilderLettering(fixtureById("A-single_round").config));
const call = (body: unknown) => POST(new NextRequest("http://localhost/api/generate-controlled-render", {
  method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.77" }, body: JSON.stringify(body),
}));

const ENV = ["FAL_KEY", "BACKDROP_FROM_SKETCH", "BACKDROP_SKETCH_MODEL"];
const saved: Record<string, string | undefined> = {};
beforeEach(async () => {
  for (const k of ENV) { saved[k] = process.env[k]; delete process.env[k]; }
  process.env.FAL_KEY = "not-a-real-key";
  resetRenderGuard();
  subscribe.mockReset();
  subscribe.mockImplementation(async () => ({ data: { images: [{ url: "https://fal.example/x.jpg" }] } }));
  made = await square([200, 180, 150]);
});
afterEach(() => { for (const k of ENV) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

describe("backdrop render from the live sketch", () => {
  it("one picture to FLUX.2 [dev] edit at the sketch's size; her words laid flat on it afterwards", async () => {
    const res = await call({ renderMode: "first_generate", sceneModel: scene(), sketchPreview: uri(await square([180, 180, 180]), "jpeg"), sketchWords: uri(await wordsPng(), "png") });
    expect(res.status).toBe(200);
    expect(subscribe).toHaveBeenCalledTimes(1);
    const [model, { input }] = subscribe.mock.calls[0] as [string, { input: { prompt: string; image_urls: string[]; image_size: { width: number; height: number }; seed: number } }];
    expect(model).toBe("fal-ai/flux-2/edit");
    expect(input.image_urls).toHaveLength(1);
    expect(input.image_size).toEqual({ width: 1408, height: 1408 });
    expect(input.seed).toBe(777);
    // The board is left plain for the words to go on.
    expect(input.prompt).toMatch(/no words, letters or numbers drawn on them/);
    expect(input.prompt).not.toMatch(/FLAT cut vinyl/);
    const json = await res.json();
    expect(json.fromSketch).toBe(true);
    const out = Buffer.from(String(json.imageUrl).split(",")[1], "base64");
    const px = async (x: number, y: number) => { const { data } = await sharp(out).extract({ left: x, top: y, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true }); return Array.from(data); };
    const [r, g, b] = await px(700, 550); // the words
    expect(r).toBeGreaterThan(180); expect(g).toBeLessThan(60); expect(b).toBeLessThan(60);
    // Elsewhere: the warm render brought back towards the sketch's grey.
    const [r2, , b2] = await px(100, 100);
    expect(r2 - b2).toBeLessThan(20);
  });

  it("without a words layer, the prompt keeps her lettering as flat cut vinyl", async () => {
    await call({ renderMode: "first_generate", sceneModel: scene(), sketchPreview: uri(await square([180, 180, 180]), "jpeg") });
    const [, { input }] = subscribe.mock.calls[0] as [string, { input: { prompt: string } }];
    expect(input.prompt).toMatch(/FLAT cut vinyl/);
  });

  it("a sketch over 4 MB is refused before anything is paid for", async () => {
    const res = await call({ renderMode: "first_generate", sceneModel: scene(), sketchPreview: `data:image/jpeg;base64,${"A".repeat(6_000_000)}` });
    expect(res.status).toBe(413);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("a fal refusal of the account says renders are paused", async () => {
    subscribe.mockRejectedValue(Object.assign(new Error("Forbidden"), { status: 403 }));
    const res = await call({ renderMode: "first_generate", sceneModel: scene(), sketchPreview: uri(await square([180, 180, 180]), "jpeg") });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/^Renders are paused/);
  });
});

describe("finishing the sketch render", () => {
  it("matches the sketch's colours, but never by more than 15% a channel", async () => {
    const gains = await colourGains(await square([250, 120, 60], 64), await square([60, 120, 250], 64));
    expect(gains[0]).toBeCloseTo(0.85); expect(gains[1]).toBeCloseTo(1); expect(gains[2]).toBeCloseTo(1.15);
  });

  it("with no words, only the colours change", async () => {
    const out = await finishSketchRender(await square([200, 180, 150], 64), await square([180, 180, 180], 64));
    const { data } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
    expect(Math.abs(data[0] - data[2])).toBeLessThan(12);
  });

  it("the prompt names the print, the rainbows and neutral light", () => {
    const s = scene();
    s.rainbowBalloons = true;
    s.panels[0].graphic = { ...(s.panels[0].graphic ?? {}), enabled: true } as typeof s.panels[0]["graphic"];
    const p = backdropPhotoPrompt(s, { wordsAfter: true });
    expect(p).toMatch(/printed flat on its surface/);
    expect(p).toMatch(/balloon rainbows stay exactly where image 1 has them/);
    expect(p).toMatch(/never yellow or orange/);
  });
});
