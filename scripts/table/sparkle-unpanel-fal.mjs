// One fal edit per sparkle placemat whose panel would not come off cleanly. Run one at a time.
import fs from "node:fs"; import path from "node:path";
const projectDir = process.cwd();
const env = fs.readFileSync(path.join(projectDir, ".env.local"), "utf8");
const key = (env.match(/^FAL_KEY\s*=\s*"?([^"\r\n]+)"?/m) || [])[1];
const [theme, outDir] = process.argv.slice(2);
const src = path.join(projectDir, "public/design/table/placemats", theme, "sparkle.webp");
import { createRequire } from "node:module"; const sharp = createRequire(path.join(projectDir, "package.json"))("sharp");
const png = await sharp(src).png().toBuffer();
const prompt = "Remove the pale translucent white rectangle (the blank writing panel and its thin frame) on the left side of this card. Where it was, continue the very same sparkly background seamlessly — the same colours and gradient, glitter, bokeh and little stars as around it — so the whole card is one continuous sparkly background. Keep the picture on the right exactly as it is, same place and size; change nothing else. Flat print artwork, no text.";
const t0 = Date.now();
const res = await fetch("https://fal.run/fal-ai/flux-2/edit", { method: "POST", headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({ prompt, image_urls: [`data:image/png;base64,${png.toString("base64")}`], image_size: { width: 736, height: 512 }, num_images: 1, output_format: "png", seed: 7 }), signal: AbortSignal.timeout(170_000) });
if (!res.ok) { console.error(res.status, (await res.text()).slice(0, 300)); process.exit(1); }
const j = await res.json();
const url = j.images[0].url;
const img = Buffer.from(await (await fetch(url)).arrayBuffer());
await sharp(img).resize(736, 512).webp({ quality: 90 }).toFile(path.join(outDir, `${theme}.webp`));
console.log(theme, "ok", ((Date.now() - t0) / 1000).toFixed(1) + "s");
