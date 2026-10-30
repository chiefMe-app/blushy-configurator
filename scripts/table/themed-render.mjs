// The themed cups, plates and napkins (lib/studio/tableThemed.json), each
// once, alone, on a chroma background, for scripts/table/top-prepare.ts to cut
// out — the picture on its option card and its piece in the top view. Drawn
// from words only (2026-10-30: never from a shop's photo), with no characters,
// logos or words. A piece with green in it goes on magenta instead of green.
// Paid (Seedream, $0.035 a piece): run only with the owner's approval.
// node scripts/table/themed-render.mjs <projectDir> <outDir> [id,id…]
import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
const [dir, out, only] = process.argv.slice(2);
const projectDir = path.resolve(dir);
const require = createRequire(path.join(projectDir, "package.json"));
const sharp = require("sharp");
const env = fs.readFileSync(path.join(projectDir, ".env.local"), "utf8");
const key = (env.match(/^FAL_KEY\s*=\s*"?([^"\r\n]+)"?/m) || [])[1];
const { items } = JSON.parse(fs.readFileSync(path.join(projectDir, "lib/studio/tableThemed.json"), "utf8"));

const plain = async (hex) => `data:image/jpeg;base64,${(await sharp({ create: { width: 768, height: 576, channels: 3, background: hex } }).jpeg().toBuffer()).toString("base64")}`;
const GREEN = { hex: "#00B140", words: "pure chroma-key green (#00B140)" }, MAGENTA = { hex: "#FF00FF", words: "pure chroma-key magenta (#FF00FF)" };
const stage = (bg) => `Shot looking straight down from directly above (a flat lay, top view, the camera square to the table), the piece centred with plenty of space round it, alone on a perfectly flat, even, ${bg.words} background — no shadow on the background, no texture, no props, no other objects, no hands. Soft, bright, even daylight. Photo-real product photograph, crisp fine detail. No characters, no faces of people, no logos, no brand names, no words, no letters, no numbers.`;
const WHAT = {
  cups: (look) => `One paper party cup standing upright, seen from above and a little in front so you see into it and also its outside: its inside is plain white, and its outside is ${look}. Empty, no straw, no lid.`,
  plates: (look) => `A big round disposable paper party plate, about 23 cm across, ${look}, with a smaller plate of exactly the same design, about 18 cm across, sitting exactly in its centre; both empty, nothing on them.`,
  napkins: (look) => `One paper napkin, ${look}, folded into a flat, tall, narrow rectangle about 8 cm wide and 20 cm long, lying flat. Nothing on it.`,
};
// Pieces with green in them are shot on magenta.
const greenish = /green|jungle|leaves|leaf|pitch|dinosaur|dino|teal|mint/i;

const jobs = items.filter((i) => !only || only.split(",").some((o) => `${i.item}-${i.id}` === o || i.theme === o));
const queue = [...jobs];
await Promise.all(Array.from({ length: 6 }, async () => {
  while (queue.length) {
    const it = queue.shift();
    const bg = greenish.test(`${it.look} ${it.id}`) ? MAGENTA : GREEN;
    const name = `themed-${it.item}-${it.id}${bg === MAGENTA ? "__magenta" : ""}`;
    if (fs.existsSync(path.join(out, `${name}.png`))) continue;
    const prompt = `Image 1 is only the background to use. ${WHAT[it.item](it.look)} ${stage(bg)}`;
    for (let a = 0; a < 4; a++) {
      try {
        const res = await fetch("https://fal.run/fal-ai/bytedance/seedream/v5/lite/edit", { method: "POST", headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, image_urls: [await plain(bg.hex)], num_images: 1, output_format: "png", image_size: "square_hd" }), signal: AbortSignal.timeout(170_000) });
        const j = await res.json();
        if (!res.ok) { console.log(name, "HTTP", res.status, JSON.stringify(j).slice(0, 200)); if (res.status === 429) { await new Promise((r) => setTimeout(r, 8000)); continue; } break; }
        fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(await (await fetch(j.images[0].url)).arrayBuffer()));
        console.log("ok", name); break;
      } catch (e) { console.log(name, "retry", e.message); await new Promise((r) => setTimeout(r, 4000)); }
    }
  }
}));
