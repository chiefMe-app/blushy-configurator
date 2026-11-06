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
