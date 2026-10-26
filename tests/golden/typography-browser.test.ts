// Font tiles (CSS + the WOFF2 web fonts) and the lettering engine draw the same
// letters. For every preset font, the engine's preview SVG of a line is
// compared in Edge with the browser setting the same text in the web font.
// Offline: fonts come from public/fonts/typography as data URLs. Thresholds as
// in the T1 qualify check (1px-tolerant ink F1 >= 0.97, width within 2%),
// with a negative control that must fail.
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "@playwright/test";
import { layoutLettering } from "@/lib/typography/layout";
import { previewSvg } from "@/lib/typography/svg";
import { PRESETS } from "@/lib/typography/presets";
import { cssFamily, resolveVariant, webFontFile } from "@/lib/typography/registry";

const PX = 1; // px per mm in the raster
const BOX = { widthMm: 900, heightMm: 260 };
const TEXTS = ["Happy Birthday", "Layla", "Ayşe Gül"];

let browser: Browser, page: Page;
beforeAll(async () => { browser = await chromium.launch({ channel: "msedge" }); page = await browser.newPage({ deviceScaleFactor: 1 }); }, 60_000);
afterAll(async () => { await browser?.close(); });

type Img = { data: Buffer; w: number; h: number };
const toImg = async (png: Buffer): Promise<Img> => { const { data, info } = await sharp(png).flatten({ background: "#fff" }).greyscale().raw().toBuffer({ resolveWithObject: true }); return { data, w: info.width, h: info.height }; };
function inkBox(i: Img) {
  let x0 = i.w, y0 = i.h, x1 = -1, y1 = -1;
  for (let y = 0; y < i.h; y++) for (let x = 0; x < i.w; x++) if (i.data[y * i.w + x] < 128) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
function agree(a: Img, b: Img) {
  const ba = inkBox(a), bb = inkBox(b), S = 2, W = Math.max(ba.w, bb.w) + 2 + 2 * S, H = Math.max(ba.h, bb.h) + 2 + 2 * S;
  const grid = (img: Img, box: ReturnType<typeof inkBox>, dx: number, dy: number) => { const g = new Uint8Array(W * H); for (let y = 0; y < box.h; y++) for (let x = 0; x < box.w; x++) if (img.data[(box.y0 + y) * img.w + box.x0 + x] < 128) g[(y + 1 + S + dy) * W + x + 1 + S + dx] = 1; return g; };
  const near = (g: Uint8Array, i: number) => g[i] || g[i - 1] || g[i + 1] || g[i - W] || g[i + W] || g[i - W - 1] || g[i - W + 1] || g[i + W - 1] || g[i + W + 1];
  const ga = grid(a, ba, 0, 0);
  let best = 0;
  for (let dy = -S; dy <= S; dy++) for (let dx = -S; dx <= S; dx++) {
    const gb = grid(b, bb, dx, dy); let na = 0, ha = 0, nb = 0, hb = 0;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (ga[i]) { na++; if (near(gb, i)) ha++; } if (gb[i]) { nb++; if (near(ga, i)) hb++; } }
    const p = ha / Math.max(1, na), r = hb / Math.max(1, nb); best = Math.max(best, p + r ? (2 * p * r) / (p + r) : 0);
  }
  return { f1: best, widthDiff: Math.abs(ba.w - bb.w) / Math.max(ba.w, bb.w) };
}

async function engine(fontId: string, weight: number, optical: string | undefined, text: string) {
  const l = layoutLettering({ name: { text, fontId, weight, optical, size: "large" }, box: BOX });
  return { img: await toImg(await sharp(Buffer.from(previewSvg(l, PX, "#000"))).png().toBuffer()), fontSizePx: l.elements[0].fontSizeMm * PX };
}
async function css(fontId: string, weight: number, optical: string | undefined, text: string, fontSizePx: number) {
  const v = resolveVariant(fontId, weight, optical)!;
  const b64 = fs.readFileSync(path.resolve(__dirname, "../../public/fonts/typography", webFontFile(v))).toString("base64");
  const feats = (v.font.features ?? []).map((t) => `"${t}" 1`).join(",");
  await page.setContent(`<style>@font-face{font-family:"${cssFamily(v)}";src:url(data:font/woff2;base64,${b64}) format("woff2");font-weight:${weight};}
    body{margin:0;background:#fff}#t{font-family:"${cssFamily(v)}";font-weight:${weight};font-size:${fontSizePx}px;line-height:1.6;padding:40px;display:inline-block;white-space:pre;color:#000;${feats ? `font-feature-settings:${feats};` : ""}}</style><span id="t">${text}</span>`);
  await page.evaluate(() => document.fonts.ready);
  return toImg(await page.locator("#t").screenshot());
}

const variants = [...Array.from(new Map(PRESETS.flatMap((p) => [p.headingFont, p.nameFont]).map((f) => [`${f.fontId}@${f.weight}`, { ...f, optical: undefined as string | undefined }])).values()),
  { fontId: "bodoni-moda", weight: 700, optical: "text" }];

describe("font tiles (CSS + web fonts) match the engine", () => {
  it("negative control: two different fonts do not pass", async () => {
    const a = await engine("italianno", 400, undefined, "Layla");
    const b = await css("sacramento", 400, undefined, "Layla", a.fontSizePx);
    expect(agree(a.img, b).f1).toBeLessThan(0.97);
  }, 60_000);
  for (const v of variants) for (const text of TEXTS) {
    it(`${v.fontId}@${v.weight}${v.optical ? `/${v.optical}` : ""} · ${text}`, async () => {
      const a = await engine(v.fontId, v.weight, v.optical, text);
      const r = agree(a.img, await css(v.fontId, v.weight, v.optical, text, a.fontSizePx));
      expect(r.widthDiff).toBeLessThanOrEqual(0.02);
      expect(r.f1).toBeGreaterThanOrEqual(0.97);
    }, 60_000);
  }
});
