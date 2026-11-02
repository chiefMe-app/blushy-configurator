// The welcome board's watercolour art, upright on a portrait board (2026-11-02, the owner: "welcome boarddaki
// rainbowlar saat yönünün tersine 90 derece dönmesi lazım"): the placemat art is landscape, and turned a
// quarter for the board its corner pictures lay on their sides. Free and local: the art's wash turned and
// softened for the ground, each corner's pictures laid on it the right way up.
// npx tsx scripts/welcome/portrait-art.ts [theme…]  → public/design/table/placemats/<theme>/watercolour-portrait.webp
import sharp from "sharp";
import { readdirSync } from "node:fs";
import path from "node:path";

const DIR = "public/design/table/placemats";
/** The portrait art's size (the boards are 60 × 84 to 80 × 120: a little taller than 1.4 fills them all). */
const W = 512, H = 768;
/** How wide each corner's quarter of the art is laid, and over how much of it it fades into the ground. */
const CW = 300, FADE = 70;

async function portrait(theme: string) {
  const src = path.join(DIR, theme, "watercolour.webp");
  const { width: sw = 736, height: sh = 512 } = await sharp(src).metadata();
  // The ground: the art turned a quarter, stretched to the board and blurred to a wash.
  const ground = await sharp(src).rotate(90).resize(W, H, { fit: "fill" }).blur(28).toBuffer();
  const ch = Math.round((CW * (sh / 2)) / (sw / 2));
  const layers: { input: Buffer; left: number; top: number }[] = [];
  for (const [qx, qy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
    const quarter = await sharp(src).extract({ left: qx * Math.floor(sw / 2), top: qy * Math.floor(sh / 2), width: Math.floor(sw / 2), height: Math.floor(sh / 2) })
      .resize(CW, ch).ensureAlpha().raw().toBuffer();
    // Opaque at the board's own edges, fading out towards its middle.
    for (let y = 0; y < ch; y++) for (let x = 0; x < CW; x++) {
      const dx = qx ? x : CW - 1 - x, dy = qy ? y : ch - 1 - y; // distance from the inner edges
      const a = Math.min(1, dx / FADE) * Math.min(1, dy / FADE);
      quarter[(y * CW + x) * 4 + 3] = Math.round(255 * a * a * (3 - 2 * a));
    }
    layers.push({ input: await sharp(quarter, { raw: { width: CW, height: ch, channels: 4 } }).png().toBuffer(), left: qx ? W - CW : 0, top: qy ? H - ch : 0 });
  }
  const out = path.join(DIR, theme, "watercolour-portrait.webp");
  await sharp(ground).composite(layers).webp({ quality: 88 }).toFile(out);
  console.log(out);
}

(async () => {
  const themes = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(DIR);
  for (const t of themes) await portrait(t);
})();
