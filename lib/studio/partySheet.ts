// Several pictures on one sheet, for the party's photograph (2026-11-05, the owner: "büyükler masası ve deneyimler de
// girsin"): the engine takes seven pictures at most (MAX_PARTY_IMAGES), so the other parts she designed — or her experiences — go in
// side by side on white, in reading order (left to right, the top row first), each fitted into a cell of its own.
// Server only.
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/** Each cell's side; the gutter between them: three across and two down stay under the engine's 1 MP a picture. */
export const CELL = 384, GAP = 16;

/** The columns for n pictures: a row of up to three, then rows of three. */
export const sheetColumns = (n: number) => (n <= 3 ? n : n === 4 ? 2 : 3);

export async function sheetJpeg(pictures: Buffer[]): Promise<Buffer> {
  const cols = sheetColumns(pictures.length), rows = Math.ceil(pictures.length / cols);
  const tiles = await Promise.all(pictures.map((b) => sharp(b).resize({ width: CELL, height: CELL, fit: "contain", background: "#ffffff" }).flatten({ background: "#ffffff" }).png().toBuffer()));
  return sharp({ create: { width: cols * CELL + (cols + 1) * GAP, height: rows * CELL + (rows + 1) * GAP, channels: 3, background: "#ffffff" } })
    .composite(tiles.map((input, i) => ({ input, left: GAP + (i % cols) * (CELL + GAP), top: GAP + Math.floor(i / cols) * (CELL + GAP) })))
    .jpeg({ quality: 86 }).toBuffer();
}

/** An experience's photo (/design/experiences/<pic>.webp): from the site's files, else from the site itself. */
export async function experiencePhoto(pic: string, origin: string): Promise<Buffer> {
  if (!/^[\w-]+$/.test(pic)) throw new Error(`not an experience picture: ${pic}`);
  const photo = `/design/experiences/${pic}.webp`;
  return readFile(path.join(process.cwd(), "public", photo)).catch(async () => {
    const res = await fetch(new URL(photo, origin), { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`experience picture ${photo}: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  });
}

/** The second photograph's size: as tall as the first, half as wide again — room at both sides. */
export const WIDE = { width: 2016, height: 896 };

/**
 * The first photograph at its full height in the middle of a wider white canvas (2026-11-06): the second photograph
 * carries the setting on into the white at both sides, and the pieces she picked stand there. Asked in words, or with
 * the photo made smaller inside a frame, the engine kept the first framing and squeezed the pieces in or left them out;
 * given a wider canvas and a wider photograph, it widens the scene.
 */
export async function wideCanvas(photo: Buffer): Promise<Buffer> {
  const middle = await sharp(photo).resize({ height: WIDE.height }).toBuffer();
  const w = (await sharp(middle).metadata()).width ?? WIDE.width;
  return sharp({ create: { width: WIDE.width, height: WIDE.height, channels: 3, background: "#ffffff" } })
    .composite([{ input: middle, left: Math.max(0, Math.round((WIDE.width - w) / 2)), top: 0 }])
    .jpeg({ quality: 90 }).toBuffer();
}

/**
 * Two photographs of the party made from the same first one — one side's pieces in each (partySides) — joined into
 * one (2026-11-07): the left of the first, the right of the second. The engine keeps the middle (the backdrop and the
 * table) but may slide it a little to one side to make room, so the second is first lined up with the first by the
 * shift that matches their middles best; then the seam goes where the two differ least across the middle, feathered.
 * As wide as the two allow once lined up: no piece at either edge is cut off.
 */
export async function stitchSides(left: Buffer, right: Buffer): Promise<Buffer> {
  const { width: W, height: H } = WIDE;
  const raw = (b: Buffer) => sharp(b).resize(W, H, { fit: "fill" }).removeAlpha().raw().toBuffer();
  const [a, b] = await Promise.all([raw(left), raw(right)]);
  const at = (p: Buffer, x: number, y: number, c: number) => p[(y * W + x) * 3 + c];
  // The shift: b's column x + dx is a's column x, judged on the middle (every other column, every fourth row).
  let dx = 0, least = Infinity;
  // The smallest shift first: with nothing to choose between them (a plain middle), none.
  for (let k = 0; k <= 160; k += 2) for (const d of k ? [-k, k] : [0]) {
    let sum = 0, n = 0;
    for (let y = 0; y < H; y += 4) for (let x = W / 2 - 400; x < W / 2 + 400; x += 2) {
      const xb = x + d;
      if (xb < 0 || xb >= W) continue;
      sum += Math.abs(at(a, x, y, 0) - at(b, xb, y, 0)) + Math.abs(at(a, x, y, 1) - at(b, xb, y, 1)) + Math.abs(at(a, x, y, 2) - at(b, xb, y, 2)); n++;
    }
    if (n && sum / n < least) { least = sum / n; dx = d; }
  }
  // The seam: the column, across the middle, where the lined-up two differ least.
  let seam = W / 2; least = Infinity;
  for (let x = W / 2 - 252; x <= W / 2 + 252; x++) {
    const xb = x + dx;
    if (xb < 0 || xb >= W) continue;
    let d = 0;
    for (let y = 0; y < H; y++) d += Math.abs(at(a, x, y, 0) - at(b, xb, y, 0)) + Math.abs(at(a, x, y, 1) - at(b, xb, y, 1)) + Math.abs(at(a, x, y, 2) - at(b, xb, y, 2));
    if (d < least) { least = d; seam = x; }
  }
  const F = 48, OW = W - dx;
  const out = Buffer.alloc(OW * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < OW; x++) {
    const t = x <= seam - F ? 0 : x >= seam + F ? 1 : (x - (seam - F)) / (2 * F);
    const o = (y * OW + x) * 3, xa = Math.min(W - 1, x), xb = Math.max(0, Math.min(W - 1, x + dx));
    for (let c = 0; c < 3; c++) out[o + c] = Math.round(at(a, xa, y, c) * (1 - t) + at(b, xb, y, c) * t);
  }
  return sharp(out, { raw: { width: OW, height: H, channels: 3 } }).jpeg({ quality: 92 }).toBuffer();
}
