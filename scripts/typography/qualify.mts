// Font qualification (Typography System, T1). For every font and weight in
// lib/typography/registry.ts:
//   1. licence   — OFL.txt present, METADATA licence OFL, files match the lock
//   2. coverage  — English + Turkish letters, digits, punctuation, ordinals
//   3. shaping   — HarfBuzz outlines vs the browser's own text rendering (Edge):
//                  width difference and ink overlap (IoU) on sample names
//   4. strokes   — thinnest / median stroke as a share of cap height (distance
//                  transform), and a monoline score (thin / median)
//   5. pieces    — how many separate pieces a word falls into (script joins)
// Writes lib/typography/fonts.generated.json and test-results/typography/.
//
//   npx tsx scripts/typography/qualify.mts            (needs the installed Edge)
//   npx tsx scripts/typography/qualify.mts --no-browser   (skips check 3)
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import * as hb from "harfbuzzjs";
import sharp from "sharp";
import type { RegistryFont, FontWeight, FontVariant } from "../../lib/typography/registry.ts";
import * as registryModule from "../../lib/typography/registry.ts";
// registry.ts is loaded as CommonJS by tsx (the package is not "type": "module").
const { FONTS, fontVariants } = ((registryModule as unknown as { default?: typeof registryModule }).default ?? registryModule);

const ROOT = path.resolve(import.meta.dirname, "../..");
const ASSETS = path.join(ROOT, "assets/fonts");
const OUT_JSON = path.join(ROOT, "lib/typography/fonts.generated.json");
const REPORT = path.join(ROOT, "test-results/typography");
const NO_BROWSER = process.argv.includes("--no-browser");
// --only=id,id measures just those fonts and does not write the outputs (for trying axis values).
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) ?? "").slice(7).split(",").filter(Boolean);
// --axes=id:tag=value,... overrides registry axes for a trial run.
const AXES = Object.fromEntries((process.argv.find((a) => a.startsWith("--axes=")) ?? "").slice(7).split(";").filter(Boolean).map((s) => { const [id, rest] = s.split(":"); return [id, Object.fromEntries(rest.split(",").map((kv) => { const [k, v] = kv.split("="); return [k, Number(v)]; }))]; }));

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÇĞİÖŞÜçğıöşü0123456789&'’-.,!?";
const SHAPING_SAMPLES = ["Layla", "Malek", "Ayşe Gül", "Happy 1st Birthday", "Mehmet Ali"];
const STROKE_SAMPLE = "Happy Birthday Layla Ayşe Gül 1st";
const PIECE_WORDS = ["Layla", "Arya", "Malek", "Ayşe"];
const EM = 400; // px per em for rasterising
const SHAPING_MIN_F1 = 0.97;

// ---- HarfBuzz ---------------------------------------------------------------
interface Loaded { font: hb.Font; upem: number; axes: Record<string, number>; features: hb.Feature[]; css: string[] }
const faces = new Map<string, Buffer>();
function load(f: RegistryFont, w: FontWeight, variantAxes?: FontVariant["axes"]): Loaded {
  const file = path.join(ASSETS, f.dir, w.file);
  const data = faces.get(file) ?? fs.readFileSync(file);
  faces.set(file, data);
  const face = new hb.Face(new hb.Blob(data));
  const font = new hb.Font(face);
  const info = face.getAxisInfos();
  const axes: Record<string, number> = {};
  for (const [tag, v] of Object.entries({ ...(variantAxes ?? w.axes ?? {}), ...(AXES[f.id] ?? {}) })) {
    const a = info[tag];
    if (!a) throw new Error(`${f.id}: no ${tag} axis`);
    axes[tag] = v === "max" ? a.max : Math.min(a.max, Math.max(a.min, v));
  }
  if (Object.keys(axes).length) font.setVariations(Object.entries(axes).map(([t, v]) => new hb.Variation(t, v)));
  const feats = f.features ?? [];
  return { font, upem: face.upem, axes, features: feats.map((t) => new hb.Feature(t, 1)), css: feats };
}

/** SVG path of a shaped line, baseline at y, px size; returns path + advance. */
function linePath(l: Loaded, text: string, x: number, y: number, px: number) {
  const buf = new hb.Buffer();
  buf.addText(text);
  buf.guessSegmentProperties();
  hb.shape(l.font, buf, l.features);
  const s = px / l.upem;
  let pen = 0;
  const parts: string[] = [];
  const infos = buf.getGlyphInfos(), pos = buf.getGlyphPositions();
  infos.forEach((g, i) => {
    const d = l.font.glyphToPath(g.codepoint);
    if (d) parts.push(`<path transform="translate(${(x + (pen + pos[i].xOffset) * s).toFixed(2)} ${(y - pos[i].yOffset * s).toFixed(2)}) scale(${s} ${-s})" d="${d}"/>`);
    pen += pos[i].xAdvance;
  });
  return { svg: parts.join(""), advance: pen * s };
}

