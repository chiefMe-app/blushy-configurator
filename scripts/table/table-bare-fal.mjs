// The party photo's table pictures without their chairs (2026-11-05, the owner: the render had the photo's chairs,
// not hers — "sandalye bu seçili değil … userın seçtiğini yapalım"). One fal edit per table; run one at a time.
// node scripts/table/table-bare-fal.mjs <tableId>  →  public/design/table/table-<id>-bare.webp
import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
const projectDir = process.cwd();
const env = fs.readFileSync(path.join(projectDir, ".env.local"), "utf8");
const key = (env.match(/^FAL_KEY\s*=\s*"?([^"\r\n]+)"?/m) || [])[1];
const sharp = createRequire(path.join(projectDir, "package.json"))("sharp");
const [id] = process.argv.slice(2);
const src = path.join(projectDir, "public/design/table", `table-${id}.webp`);
const { width, height } = await sharp(src).metadata();
const W = Math.round(width / 16) * 16, H = Math.round(height / 16) * 16;
const png = await sharp(src).png().toBuffer();
const prompt = "Remove every chair from this photo, and everything standing on or around the table — cups, plates, flowers, toys, decorations. Leave only the empty table, exactly as it is: the same shape, top, edges, legs, colour, size and place. Where the chairs and things were, continue the same grass, wall and soft shadows seamlessly. Change nothing else; the same light, angle and photo.";
const t0 = Date.now();
const res = await fetch("https://fal.run/fal-ai/flux-2/edit", { method: "POST", headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({ prompt, image_urls: [`data:image/png;base64,${png.toString("base64")}`], image_size: { width: W, height: H }, num_images: 1, output_format: "png", seed: 7 }), signal: AbortSignal.timeout(170_000) });
if (!res.ok) { console.error(res.status, (await res.text()).slice(0, 300)); process.exit(1); }
const j = await res.json();
const img = Buffer.from(await (await fetch(j.images[0].url)).arrayBuffer());
await sharp(img).resize(width, height).webp({ quality: 88 }).toFile(path.join(projectDir, "public/design/table", `table-${id}-bare.webp`));
console.log(id, "ok", width, height, ((Date.now() - t0) / 1000).toFixed(1) + "s");
