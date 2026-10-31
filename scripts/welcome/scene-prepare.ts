// The welcome board's real photos (scripts/welcome/scene-render.mjs), made ready
// for the builder: each scene written to public/design/welcome/pieces/ with
// where its blank board is (found in the photo: the pure white inside the place
// the drawing put it), and each theme's garland cut out of its green — in
// lib/studio/welcomePieces.json, beside the other pieces.
// Run: npx tsx scripts/welcome/scene-prepare.ts <dir of the renders>
import sharp from "sharp";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { cutOut } from "../table/cutout";
import { sceneFace, sceneFrame, TOP } from "./scene-geometry.mjs";

const RAW = process.argv[2];
const OUT = "public/design/welcome/pieces";
const SIDE = 1400; // px: the scene's photo

type Piece = { w: number; h: number; face?: [number, number, number, number]; floor?: number };
const MANIFEST = "lib/studio/welcomePieces.json";
const manifest: Record<string, Piece> = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};

/**
 * Where the board is in a scene (fractions of the photo): its left, right and
 * top edges where the brightness changes most, near where the drawing put them
 * (the wall is nearly as white as the board, so its colour alone does not
 * tell them apart); its height from its width, as the board's own shape.
 */
async function scene(name: string, file: string) {
  const [, shape, stand] = name.split("-");
  const f = sceneFrame(shape, stand), face = sceneFace(shape);
  const { data, info } = await sharp(file).removeAlpha().resize(SIDE, SIDE, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const px = (cm: number) => ((cm - f.x) / f.size) * W, py = (cm: number) => ((cm - f.y) / f.size) * H;
  const L = (x: number, y: number) => { const i = (y * W + x) * 3; return data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11; };
  const pad = Math.round(0.08 * face.w * (W / f.size));
  /** The strongest change in brightness across `at` ± pad, averaged along the edge. */
  const edge = (at: number, along: [number, number], vertical: boolean) => {
    let best = at, score = -1;
    for (let c = Math.round(at) - pad; c <= Math.round(at) + pad; c++) {
      let sum = 0, n = 0;
      for (let k = Math.round(along[0]); k <= along[1]; k += 2) {
        sum += vertical ? Math.abs(L(c + 2, k) - L(c - 2, k)) : Math.abs(L(k, c + 2) - L(k, c - 2));
        n++;
      }
      if (sum / n > score) { score = sum / n; best = c; }
    }
    return best;
  };
  // Left and right edges along the board's middle; its top across its middle (an arch's or circle's top point).
  const mid: [number, number] = [py(TOP + face.h * 0.35), py(TOP + face.h * 0.65)];
  const x0 = edge(px(0), mid, true), x1 = edge(px(face.w), mid, true);
  const y0 = edge(py(TOP), [px(face.w * 0.4), px(face.w * 0.6)], false);
  const y1 = y0 + ((x1 - x0) * face.h) / face.w;
  writeFileSync(path.join(OUT, `${name}.webp`), await sharp(data, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: 84 }).toBuffer());
  // And where the floor is that the easel (or a garland) stands on.
  manifest[name] = { w: W, h: H, face: [x0 / W, y0 / H, x1 / W, y1 / H].map((v) => +v.toFixed(4)) as [number, number, number, number], floor: +((f.floor - f.y) / f.size).toFixed(4) };
  console.log(name, manifest[name].face, "drawing:", [px(0) / W, py(TOP) / H, px(face.w) / W, py(TOP + face.h) / H].map((v) => +v.toFixed(4)));
}

(async () => {
  for (const f of readdirSync(RAW).filter((f) => /^(scene|garland)-[\w-]+\.png$/.test(f) && !f.includes("-v1")).sort()) {
    const name = f.replace(/\.png$/, "");
    if (name.startsWith("scene-")) { await scene(name, path.join(RAW, f)); continue; }
    const r = await cutOut(path.join(RAW, f));
    const buf = await sharp(r.data, { raw: { width: r.width, height: r.height, channels: 4 } }).resize({ width: 900, height: 900, fit: "inside" }).webp({ quality: 88, alphaQuality: 100 }).toBuffer();
    writeFileSync(path.join(OUT, `${name}.webp`), buf);
    const m = await sharp(buf).metadata();
    manifest[name] = { w: m.width!, h: m.height! };
    console.log(name, manifest[name]);
  }
  writeFileSync(MANIFEST, JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()), null, 1) + "\n");
})();
