// The experiences' pictures (2026-11-04): scripts/experiences/sources/*.jpg are flux-2 text-to-image stand-ins, one
// per experience (a white, pastel party room; no text, logos or characters), until the owner sends her own photos.
// Each is written to public/design/experiences/<name>.webp at the cards' size.
//   npx tsx scripts/experiences/build.mts
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SRC = path.join(ROOT, "scripts/experiences/sources");
const OUT = path.join(ROOT, "public/design/experiences");
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(SRC).filter((n) => n.endsWith(".jpg")).sort()) {
  await sharp(path.join(SRC, f)).resize(640, 480, { fit: "cover" }).webp({ quality: 80 }).toFile(path.join(OUT, f.replace(/\.jpg$/, ".webp")));
  console.log(f);
}
