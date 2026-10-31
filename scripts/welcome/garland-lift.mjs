// The welcome board's garland (2026-10-31, the owner, after three garlands of
// my own: "burdaki balonlar iyi gözüküyordu"): the one in the welcome step's own
// "Balloon garland" option photo, lifted out of it onto chroma green by one
// edit; scripts/welcome/scene-prepare.ts cuts it out as garland-pastel.
// Paid (Seedream, $0.035): run only with the owner's approval.
// node scripts/welcome/garland-lift.mjs <projectDir> <the option photo, full size> <out.png>
import fs from "node:fs"; import path from "node:path";
const [dir, src, out] = process.argv.slice(2);
const env = fs.readFileSync(path.join(path.resolve(dir), ".env.local"), "utf8");
const key = (env.match(/^FAL_KEY\s*=\s*"?([^"\r\n]+)"?/m) || [])[1];
const uri = `data:image/jpeg;base64,${fs.readFileSync(src).toString("base64")}`;
const prompt = "Keep the balloon garland in image 1 exactly as it is — every balloon in the same place, the same size, the same colour and the same shine, nothing added, nothing removed, nothing moved. Replace everything else — the white sign board, the easel, the wall, the floor, the light patches — with a perfectly flat, even, pure chroma-key green (#00B140) background, no shadows on it. Where the sign was behind the balloons, only green. Photo-real, crisp detail, the same framing.";
const res = await fetch("https://fal.run/fal-ai/bytedance/seedream/v5/lite/edit", { method: "POST", headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({ prompt, image_urls: [uri], num_images: 1, output_format: "png", image_size: "landscape_4_3" }), signal: AbortSignal.timeout(170_000) });
const r = await res.json();
if (!res.ok) { console.log("HTTP", res.status, JSON.stringify(r).slice(0, 200)); process.exit(1); }
for (let d = 0; d < 5; d++) {
  try { fs.writeFileSync(out, Buffer.from(await (await fetch(r.images[0].url)).arrayBuffer())); console.log("ok"); process.exit(0); }
  catch (e) { await new Promise((s) => setTimeout(s, 3000)); }
}
console.log("paid but not downloaded:", r.images[0].url);
