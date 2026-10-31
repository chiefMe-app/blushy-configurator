// The welcome board's real photos (2026-10-31, the owner, with a render as the
// example: "görüntü bunun gibi gerçekçi olmalı, yazı sadece user tarafından
// değişebilir"): each board shape on its easel or on the wall, its face left
// blank, in an empty room — the builder prints the customer's design and words
// onto that face live — and, per theme, a real balloon garland on chroma green
// to stand beside it. Each rendered once; scripts/welcome/scene-prepare.ts
// finds the board in each scene and cuts the garlands out.
// Paid (Seedream, $0.035 a picture): run only with the owner's approval.
// node scripts/welcome/scene-render.mjs <projectDir> <outDir> [name,name…]
import fs from "node:fs"; import path from "node:path";
import sharp from "sharp";
import { sceneFace, sceneFrame, TOP } from "./scene-geometry.mjs";
const [dir, out, only] = process.argv.slice(2);
const env = fs.readFileSync(path.join(path.resolve(dir), ".env.local"), "utf8");
const key = (env.match(/^FAL_KEY\s*=\s*"?([^"\r\n]+)"?/m) || [])[1];

function guide(shape, stand) {
  const { w, h } = sceneFace(shape);
  const f = sceneFrame(shape, stand);
  const wall = f.floor - (stand === "easel" ? 10 : 0);
  const board = shape === "arch"
    ? `M0,${TOP + h}L0,${TOP + w / 2}A${w / 2},${w / 2} 0 0 1 ${w},${TOP + w / 2}L${w},${TOP + h}Z`
    : shape === "round" ? `M0,${TOP + h / 2}A${w / 2},${w / 2} 0 1 1 ${w},${TOP + h / 2}A${w / 2},${w / 2} 0 1 1 0,${TOP + h / 2}Z` : `M0,${TOP}H${w}V${TOP + h}H0Z`;
  const cx = w / 2;
  const easel = stand === "easel" ? `<g stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"><path d="M${cx},${TOP - 8}L${cx - 24},${f.floor}M${cx},${TOP - 8}L${cx + 24},${f.floor}M${cx},${TOP - 8}L${cx},${f.floor - 6}" /></g>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1536" viewBox="${f.x} ${f.y} ${f.size} ${f.size}">
    <rect x="${f.x}" y="${f.y}" width="${f.size}" height="${f.size}" fill="#EFE8E1" />
    <rect x="${f.x}" y="${wall}" width="${f.size}" height="${f.size}" fill="#D2B48F" />
    <rect x="${f.x}" y="${wall - 3}" width="${f.size}" height="3" fill="#F7F3EF" />
    ${easel}
    <path d="${board}" fill="#FFFFFF" stroke="#BDB3AA" stroke-width="0.4" />
    ${stand === "easel" ? `<rect x="${cx - 30}" y="${TOP + h - 1}" width="60" height="4" fill="#FFFFFF" stroke="#C9BFB5" stroke-width="0.3" />` : ""}
  </svg>`;
}
const SHAPE_WORDS = { rectangle: "rectangular, portrait-format", arch: "arch-topped (a tall rectangle with a fully rounded top)", round: "perfectly round" };
const scenePrompt = (shape, stand) => [
  "Turn this flat drawing into a real photograph, keeping every shape exactly where it is and exactly as big as it is, the frame unchanged.",
  `The white shape is a blank welcome sign: a ${SHAPE_WORDS[shape]} smooth matt white foam board with a thin, crisp white edge; its face completely blank, plain pure white — nothing printed, painted or written on it.`,
  stand === "easel" ? "It stands on a simple white painted wooden A-frame display easel, resting on the easel's ledge, exactly where the drawing has them." : "It hangs flat on the wall, exactly where the drawing has it, with a soft shadow behind it.",
  "An empty, bright party room: a plain warm-white wall, a light natural oak wooden floor, a slim white skirting board where they meet. Soft natural daylight from the front left, soft natural shadows on the floor.",
  "Seen straight on at eye level, the board square to the camera, the whole picture sharp. No balloons, no flowers, no decorations, no furniture, no people, no writing anywhere. Photo-real event-styling photograph, crisp fine detail.",
].join(" ");

