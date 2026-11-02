// The welcome board's garland in the backdrop's own balloons (2026-11-02, the owner: "balon renkleri doğru değil
// silver yoktu ve boyanmış gibi duruyor", "backdropta ne seçildiyse balon welcomeboardda da aynı olmalı"): the
// Single Arch's garland — a column up the board's right side arching over its top, whole on both sides — cut from
// each balloon set's photo (/design/sketch/<theme>-<set>/single_arch-*). Its families map comes with it, so the
// builder repaints it exactly as it repaints the backdrop (LiveSketch's useRecoloredBase). Free and local.
// (The Wavy's column was tried first: the backdrop's board had cut its balloons, and the cut showed under the board.)
//
// Later that day ("burda çok boşluk olmuş, daha önce daha düzgündü"): the arch's column stands well clear of a
// welcome board's edge, so the column is drawn in to hug it, by how far its inner edge stands off the board. The
// crown over the top stays where it is and the move eases in below it, each balloon moved whole there (SAM 2
// segments, scripts/welcome/segs/single_arch-<set>.png, from a paid auto-segment of the shot): nothing is
// stretched or sheared.
// npx tsx scripts/welcome/garland-sets.ts
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const SETS = ["unicorn-pastel", "unicorn-bright", "frozen-pastel", "frozen-bright"];
/** The garland in the 1024 px shot (px); its right edge is found after the column is drawn in. */
const BOX = { x0: 278, y0: 32, y1: 923 };
/** Where the welcome board's right edge goes: just inside the column (at the arch board's own edge, 575, the column hid a quarter of the board). */
const BOARD_X = 530;
/** How far the column's balloons come over the board's edge. */
const OVERLAP = 16;
/** The crown (kept) above CROWN_Y; the column drawn in fully below COLUMN_Y, eased in between. */
const CROWN_Y = 240, COLUMN_Y = 460;
/** Where the column's inner edge is looked for (left of it, below the crown, is only the crown's own end). */
const COLUMN_X0 = 470;
const OUT = "public/design/welcome/pieces";
const MANIFEST = "lib/studio/welcomePieces.json";

const smoothstep = (t: number) => { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c); };

async function drawIn(set: string) {
  const dir = `public/design/sketch/${set}`;
  const { data: img, info } = await sharp(path.join(dir, "single_arch-balloons.webp")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const fam = await sharp(path.join(dir, "single_arch-families.png")).resize(W, H, { kernel: "nearest" }).ensureAlpha().raw().toBuffer();
  const lab = await sharp(`scripts/welcome/segs/single_arch-${set}.png`).resize(W, H, { kernel: "nearest" }).removeAlpha().raw().toBuffer();
  const opaque = (k: number) => img[k * 4 + 3] > 128;

  // How far the column stands off the board: its inner edge's median height by height below the crown. The
  // whole column moves by that one distance (moving each height by its own made balloons pile up and part).
  const edges: number[] = [];
  for (let y = COLUMN_Y; y < BOX.y1; y++) for (let x = COLUMN_X0; x < W; x++) if (opaque(y * W + x)) { edges.push(x); break; }
  edges.sort((p, q) => p - q);
  const off = Math.max(0, edges[Math.floor(edges.length / 2)] - (BOARD_X - OVERLAP));
  const shift = new Float64Array(H).map((_, y) => off * smoothstep((y - CROWN_Y) / (COLUMN_Y - CROWN_Y)));

  // The balloons: SAM segments of balloon size, mostly on the garland layer.
  const id = (k: number) => lab[k * 3] + lab[k * 3 + 1] * 256;
  const seg = new Map<number, { n: number; on: number; ys: number }>();
  for (let k = 0; k < W * H; k++) {
    const i = id(k); if (!i) continue;
    const s = seg.get(i) ?? { n: 0, on: 0, ys: 0 };
    s.n++; s.ys += Math.floor(k / W); if (opaque(k)) s.on++;
    seg.set(i, s);
  }
  const balloon = new Map(Array.from(seg).filter(([, s]) => s.n < 60000 && s.on / s.n > 0.6));

  const out = Buffer.alloc(W * H * 4), outFam = Buffer.alloc(W * H * 4);
  const put = (k: number, dx: number) => {
    const y = Math.floor(k / W), x = (k % W) - Math.round(dx);
    if (x < 0) return;
    const j = (y * W + x) * 4;
    img.copy(out, j, k * 4, k * 4 + 4);
    fam.copy(outFam, j, k * 4, k * 4 + 4);
  };
  // What isn't a balloon of its own (stems, slivers between) moves with its row; then the balloons, biggest
  // first, so the small ones tucked in between stay in front.
  for (let k = 0; k < W * H; k++) if (img[k * 4 + 3] && !balloon.has(id(k))) put(k, shift[Math.floor(k / W)]);
  const order = Array.from(balloon).sort((a, b) => b[1].n - a[1].n);
  const pixels = new Map<number, number[]>(order.map(([i]) => [i, []]));
  for (let k = 0; k < W * H; k++) { const p = pixels.get(id(k)); if (p && img[k * 4 + 3]) p.push(k); }
  for (const [i, s] of order) { const dx = shift[Math.round(s.ys / s.n)]; for (const k of pixels.get(i)!) put(k, dx); }

  // Where neighbours moved apart, a sliver of what lay behind them is missing: each such hole takes the photo's
  // own pixel from where its row came from (the garland's outline is the row-moved one; nothing is added outside).
  let filled = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = y * W + x, sx = x + Math.round(shift[y]);
    if (out[k * 4 + 3] > 128 || sx >= W || !opaque(y * W + sx)) continue;
    img.copy(out, k * 4, (y * W + sx) * 4, (y * W + sx) * 4 + 4); fam.copy(outFam, k * 4, (y * W + sx) * 4, (y * W + sx) * 4 + 4);
    filled++;
  }

  let x1 = 0;
  for (let k = 0; k < W * H; k++) if (out[k * 4 + 3] > 8 && Math.floor(k / W) >= BOX.y0 && Math.floor(k / W) < BOX.y1) x1 = Math.max(x1, k % W);
  const shot = { width: W, height: H, channels: 4 as const };
  return { img: sharp(out, { raw: shot }), fam: sharp(outFam, { raw: shot }), x1: Math.min(W, x1 + 4), moved: Math.round(off), filled };
}

(async () => {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  for (const set of SETS) {
    const { img, fam, x1, moved, filled } = await drawIn(set);
    const w = x1 - BOX.x0, h = BOX.y1 - BOX.y0;
    const box = { left: BOX.x0, top: BOX.y0, width: w, height: h };
    await img.extract(box).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(OUT, `garland-${set}.webp`));
    // The families map, cut the same (its values are family numbers).
    await fam.extract(box).removeAlpha().png().toFile(path.join(OUT, `garland-${set}-families.png`));
    manifest[`garland-${set}`] = { w, h, edge: +((BOARD_X - BOX.x0) / w).toFixed(4) };
    console.log(set, manifest[`garland-${set}`], "column drawn in by", moved, "px;", filled, "px of holes filled");
  }
  writeFileSync(MANIFEST, JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()), null, 1) + "\n");
})();
