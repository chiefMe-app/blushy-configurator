// One PNG of every fixture's render guide, labelled, for review.
// Usage: npx tsx scripts/golden/contact-sheet.ts [sourceDir] [out.png]
// Defaults to the last golden run (test-results/golden-render).
import fs from "fs";
import path from "path";
import sharp from "sharp";

const src = process.argv[2] ?? "test-results/golden-render";
const out = process.argv[3] ?? "test-results/golden-contact-sheet.png";
const W = 360, H = 270, LABEL = 28, COLS = 6;

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

(async () => {
  const ids = fs.readdirSync(src).filter((d) => fs.existsSync(path.join(src, d, "guide.png"))).sort();
  const rows = Math.ceil(ids.length / COLS);
  const tiles = await Promise.all(ids.map(async (id, i) => {
    const img = await sharp(path.join(src, id, "guide.png")).resize(W, H, { fit: "contain", background: "#ffffff" }).png().toBuffer();
    const label = Buffer.from(`<svg width="${W}" height="${LABEL}"><rect width="100%" height="100%" fill="#15182E"/><text x="8" y="19" font-family="Arial" font-size="14" fill="#fff">${esc(id)}</text></svg>`);
    const x = (i % COLS) * W, y = Math.floor(i / COLS) * (H + LABEL);
    return [{ input: label, left: x, top: y }, { input: img, left: x, top: y + LABEL }];
  }));
  await sharp({ create: { width: COLS * W, height: rows * (H + LABEL), channels: 3, background: "#ffffff" } })
    .composite(tiles.flat()).png().toFile(out);
  console.log(`${ids.length} guides -> ${out}`);
})();
