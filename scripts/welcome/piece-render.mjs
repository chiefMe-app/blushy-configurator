// The welcome board's photo pieces (2026-10-31, the owner: "render almak değil,
// render görüntülerini kullanarak preview görsellerini oluşturmak" — as the
// table's top view): a balloon (tinted to every colour in the builder), a
// chrome balloon and roses — each rendered once, alone, straight on, on a key
// colour; scripts/welcome/piece-prepare.ts cuts them out. (The room and the
// easel are now whole scenes: scripts/welcome/scene-render.mjs.) Paid (Seedream, $0.035 a piece): run only with the owner's approval.
// node scripts/welcome/piece-render.mjs <projectDir> <outDir> [name,name…]
import fs from "node:fs"; import path from "node:path";
import sharp from "sharp";
const [dir, out, only] = process.argv.slice(2);
const env = fs.readFileSync(path.join(path.resolve(dir), ".env.local"), "utf8");
const key = (env.match(/^FAL_KEY\s*=\s*"?([^"\r\n]+)"?/m) || [])[1];
const KEYS = { green: ["#00B140", "chroma-key green (#00B140)"], magenta: ["#FF00FF", "magenta (#FF00FF)"] };
const plate = async (c) => `data:image/jpeg;base64,${(await sharp({ create: { width: 768, height: 768, channels: 3, background: c } }).jpeg().toBuffer()).toString("base64")}`;
const stage = (k) => `Seen straight on from the front at eye level, the piece centred with plenty of space round it, alone on a perfectly flat, even, pure ${KEYS[k][1]} background — no shadow on the background, no floor, no texture, no props, no other objects, no hands. Soft, bright, even daylight from the front left. Photo-real product photograph, crisp fine detail.`;
// [name, key colour, size, what]
const P = [
  ["balloon-latex", "green", "square_hd", "One round white matte-satin latex party balloon, about 28 cm (11 inch), fully inflated, seen from the side so it looks perfectly round, its knot hidden behind it; one soft highlight on its upper left, gentle shading towards its lower right."],
  ["balloon-chrome", "green", "square_hd", "One round shiny chrome silver party balloon, about 28 cm (11 inch), fully inflated, seen from the side so it looks perfectly round, its knot hidden behind it: a mirror-like metallic silver surface with soft, blurry light reflections, not reflecting any green."],
  ["roses-spray", "magenta", "landscape_4_3", "A lush horizontal spray of real-looking white and ivory silk roses, full open blooms of mixed sizes with a few small buds, soft green rose leaves and a few trailing eucalyptus sprigs, as fixed on the corner of a party sign, about 40 cm wide, its fullest roses at the centre-left and thinning out to the right."],
  ["roses-trio", "magenta", "square_hd", "A small tight cluster of three real-looking white and ivory silk roses with a few soft green leaves, about 15 cm across."],
];
const pick = P.filter((p) => !only || only.split(",").includes(p[0]));
await Promise.all(pick.map(async (p) => {
  const [name, k, size, what] = p;
  const prompt = `Image 1 is only the background colour to use. ${what} ${stage(k)}`;
  for (let a = 0; a < 3; a++) {
    try {
      const res = await fetch("https://fal.run/fal-ai/bytedance/seedream/v5/lite/edit", { method: "POST", headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, image_urls: [await plate(KEYS[k][0])], num_images: 1, output_format: "png", image_size: size }), signal: AbortSignal.timeout(170_000) });
      const j = await res.json();
      if (!res.ok) { console.log(name, "HTTP", res.status, JSON.stringify(j).slice(0, 200)); return; }
      // The image is fetched again on a network hiccup (2026-10-31: the render was paid for, the download lost).
      for (let d = 0; d < 4; d++) {
        try { fs.writeFileSync(path.join(out, `${name}${k === "magenta" ? "__magenta" : ""}.png`), Buffer.from(await (await fetch(j.images[0].url)).arrayBuffer())); break; }
        catch (e) { if (d === 3) { console.log(name, "paid but not downloaded:", j.images[0].url); return; } await new Promise((r) => setTimeout(r, 3000)); }
      }
      console.log("ok", name); return;
    } catch (e) { console.log(name, "retry", e.message); await new Promise((r) => setTimeout(r, 4000)); }
  }
}));
