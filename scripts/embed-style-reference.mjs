// Embed a local image as the Lone Arch balloon style reference.
//
//   node scripts/embed-style-reference.mjs <path-to-image> [maxWidth]
//
// Downscales to maxWidth (default 720px — the reference only has to convey the
// arrangement, and a smaller image keeps the serverless bundle small), encodes
// it as a JPEG data URI and rewrites lib/renderPrompts/loneArchStyleReference.ts.
//
// If you have a public https URL for the image instead (a fal.media asset URL,
// for example) you do not need this script at all — just set
// LONE_ARCH_STYLE_REFERENCE to that URL by hand.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const target = path.join(repoRoot, "lib", "renderPrompts", "loneArchStyleReference.ts");

const src = process.argv[2];
const maxWidth = Number(process.argv[3] ?? 720);
if (!src) {
  console.error("usage: node scripts/embed-style-reference.mjs <path-to-image> [maxWidth]");
  process.exit(1);
}
if (!fs.existsSync(src)) {
  console.error(`no such file: ${src}`);
  process.exit(1);
}

const sharpPkg = await import("sharp");
const sharp = sharpPkg.default ?? sharpPkg;

const buf = await sharp(src)
  .resize({ width: maxWidth, withoutEnlargement: true })
  .jpeg({ quality: 82 })
  .toBuffer();
const meta = await sharp(buf).metadata();
const dataUri = `data:image/jpeg;base64,${buf.toString("base64")}`;

let ts = fs.readFileSync(target, "utf8");
const line = /^export const LONE_ARCH_STYLE_REFERENCE: string \| null = .*$/m;
if (!line.test(ts)) {
  console.error("could not find the LONE_ARCH_STYLE_REFERENCE line to replace");
  process.exit(1);
}
ts = ts.replace(line, `export const LONE_ARCH_STYLE_REFERENCE: string | null =${"\n"}  ${JSON.stringify(dataUri)};`);
fs.writeFileSync(target, ts);

console.log(`embedded ${path.basename(src)} → ${meta.width}x${meta.height}, ${(buf.length / 1024).toFixed(0)} KB`);
console.log(`wrote ${path.relative(repoRoot, target)}`);
