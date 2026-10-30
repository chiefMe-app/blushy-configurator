// New themes' icons in the customer's crayon style (2026-10-30, the owner:
// "create same style as the other logos for the new themes"): two of her icons
// show the style, the words say what to draw. Theme shapes only — no
// characters. Paid (Seedream, $0.035 an icon): run only with her approval.
// node scripts/themes/icon-render.mjs <projectDir> <outDir> [icon,icon…]
import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
const [dir, out, only] = process.argv.slice(2);
const projectDir = path.resolve(dir);
const require = createRequire(path.join(projectDir, "package.json"));
const sharp = require("sharp");
const env = fs.readFileSync(path.join(projectDir, ".env.local"), "utf8");
const key = (env.match(/^FAL_KEY\s*=\s*"?([^"\r\n]+)"?/m) || [])[1];
const ref = async (f) => `data:image/png;base64,${(await sharp(path.join(projectDir, "public/design/themes-v2", f)).png().toBuffer()).toString("base64")}`;

const ICONS = {
  "butterfly-fairy": "a big pastel pink and lilac butterfly wearing a tiny striped party hat, fluttering over daisies and little garden flowers, with a sparkly fairy wand and tiny sparkles",
  "vehicles": "a bright red toy race car with a little striped party flag, a yellow toy digger and a little blue toy steam train behind it — plain toy vehicles with no faces, no eyes and no mouths",
  "under-the-sea": "a friendly smiling blue shark wearing a striped party hat, with bubbles, a little orange fish, a starfish and seaweed",
  "circus": "a red-and-white striped circus big-top tent with little flags on top, stars, bunting and a striped popcorn box beside it",
  "ballerina": "a pair of blush pink satin ballet slippers with long ribbons and a fluffy pink tulle tutu, with a graceful white swan beside them and little bows and sparkles",
  "pirates": "a little wooden pirate ship with red-and-white striped sails on blue waves, an open treasure chest of gold coins and a rolled treasure map",
  "football": "a black-and-white soccer ball wearing a little striped party hat, with a small gold trophy, a green pitch patch with a goal net and little stars",
  "dinosaur-girl": "a cute pastel pink and lilac long-necked dinosaur with soft spots, wearing a party hat with a little bow, with flowers at its feet and pastel confetti — the same kind of dinosaur as image 1, but pink and girly",
};

const style = "Images 1 and 2 are two icons from one hand-drawn set. Draw a NEW icon for the same set, in exactly the same style: soft coloured-pencil and crayon texture, bright cheerful children's party colours, gentle shading, plain white background, the subject centred and filling most of the square, little confetti dots around it. No text, no letters, no numbers, no logos, no well-known characters.";
const refs = [await ref("dinosaur.webp"), await ref("mermaid.webp")];
await Promise.all(Object.entries(ICONS).filter(([n]) => !only || only.split(",").includes(n)).map(async ([name, what]) => {
  for (let a = 0; a < 4; a++) {
    try {
      const res = await fetch("https://fal.run/fal-ai/bytedance/seedream/v5/lite/edit", { method: "POST", headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `${style} The new icon shows ${what}.`, image_urls: refs, num_images: 1, output_format: "png", image_size: "square_hd" }), signal: AbortSignal.timeout(170_000) });
      const j = await res.json();
      if (!res.ok) { console.log(name, "HTTP", res.status, JSON.stringify(j).slice(0, 200)); if (res.status === 429) { await new Promise((r) => setTimeout(r, 8000)); continue; } return; }
      const buf = Buffer.from(await (await fetch(j.images[0].url)).arrayBuffer());
      fs.writeFileSync(path.join(out, `${name}.png`), buf);
      await sharp(buf).resize(300, 300, { fit: "contain", background: "#ffffff" }).flatten({ background: "#ffffff" }).webp({ quality: 86 }).toFile(path.join(projectDir, "public/design/themes-v2", `${name}.webp`));
      console.log("ok", name); return;
    } catch (e) { console.log(name, "retry", e.message); await new Promise((r) => setTimeout(r, 4000)); }
  }
}));
