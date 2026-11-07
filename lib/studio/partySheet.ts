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
 * The first photograph at its full height in a wider white canvas (2026-11-06): the second photograph carries the
 * setting on into the white, and the pieces she picked stand there. Asked in words, or with the photo made smaller
 * inside a frame, the engine kept the first framing and squeezed the pieces in or left them out; given a wider canvas
 * and a wider photograph, it widens the scene. In the middle, white at both sides; or, for one of two photographs
 * joined after (2026-11-07), at the far end with all the white on `side` — twice the room for that side's pieces.
 */
export async function wideCanvas(photo: Buffer, side?: "left" | "right"): Promise<Buffer> {
  const middle = await sharp(photo).resize({ height: WIDE.height }).toBuffer();
  const w = (await sharp(middle).metadata()).width ?? WIDE.width;
  const left = side === "left" ? WIDE.width - w : side === "right" ? 0 : Math.round((WIDE.width - w) / 2);
  return sharp({ create: { width: WIDE.width, height: WIDE.height, channels: 3, background: "#ffffff" } })
    .composite([{ input: middle, left: Math.max(0, left), top: 0 }])
    .jpeg({ quality: 90 }).toBuffer();
}

/** The white a one-sided canvas adds beside the photograph: how far the two photographs' middles are apart. */
export async function sideRoom(photo: Buffer): Promise<number> {
  const m = await sharp(photo).metadata();
  return Math.max(0, WIDE.width - Math.round(((m.width ?? WIDE.width) * WIDE.height) / (m.height ?? WIDE.height)));
}

/**
 * Two photographs of the party made from the same first one — one side's pieces in each (partySides), the white of
 * the canvas on that side — joined into one (2026-11-07): the left of the first, the right of the second. Their
 * middles (the backdrop and the table) are `apart` columns apart by the canvases, and the engine may slide one a
 * little further, so the second is lined up with the first by the shift that matches their middles best; then the
 * seam goes where the two differ least across the middle, feathered. As wide as the two allow once lined up: no
 * piece at either edge is cut off.
 */
export async function stitchSides(left: Buffer, right: Buffer, apart = 0): Promise<Buffer> {
  const { width: W, height: H } = WIDE;
  const raw = (b: Buffer) => sharp(b).resize(W, H, { fit: "fill" }).removeAlpha().raw().toBuffer();
  const [a, b] = await Promise.all([raw(left), raw(right)]);
  const at = (p: Buffer, x: number, y: number, c: number) => p[(y * W + x) * 3 + c];
  // Where the first's middle is: in the middle, or pushed right by the white on its left.
  const centre = Math.round(W / 2 + apart / 2);
  // The shift: b's column x + dx is a's column x, judged on the middle (every other column, every fourth row); the
  // smallest departure from the canvases' own first, so with nothing to choose between them (a plain middle) none.
  let dx = -apart, least = Infinity;
  for (let k = 0; k <= 200; k += 2) for (const d of k ? [-apart - k, -apart + k] : [-apart]) {
    let sum = 0, n = 0;
    for (let y = 0; y < H; y += 4) for (let x = centre - 400; x < centre + 400; x += 2) {
      const xb = x + d;
      if (x < 0 || x >= W || xb < 0 || xb >= W) continue;
      sum += Math.abs(at(a, x, y, 0) - at(b, xb, y, 0)) + Math.abs(at(a, x, y, 1) - at(b, xb, y, 1)) + Math.abs(at(a, x, y, 2) - at(b, xb, y, 2)); n++;
    }
    if (n && sum / n < least) { least = sum / n; dx = d; }
  }
  // The seam: the column, across the middle, where the lined-up two differ least.
  let seam = centre; least = Infinity;
  for (let x = centre - 252; x <= centre + 252; x++) {
    const xb = x + dx;
    if (x < 0 || x >= W || xb < 0 || xb >= W) continue;
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