function capHeightEm(l: Loaded): number {
  const gid = l.font.nominalGlyph("H".codePointAt(0)!);
  const ext = gid ? l.font.glyphExtents(gid) : undefined;
  return ext ? ext.yBearing / l.upem : 0.7;
}

async function rasterLine(l: Loaded, text: string, px: number) {
  const { svg, advance } = linePath(l, text, px * 0.5, px * 1.4, px);
  const W = Math.ceil(advance + px), H = Math.ceil(px * 2.2);
  const { data, info } = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${svg}</g></svg>`))
    .greyscale().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, advance };
}

// ---- measurements -------------------------------------------------------------
function strokeStats(img: { data: Buffer; w: number; h: number }) {
  const { data, w, h } = img, INF = 1e9, d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = data[i] < 128 ? INF : 0;
  const A = 1, B = Math.SQRT2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (!d[i]) continue; let v = d[i];
    if (x > 0) v = Math.min(v, d[i - 1] + A);
    if (y > 0) { v = Math.min(v, d[i - w] + A); if (x > 0) v = Math.min(v, d[i - w - 1] + B); if (x < w - 1) v = Math.min(v, d[i - w + 1] + B); }
    d[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x; if (!d[i]) continue; let v = d[i];
    if (x < w - 1) v = Math.min(v, d[i + 1] + A);
    if (y < h - 1) { v = Math.min(v, d[i + w] + A); if (x < w - 1) v = Math.min(v, d[i + w + 1] + B); if (x > 0) v = Math.min(v, d[i + w - 1] + B); }
    d[i] = v;
  }
  const widths: number[] = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, v = d[i]; if (v < 1) continue;
    let ridge = true;
    for (const j of [i - 1, i + 1, i - w, i + w, i - w - 1, i - w + 1, i + w - 1, i + w + 1]) if (d[j] > v) { ridge = false; break; }
    if (ridge) widths.push(2 * v);
  }
  widths.sort((a, b) => a - b);
  const q = (f: number) => widths[Math.floor(f * (widths.length - 1))] ?? 0;
  return { p05: q(0.05), p10: q(0.10), median: q(0.5) };
}

function pieces(img: { data: Buffer; w: number; h: number }) {
  const { data, w, h } = img, seen = new Uint8Array(w * h), sizes: number[] = [];
  for (let s = 0; s < w * h; s++) {
    if (seen[s] || data[s] >= 128) continue;
    let n = 0; const stack = [s]; seen[s] = 1;
    while (stack.length) {
      const i = stack.pop()!; n++;
      const x = i % w, y = (i / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx; if (!seen[j] && data[j] < 128) { seen[j] = 1; stack.push(j); }
      }
    }
    sizes.push(n);
  }
  const total = sizes.reduce((a, b) => a + b, 0);
  // Dots and accents (i, ü, ş cedilla, apostrophes) are small separate marks, not breaks in the word.
  const main = sizes.filter((n) => n > total * 0.04).length;
  return { pieces: main, marks: sizes.length - main };
}

function inkBox(data: Buffer | Uint8Array, w: number, h: number, ch = 1) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * ch] < 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// ---- browser comparison ---------------------------------------------------------
type Page = import("@playwright/test").Page;
async function browserInk(page: Page, f: RegistryFont, w: FontWeight, axes: Record<string, number>, text: string, px: number, features: string[] = []) {
  const b64 = fs.readFileSync(path.join(ASSETS, f.dir, w.file)).toString("base64");
  const settings = Object.entries(axes).map(([t, v]) => `"${t}" ${v}`).join(", ");
  await page.setContent(`<style>@font-face{font-family:Q;src:url(data:font/ttf;base64,${b64});}
    body{margin:0;background:#fff}#t{font-family:Q;font-size:${px}px;line-height:1;white-space:pre;padding:${px * 0.5}px;display:inline-block;
    font-kerning:normal;font-variant-ligatures:common-ligatures contextual;${features.length ? `font-feature-settings:${features.map((t) => `\"${t}\" 1`).join(", ")};` : ""}${settings ? `font-variation-settings:${settings};` : ""}${axes.wght ? `font-weight:${axes.wght};` : ""}}</style><span id="t">${text.replace(/&/g, "&amp;")}</span>`);
  await page.evaluate(() => document.fonts.ready);
  const png = await page.locator("#t").screenshot();
  const { data, info } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

const DEBUG = process.env.QUALIFY_DEBUG ?? "";
async function saveOverlay(name: string, a: { data: Buffer; w: number; h: number }, b: { data: Buffer; w: number; h: number }) {
  const ba = inkBox(a.data, a.w, a.h)!, bb = inkBox(b.data, b.w, b.h)!;
  const W = Math.max(ba.w, bb.w) + 4, H = Math.max(ba.h, bb.h) + 4, px = Buffer.alloc(W * H * 3, 255);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const pa = x < ba.w && y < ba.h && a.data[(ba.y0 + y) * a.w + ba.x0 + x] < 128;
    const pb = x < bb.w && y < bb.h && b.data[(bb.y0 + y) * b.w + bb.x0 + x] < 128;
    const o = (y * W + x) * 3;
    if (pa && pb) { px[o] = 0; px[o + 1] = 0; px[o + 2] = 0; } else if (pa) { px[o] = 220; px[o + 1] = 30; px[o + 2] = 60; } else if (pb) { px[o] = 30; px[o + 1] = 110; px[o + 2] = 230; }
  }
  await sharp(px, { raw: { width: W, height: H, channels: 3 } }).resize({ width: W * 3, kernel: "nearest" }).png().toFile(path.join(REPORT, name));
}

// Ink agreement with a 1px tolerance: anti-aliasing moves thin strokes by a
// pixel between rasterisers, which ruins an exact-pixel overlap while the
// shapes are the same (checked on overlays). F1 of "my ink is within 1px of
// yours" both ways, after aligning the ink boxes (best of ±2px, since a thin
// flourish tip at the box edge can move the box itself); plus width difference.
function compare(a: { data: Buffer; w: number; h: number }, b: { data: Buffer; w: number; h: number }) {
  const ba = inkBox(a.data, a.w, a.h), bb = inkBox(b.data, b.w, b.h);
  if (!ba || !bb) return { widthDiff: 1, f1: 0 };
  const S = 2, W = Math.max(ba.w, bb.w) + 2 + 2 * S, H = Math.max(ba.h, bb.h) + 2 + 2 * S;
  const grid = (img: typeof a, box: NonNullable<typeof ba>, dx: number, dy: number) => {
    const g = new Uint8Array(W * H);
    for (let y = 0; y < box.h; y++) for (let x = 0; x < box.w; x++) if (img.data[(box.y0 + y) * img.w + box.x0 + x] < 128) g[(y + 1 + S + dy) * W + x + 1 + S + dx] = 1;
    return g;
  };
  const ga = grid(a, ba, 0, 0);
  let best = 0;
  for (let dy = -S; dy <= S; dy++) for (let dx = -S; dx <= S; dx++) best = Math.max(best, f1Of(ga, grid(b, bb, dx, dy), W, H));
  return { widthDiff: Math.abs(ba.w - bb.w) / Math.max(ba.w, bb.w), f1: best };
}

function f1Of(ga: Uint8Array, gb: Uint8Array, W: number, H: number) {
  const near = (g: Uint8Array, i: number) => g[i] || g[i - 1] || g[i + 1] || g[i - W] || g[i + W] || g[i - W - 1] || g[i - W + 1] || g[i + W - 1] || g[i + W + 1];
  let na = 0, ha = 0, nb = 0, hbN = 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    if (ga[i]) { na++; if (near(gb, i)) ha++; }
    if (gb[i]) { nb++; if (near(ga, i)) hbN++; }
  }
  const pr = na ? ha / na : 0, rc = nb ? hbN / nb : 0;
  return pr + rc ? (2 * pr * rc) / (pr + rc) : 0;
}

// ---- run ----------------------------------------------------------------------------
(async () => {
  fs.mkdirSync(REPORT, { recursive: true });
  const lock = JSON.parse(fs.readFileSync(path.join(ASSETS, "fonts.lock.json"), "utf8"));
  const sha = (p: string) => createHash("sha256").update(fs.readFileSync(p)).digest("hex");
  let browser: import("@playwright/test").Browser | null = null, page: Page | null = null;
  if (!NO_BROWSER) {
    const { chromium } = await import("@playwright/test");
    browser = await chromium.launch({ channel: "msedge" });
    page = await browser.newPage({ deviceScaleFactor: 1 });
    // Negative control: Italianno outlines against the browser drawing a
    // different face must fail, or the shaping check proves nothing.
    const ita = FONTS.find((x) => x.id === "italianno")!, sac = FONTS.find((x) => x.id === "sacramento")!;
    const ctl = compare(await rasterLine(load(ita, ita.weights[0]), "Layla", 120), await browserInk(page, sac, sac.weights[0], {}, "Layla", 120));
    console.log("negative control (Italianno vs Sacramento):", JSON.stringify(ctl), ctl.f1 < SHAPING_MIN_F1 ? "-> correctly FAILS" : "-> PASSES: check is too loose");
    if (ctl.f1 >= SHAPING_MIN_F1) throw new Error("shaping check cannot tell two fonts apart");
  }
  const out: Record<string, unknown> = {};
  const sheetRows: { label: string; svg: string; w: number; h: number }[] = [];
  for (const f of FONTS.filter((x) => !ONLY.length || ONLY.includes(x.id))) {
    const meta = fs.readFileSync(path.join(ASSETS, f.dir, "METADATA.pb"), "utf8");
    const licence = {
      ofl: (meta.match(/license: "(\w+)"/) ?? [])[1] === "OFL" && fs.existsSync(path.join(ASSETS, f.dir, "OFL.txt")),
      lockMatch: [...f.weights.map((w2) => `${f.dir}/${w2.file}`), `${f.dir}/OFL.txt`].every((k) => lock.files[k] && lock.files[k] === sha(path.join(ASSETS, k))),
    };
    const weights: Record<string, unknown> = {};
    for (const v of fontVariants(f)) {
      const w = v.weight;
      const l = load(f, w, v.axes);
      const missing = Array.from(CHARSET).filter((ch) => !l.font.nominalGlyph(ch.codePointAt(0)!));
      const cap = capHeightEm(l);
      const strokeImg = await rasterLine(l, STROKE_SAMPLE, EM);
      const st = strokeStats(strokeImg);
      const pc: Record<string, number> = {};
      for (const word of PIECE_WORDS) pc[word] = pieces(await rasterLine(l, word, EM)).pieces;
      let shaping: { widthDiffMax: number; f1Min: number; pass: boolean } | null = null;
      if (page) {
        let widthDiffMax = 0, f1Min = 1;
        for (const s of SHAPING_SAMPLES) {
          const px = 120;
          const ra = await rasterLine(l, s, px), rb = await browserInk(page, f, w, l.axes, s, px, l.css);
          const c = compare(ra, rb);
          if (DEBUG && f.id === DEBUG) { await saveOverlay(`debug-${f.id}-${w.weight}-${s.replace(/[^A-Za-z0-9]+/g, "_")}.png`, ra, rb); console.log("   ", s, JSON.stringify(c)); }
          widthDiffMax = Math.max(widthDiffMax, c.widthDiff); f1Min = Math.min(f1Min, c.f1);
        }
        shaping = { widthDiffMax: +widthDiffMax.toFixed(4), f1Min: +f1Min.toFixed(3), pass: widthDiffMax <= 0.02 && f1Min >= SHAPING_MIN_F1 };
      }
      weights[v.key] = {
        axes: l.axes,
        coverage: { ok: missing.length === 0, missing: missing.join("") },
        capHeightEm: +cap.toFixed(4),
        stroke: { thinOfCap: +(st.p05 / EM / cap).toFixed(4), thin10OfCap: +(st.p10 / EM / cap).toFixed(4), medianOfCap: +(st.median / EM / cap).toFixed(4), monoline: +(st.p10 / Math.max(1e-6, st.median)).toFixed(3) },
        pieces: pc,
        shaping,
      };
      const row = linePath(l, `${f.family} ${v.key} — Happy 1st Birthday · Layla · Ayşe Gül · Malek`, 16, 62, 44);
      sheetRows.push({ label: `${f.id}@${v.key}`, svg: row.svg, w: Math.ceil(row.advance + 40), h: 86 });
      console.log(f.id.padEnd(20), v.key.padEnd(8), missing.length ? `MISSING ${missing.join("")}` : "coverage ok",
        `thin/cap ${(st.p05 / EM / cap).toFixed(3)}`, `mono ${(st.p10 / st.median).toFixed(2)}`, `pieces ${JSON.stringify(pc)}`,
        shaping ? `shaping ${shaping.pass ? "ok" : "FAIL"} (w ${shaping.widthDiffMax}, f1 ${shaping.f1Min})` : "");
    }
    out[f.id] = { licence, weights };
  }
  if (browser) await browser.close();
  if (ONLY.length) { console.log("(--only: outputs not written)"); return; }
  fs.writeFileSync(OUT_JSON, JSON.stringify({ generatedBy: "scripts/typography/qualify.mts", fonts: out }, null, 2) + "\n");
  const W = Math.max(...sheetRows.map((r) => r.w)), H = sheetRows.reduce((s, r) => s + r.h, 0);
  let y = 0;
  const body = sheetRows.map((r) => { const g = `<g transform="translate(0 ${y})"><rect width="${W}" height="${r.h}" fill="${(y / 86) % 2 ? "#fafafa" : "#fff"}"/><text x="16" y="20" font-family="Arial" font-size="13" fill="#888">${r.label}</text><g fill="#15182E">${r.svg}</g></g>`; y += r.h; return g; }).join("");
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${body}</svg>`)).png().toFile(path.join(REPORT, "t1-contact-sheet.png"));
  console.log(`\n-> ${path.relative(ROOT, OUT_JSON)}, test-results/typography/t1-contact-sheet.png`);
})();
