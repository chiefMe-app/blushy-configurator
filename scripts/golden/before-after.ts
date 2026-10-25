// Before/after sheet: the committed baseline guide (left) next to the last
// golden run (right), for the fixtures named, or every changed one.
// Usage: npx tsx scripts/golden/before-after.ts [out.png] [id ...] [--crop]
//   --crop shows only the upper-middle of each guide, where the lettering is.
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import sharp, { type OverlayOptions } from "sharp";

const args = process.argv.slice(2);
const crop = args.includes("--crop");
const rest = args.filter((a) => a !== "--crop");
const out = rest[0] ?? "test-results/golden-before-after.png";
const run = "test-results/golden-render", base = "tests/golden/render";
const changed = (id: string) =>
  createHash("sha256").update(fs.readFileSync(path.join(run, id, "guide.png"))).digest("hex")
  !== fs.readFileSync(path.join(base, id, "guide.sha256"), "utf8").trim();
const ids = rest.length > 1 ? rest.slice(1) : fs.readdirSync(base).sort().filter(changed);
const W = 440, H = crop ? 300 : 330, LABEL = 26;
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

async function tile(file: string) {
  let img = sharp(file);
  if (crop) {
    const m = await sharp(file).metadata();
    img = img.extract({ left: Math.round(m.width! * 0.2), top: Math.round(m.height! * 0.12), width: Math.round(m.width! * 0.62), height: Math.round(m.height! * 0.42) });
  }
  return img.resize(W, H, { fit: "contain", background: "#ffffff" }).png().toBuffer();
}

(async () => {
  const parts: OverlayOptions[] = [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const y = i * (H + LABEL);
    const label = Buffer.from(`<svg width="${W * 2}" height="${LABEL}"><rect width="100%" height="100%" fill="#15182E"/><text x="8" y="18" font-family="Arial" font-size="14" fill="#fff">${esc(id)} — baseline | now</text></svg>`);
    parts.push({ input: label, left: 0, top: y });
    parts.push({ input: await tile(path.join(base, id, "guide.png")), left: 0, top: y + LABEL });
    parts.push({ input: await tile(path.join(run, id, "guide.png")), left: W, top: y + LABEL });
  }
  await sharp({ create: { width: W * 2, height: ids.length * (H + LABEL), channels: 3, background: "#ffffff" } })
    .composite(parts).png().toFile(out);
  console.log(`${ids.length} pairs -> ${out}`);
})();