// A garland per theme, in the theme's balloon colours (in words: a colour picker's names mislead the model).
const GARLANDS = {
  frozen: "white, pale ice blue, soft pastel lilac and shiny chrome silver",
};
// Its shape drawn as grey circles on the green (2026-10-31: asked in words only, it came out a tapering tree):
// wide on the floor, up the sign's right side, curving over to the left at the top, as round a welcome sign.
function garlandGuide() {
  let rnd = 7; const r = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
  const pts = [];
  for (let t = 0; t <= 1.0001; t += 0.035) {
    const y = 119 - t * 106, x = 60 + Math.sin(t * Math.PI * 0.9) * 7 - (t > 0.72 ? (t - 0.72) * 95 : 0);
    const size = 9.5 - t * 4, spread = t < 0.18 ? 2.6 : 1.5;
    for (let k = 0; k < 3; k++) pts.push([x + (r() - 0.5) * size * spread, y + (r() - 0.5) * 5, size * (0.5 + r() * 0.5)]);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024" viewBox="0 0 100 133.3"><rect width="100" height="133.3" fill="#00B140" />${pts.map(([x, y, s]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${s.toFixed(1)}" fill="#D9D9D9" stroke="#BBBBBB" stroke-width="0.3" />`).join("")}</svg>`;
}
const garlandPrompt = (colours) => `Image 1 shows, on a green background, the exact outline of a balloon garland as grey circles. Turn the grey circles into a real, lush, full organic balloon garland filling exactly that outline — wide and full on the floor at the bottom, rising up, and curving over to the left at its top, as it goes up the side of a welcome sign and over its top corner (the sign is not in the picture): many round latex balloons of mixed sizes — 5, 11 and 18 inch — clustered tightly with no gaps, ONLY in ${colours}. No other colours. Keep the background exactly the flat, even, pure chroma-key green (#00B140) of image 1 — no shadow on it, no floor, no stand, no sign, no other objects. Seen straight on from the front at eye level. Soft, bright, even daylight from the front left. Photo-real event-styling photograph, crisp fine detail.`;

const jobs = [];
for (const shape of ["rectangle", "arch", "round"]) for (const stand of ["easel", "none"]) {
  jobs.push({ name: `scene-${shape}-${stand}`, size: "square_hd", prompt: scenePrompt(shape, stand), image: async () => sharp(Buffer.from(guide(shape, stand))).jpeg({ quality: 92 }).toBuffer() });
}
for (const [theme, colours] of Object.entries(GARLANDS)) {
  jobs.push({ name: `garland-${theme}`, size: "portrait_4_3", prompt: garlandPrompt(colours), image: async () => sharp(Buffer.from(garlandGuide())).jpeg({ quality: 92 }).toBuffer() });
}
const pick = jobs.filter((j) => !only || only.split(",").includes(j.name));
if (process.env.GUIDES_ONLY) { for (const j of pick) fs.writeFileSync(path.join(out, `guide-${j.name}.jpg`), await j.image()); process.exit(0); }
await Promise.all(pick.map(async (j) => {
  const uri = `data:image/jpeg;base64,${(await j.image()).toString("base64")}`;
  for (let a = 0; a < 3; a++) {
    try {
      const res = await fetch("https://fal.run/fal-ai/bytedance/seedream/v5/lite/edit", { method: "POST", headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: j.prompt, image_urls: [uri], num_images: 1, output_format: "png", image_size: j.size }), signal: AbortSignal.timeout(170_000) });
      const r = await res.json();
      if (!res.ok) { console.log(j.name, "HTTP", res.status, JSON.stringify(r).slice(0, 200)); return; }
      for (let d = 0; d < 4; d++) {
        try { fs.writeFileSync(path.join(out, `${j.name}.png`), Buffer.from(await (await fetch(r.images[0].url)).arrayBuffer())); break; }
        catch (e) { if (d === 3) { console.log(j.name, "paid but not downloaded:", r.images[0].url); return; } await new Promise((s) => setTimeout(s, 3000)); }
      }
      console.log("ok", j.name); return;
    } catch (e) { console.log(j.name, "retry", e.message); await new Promise((s) => setTimeout(s, 4000)); }
  }
}));
