// The cup in the table's top view, lying on its side (2026-11-01, the owner:
// "cup bu sidedayken baya tamamen yere yatık olsun"). Each cup piece was
// photographed standing, seen from above at a slant (scripts/table/top-render.mjs);
// lying on its side and seen from straight above, a cup looks as a standing cup
// does from the side. So each photo is re-projected, free and once, as that side
// view: the cup taken as a cone (its rim and base the photo's two ellipses), each
// point on its front looked up in the photo; the mouth a thin ellipse showing
// the inside. Written beside the photo as `<name>-lying.webp`.
// Run: npx tsx scripts/table/cup-lie.ts
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const DIR = "public/design/table/top";
const MANIFEST = "lib/studio/tableTopPieces.json";
/** How much of the mouth shows, as the rim's height over its width: nearly side on. */
const MOUTH = 0.16;
/** The side starts just inside the rim's rolled lip (else the lip's ends hang down past it). */
const LIP = 0.965;

type Img = { data: Buffer; W: number; H: number };
const load = async (name: string): Promise<Img> => {
  const { data, info } = await sharp(path.join(DIR, `${name}.webp`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, W: info.width, H: info.height };
};

/** The cup's rim and base in a photo (px): their middles and half widths, and how flat the ellipses are. */
function shape({ data, W, H }: Img) {
  const span = (y: number) => {
    let l = -1, r = -1;
    for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 128) { if (l < 0) l = x; r = x; }
    return l < 0 ? null : { l, r };
  };
  let top = H, bottom = 0;
  for (let y = 0; y < H; y++) if (span(y)) { top = Math.min(top, y); bottom = y; }
  // The rim: its widest row is its middle.
  let rimY = top, rimR = 0, cx = W / 2;
  for (let y = top; y < top + (bottom - top) * 0.7; y++) { const s = span(y); if (s && (s.r - s.l) / 2 > rimR) { rimR = (s.r - s.l) / 2; rimY = y; cx = (s.l + s.r) / 2; } }
  const e = (rimY - top) / rimR;
  // The base: the row whose half width, as an ellipse that flat, reaches the bottom.
  let baseY = bottom, baseR = rimR * 0.7;
  for (let y = bottom; y > rimY; y--) { const s = span(y); if (s && y + ((s.r - s.l) / 2) * e >= bottom) { baseY = y; baseR = (s.r - s.l) / 2; } else if (s) break; }
  return { cx, rimY, rimR, baseY, baseR, e };
}

function sample({ data, W, H }: Img, x: number, y: number, out: Buffer, o: number) {
  if (x < 0 || y < 0 || x > W - 1 || y > H - 1) return;
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1), fx = x - x0, fy = y - y0;
  for (let c = 0; c < 4; c++) {
    const v = (data[(y0 * W + x0) * 4 + c] * (1 - fx) + data[(y0 * W + x1) * 4 + c] * fx) * (1 - fy) + (data[(y1 * W + x0) * 4 + c] * (1 - fx) + data[(y1 * W + x1) * 4 + c] * fx) * fy;
    out[o + c] = Math.round(v);
  }
}

/** `paper`: a piece whose side is plain white paper, coloured live over it — its side kept to grey light and shade. */
async function lie(names: string[], geometryFrom: string, paper?: string) {
  const g = shape(await load(geometryFrom));
  const tilt = Math.asin(Math.min(0.95, g.e));
  // The cup's own length, from how far its base sits below its rim in the slanted photo.
  const L = (g.baseY - g.rimY) / Math.cos(tilt);
  const pad = 2, W = Math.ceil(g.rimR * 2 + pad * 2), cx = W / 2, y0 = g.rimR * MOUTH + pad;
  const H = Math.ceil(y0 + L + g.baseR * MOUTH + pad);
  for (const name of names) {
    const src = await load(name);
    const out = Buffer.alloc(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4, dx = x - cx;
      // Inside the mouth: the photo's rim ellipse, flattened.
      if ((dx / g.rimR) ** 2 + ((y - y0) / (g.rimR * MOUTH)) ** 2 <= 1) { sample(src, g.cx + dx, g.rimY + ((y - y0) * g.e) / MOUTH, out, o); continue; }
      if (y < y0) continue;
      // On the cup's side: how far along it (v) and round it (sin, cos) this point is.
      const rad = (v: number) => g.rimR * LIP + (g.baseR - g.rimR * LIP) * v;
      let v = (y - y0) / L, s = 0, c = 1, ok = false;
      for (let k = 0; k < 6; k++) {
        const r = rad(v);
        s = dx / r; if (Math.abs(s) > 1) { ok = false; break; }
        c = Math.sqrt(1 - s * s); ok = true;
        v = (y - y0 - r * MOUTH * c) / L;
      }
      if (!ok || v < 0 || v > 1) continue;
      // Looked up on the photo's own cone (the rim at full width there: narrower falls inside the cup), just
      // below its lip and in from its edge, where the photo shows only the cup's printed side.
      const r = g.rimR + (g.baseR - g.rimR) * v;
      const sx = g.cx + r * s * 0.985, sy = g.rimY + (g.baseY - g.rimY) * v + r * g.e * c + g.rimR * 0.035 * (1 - v);
      sample(src, sx, sy, out, o);
      // (The photo's dark teal reflection down its edge showed as a stripe.)
      // Solid, as paper is (the photo's piece is half see-through, and the table showed through the cup).
      if (paper === name) { const l = Math.min(255, 160 + 0.4 * (out[o] * 0.3 + out[o + 1] * 0.59 + out[o + 2] * 0.11)); out[o] = out[o + 1] = out[o + 2] = Math.round(l); out[o + 3] = Math.min(255, out[o + 3] * 2.2); }
    }
    const file = path.join(DIR, `${name}-lying.webp`);
    writeFileSync(file, await sharp(out, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 88, alphaQuality: 100 }).toBuffer());
    console.log(name, { W, H }, { ...g, L: Math.round(L) });
  }
  return { w: W, h: H };
}

(async () => {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as Record<string, { w: number; h: number }>;
  // The plain cup's inside and outside (tinted live) share one shape: the inside's.
  const plain = await lie(["cup-plain-in", "cup-plain-out"], "cup-plain-in", "cup-plain-in");
  manifest["cup-plain-in-lying"] = plain; manifest["cup-plain-out-lying"] = plain;
  for (const name of Object.keys(manifest).filter((n) => /^themed-cups-[\w]+$/.test(n))) manifest[`${name}-lying`] = await lie([name], name);
  writeFileSync(MANIFEST, JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()), null, 1) + "\n");
})();
