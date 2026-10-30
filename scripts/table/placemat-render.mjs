// A theme's three A3 placemat designs (pattern, watercolour, sparkle), as the
// first themes' were made on 2026-10-28: flat printed artwork, no characters,
// no words. The bottle labels wear the same designs, and the pattern is the
// theme's printed pattern. Paid (FLUX.2 flash, a few cents a picture): run only
// with the owner's approval.
// node scripts/table/placemat-render.mjs <projectDir> [themeId,themeId…]
import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
const [dir, only] = process.argv.slice(2);
const projectDir = path.resolve(dir);
const require = createRequire(path.join(projectDir, "package.json"));
const sharp = require("sharp");
const env = fs.readFileSync(path.join(projectDir, ".env.local"), "utf8");
const key = (env.match(/^FAL_KEY\s*=\s*"?([^"\r\n]+)"?/m) || [])[1];
const pub = path.join(projectDir, "public/design/table/placemats");

// id: [two colours, the motif, the one big emblem of the sparkle design]
const THEMES = {
  butterfly_fairy: ["soft pastel pink", "pale lilac", "butterflies, daisies and little flowers", "butterfly"],
  vehicles: ["sunny yellow", "pale sky blue", "race cars, fire trucks, diggers and trains", "race car"],
  under_the_sea: ["ocean blue", "pale aqua", "friendly sharks, whales, fish and bubbles", "whale"],
  circus: ["cherry red", "warm cream", "circus tents, stars, popcorn and bunting", "circus tent"],
  ballerina: ["blush pink", "pearl white", "ballet slippers, tutus, swans and bows", "swan"],
  pirates: ["navy blue", "sandy cream", "pirate ships, treasure chests, maps and anchors", "pirate ship"],
};
const FLAT = "Flat printed artwork filling the whole frame edge to edge, seen straight on, no border, no photo, no table, no shadows. No text, no letters, no numbers, no people, no faces, no cartoon characters, no logos.";
const JOBS = {};
for (const [id, [c1, c2, motif, emblem]] of Object.entries(THEMES)) {
  if (only && !only.split(",").includes(id)) continue;
  JOBS[`${id}/pattern.webp`] = `A playful all-over pattern of ${motif}, drawn as simple soft white and pale line illustrations in many sizes, scattered evenly on a solid soft ${c1} background, like printed kids' party paper. Clean flat vector illustration. ${FLAT}`;
  JOBS[`${id}/watercolour.webp`] = `A dreamy soft watercolour wash background blending ${c1}, ${c2} and white, with large delicate ${motif} painted in white and pale tones clustered in the corners, the middle left calm, soft and empty. Delicate painterly kids' party stationery. ${FLAT}`;
  JOBS[`${id}/sparkle.webp`] = `A magical sparkling background in ${c1} and ${c2}, with soft glitter, glowing light and tiny sparkles, and one large elegant ${emblem} emblem on the right side, the left two thirds left clear and calm. Dreamy kids' party stationery. ${FLAT}`;
}
const queue = Object.keys(JOBS).filter((f) => !fs.existsSync(path.join(pub, f)));
console.log(`${queue.length} designs to make`);
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length) {
    const f = queue.shift();
    for (let a = 0; a < 4; a++) {
      try {
        const res = await fetch("https://fal.run/fal-ai/flux-2/flash", { method: "POST", headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: JOBS[f], image_size: { width: 704, height: 496 }, num_images: 1, seed: 4242, output_format: "png", enable_safety_checker: true }) });
        const j = await res.json();
        if (!res.ok) { console.log(f, "HTTP", res.status, JSON.stringify(j).slice(0, 200)); break; }
        const buf = Buffer.from(await (await fetch(j.images[0].url)).arrayBuffer());
        fs.mkdirSync(path.dirname(path.join(pub, f)), { recursive: true });
        await sharp(buf).webp({ quality: 82 }).toFile(path.join(pub, f));
        console.log("ok", f); break;
      } catch (e) { console.log(f, "retry", e.message); await new Promise((r) => setTimeout(r, 3000)); }
    }
  }
}));
