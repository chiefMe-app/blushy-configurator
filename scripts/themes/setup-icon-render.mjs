// New backdrop setups' card icons in the customer's crayon set (public/design/backdrops-v2),
// 2026-11-01: the Wavy Board and the Fringe Backdrop. Two of her icons show the style.
// Paid (Seedream, $0.035 an icon): run only with her approval.
// node scripts/themes/setup-icon-render.mjs <projectDir> <outDir> [icon,icon…]
import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
const [dir, out, only] = process.argv.slice(2);
const projectDir = path.resolve(dir);
const require = createRequire(path.join(projectDir, "package.json"));
const sharp = require("sharp");
const env = fs.readFileSync(path.join(projectDir, ".env.local"), "utf8");
const key = (env.match(/^FAL_KEY\s*=\s*"?([^"\r\n]+)"?/m) || [])[1];
const ref = async (f) => `data:image/png;base64,${(await sharp(path.join(projectDir, "public/design/backdrops-v2", f)).flatten({ background: "#fff" }).png().toBuffer()).toString("base64")}`;
const ICONS = {
  "wavy-board": "one tall hot-pink board with a wavy, curvy outline all round (soft waves down both sides and a wavy top, like a wavy mirror), standing on the ground, with a small cluster of red, yellow and blue balloons at its top right corner",
  "fringe": "a square backdrop of long hanging fringe streamers in vertical stripes of hot pink, purple, turquoise and gold tinsel, hanging from a thin bar, with a small cluster of red, yellow and blue balloons at its top right corner",
};
const style = "Images 1 and 2 are two icons from one hand-drawn set of party backdrop icons. Draw a NEW icon for the same set, in exactly the same style: the same bold coloured-pencil and crayon texture, the same bright saturated colours, the same little black sparkle strokes beside it, plain white background, the subject centred, the same size in the picture as in the examples. No words, no letters. Draw:";
const refs = [await ref("single-arch.webp"), await ref("banner.webp")];
await Promise.all(Object.entries(ICONS).filter(([n]) => !only || only.split(",").includes(n)).map(async ([name, what]) => {
  for (let a = 0; a < 3; a++) {
    try {
      const res = await fetch("https://fal.run/fal-ai/bytedance/seedream/v5/lite/edit", { method: "POST", headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `${style} ${what}.`, image_urls: refs, num_images: 1, output_format: "png", image_size: { width: 1872, height: 1272 } }), signal: AbortSignal.timeout(170_000) });
      const j = await res.json();
      if (!res.ok) { console.log(name, "HTTP", res.status, JSON.stringify(j).slice(0, 200)); return; }
      fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(await (await fetch(j.images[0].url)).arrayBuffer()));
      console.log("ok", name); return;
    } catch (e) { console.log(name, "retry", e.message); await new Promise((r) => setTimeout(r, 4000)); }
  }
}));
