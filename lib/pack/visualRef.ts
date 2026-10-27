// The Design Pack's visual reference (Phase 1.3): the render (or an example
// photo) with a permanent strip across it — VISUAL REFERENCE, NOT PRINT
// ARTWORK — so it can never pass for production artwork. The text is drawn as
// paths: Vercel's servers have no fonts, so SVG <text> would come out as boxes.
import fs from "fs";
import path from "path";
import sharp from "sharp";
import opentype from "opentype.js";

let labelFont: opentype.Font | null = null;
function font() {
  labelFont ??= opentype.parse(fs.readFileSync(path.join(process.cwd(), "assets", "fonts", "archivoblack", "ArchivoBlack-Regular.ttf")).buffer as ArrayBuffer);
  return labelFont;
}

/** Text as an SVG path, its left edge at x and baseline at y. */
export function textPath(text: string, x: number, y: number, size: number, fill: string): { d: string; width: number; svg: string } {
  const f = font();
  const p = f.getPath(text, x, y, size);
  const d = p.toPathData(2);
  return { d, width: f.getAdvanceWidth(text, size), svg: `<path d="${d}" fill="${fill}"/>` };
}

const MAX_WIDTH = 1600;

/** The labelled visual reference as JPEG. `sample` adds a SAMPLE mark across it. */
export async function labelledReference(image: Buffer, opts: { sample?: boolean } = {}): Promise<Buffer> {
  const resized = await sharp(image).resize({ width: MAX_WIDTH, withoutEnlargement: true }).toBuffer({ resolveWithObject: true });
  const { width, height } = resized.info;
  const strip = Math.round(Math.max(44, width * 0.045));
  const size = strip * 0.42;
  const line1 = textPath("VISUAL REFERENCE — NOT PRINT ARTWORK", 0, 0, size, "#FFFFFF");
  const line2 = textPath("AI-generated, indicative only. Sizes and materials are in the specification.", 0, 0, size * 0.55, "#FFE3EE");
  const left = (w: number) => Math.max(12, (width - w) / 2);
  const parts = [
    `<rect x="0" y="${height - strip}" width="${width}" height="${strip}" fill="rgba(20,10,16,0.82)"/>`,
    `<g transform="translate(${left(line1.width)},${height - strip + size * 1.12})">${line1.svg}</g>`,
    `<g transform="translate(${left(line2.width)},${height - strip * 0.12})">${line2.svg}</g>`,
    `<rect x="0" y="0" width="${width}" height="${height}" fill="none" stroke="rgba(20,10,16,0.82)" stroke-width="${Math.round(strip * 0.18)}"/>`,
  ];
  if (opts.sample) {
    const mark = textPath("SAMPLE", 0, 0, width * 0.16, "rgba(255,255,255,0.38)");
    parts.push(`<g transform="translate(${width / 2},${height / 2}) rotate(-24) translate(${-mark.width / 2},${width * 0.05})">${mark.svg}</g>`);
  }
  const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${parts.join("")}</svg>`);
  return sharp(resized.data).composite([{ input: overlay, top: 0, left: 0 }]).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
}
