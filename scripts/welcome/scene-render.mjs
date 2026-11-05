// The welcome board's real photos (2026-10-31, the owner, with a render as the
// example: "görüntü bunun gibi gerçekçi olmalı, yazı sadece user tarafından
// değişebilir"): each board shape on its easel or on the wall, its face left
// blank, in an empty room — the builder prints the customer's design and words
// onto that face live. Each rendered once; scripts/welcome/scene-prepare.ts
// finds the board in each scene. (The garland: scripts/welcome/garland-sets.ts.)
// Paid (Seedream, $0.035 a picture): run only with the owner's approval.
// node scripts/welcome/scene-render.mjs <projectDir> <outDir> [name,name…]
import fs from "node:fs"; import path from "node:path";
import sharp from "sharp";
import { sceneFace, sceneFrame, TOP } from "./scene-geometry.mjs";
// The wavy board's own outline (run with `npx tsx`, which reads the TypeScript).
import wavyBoard from "../../lib/wavyBoard.ts";
const { wavyBoardPath, wavyFacePath } = wavyBoard;
const [dir, out, only] = process.argv.slice(2);
const env = fs.readFileSync(path.join(path.resolve(dir), ".env.local"), "utf8");
const key = (env.match(/^FAL_KEY\s*=\s*"?([^"\r\n]+)"?/m) || [])[1];

function guide(shape, stand) {
  const { w, h } = sceneFace(shape);
  const f = sceneFrame(shape, stand);
  const wall = f.floor - (stand === "easel" ? 10 : 0);
  const board = shape === "arch"
    ? `M0,${TOP + h}L0,${TOP + w / 2}A${w / 2},${w / 2} 0 0 1 ${w},${TOP + w / 2}L${w},${TOP + h}Z`
    : shape === "round" ? `M0,${TOP + h / 2}A${w / 2},${w / 2} 0 1 1 ${w},${TOP + h / 2}A${w / 2},${w / 2} 0 1 1 0,${TOP + h / 2}Z`
    : shape === "wavy" ? wavyBoardPath(0, TOP, w, h) : `M0,${TOP}H${w}V${TOP + h}H0Z`;
  const cx = w / 2;
  const easel = stand === "easel" ? `<g stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"><path d="M${cx},${TOP - 8}L${cx - 24},${f.floor}M${cx},${TOP - 8}L${cx + 24},${f.floor}M${cx},${TOP - 8}L${cx},${f.floor - 6}" /></g>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1536" viewBox="${f.x} ${f.y} ${f.size} ${f.size}">
    <rect x="${f.x}" y="${f.y}" width="${f.size}" height="${f.size}" fill="#EFE8E1" />
    <rect x="${f.x}" y="${wall}" width="${f.size}" height="${f.size}" fill="#D2B48F" />
    <rect x="${f.x}" y="${wall - 3}" width="${f.size}" height="3" fill="#F7F3EF" />
    ${easel}
    <path d="${board}" fill="#FFFFFF" stroke="#BDB3AA" stroke-width="0.4" />
    ${shape === "wavy" ? `<path d="${wavyFacePath(0, TOP, w, h, true)}" fill="#FFFFFF" stroke="#C9BFB5" stroke-width="0.35" />` : ""}
    ${stand === "easel" ? `<rect x="${cx - 30}" y="${TOP + h - 1}" width="60" height="4" fill="#FFFFFF" stroke="#C9BFB5" stroke-width="0.3" />` : ""}
  </svg>`;
}
// 2026-11-02 (the owner: "wavy shape koyalım welcome boarda backdroptaki aynı wavynin"): the Wavy Backdrop's board, small.
const SHAPE_WORDS = { rectangle: "rectangular, portrait-format", arch: "arch-topped (a tall rectangle with a fully rounded top)", round: "perfectly round",
  wavy: "portrait-format wavy-edged (its sides and top running in soft, even, rounded waves, its bottom edge straight), two-layer (a slightly bigger white back layer showing as an even raised rim all round the face, exactly as drawn)" };
const scenePrompt = (shape, stand) => [
  "Turn this flat drawing into a real photograph, keeping every shape exactly where it is and exactly as big as it is, the frame unchanged.",
  `The white shape is a blank welcome sign: a ${SHAPE_WORDS[shape]} smooth matt white foam board with a thin, crisp white edge; its face completely blank, plain pure white — nothing printed, painted or written on it.`,
  stand === "easel" ? "It stands on a simple white painted wooden A-frame display easel, resting on the easel's ledge, exactly where the drawing has them." : "It hangs flat on the wall, exactly where the drawing has it, with a soft shadow behind it.",
  "An empty, bright party room: a plain warm-white wall, a light natural oak wooden floor, a slim white skirting board where they meet. Soft natural daylight from the front left, soft natural shadows on the floor.",
  "Seen straight on at eye level, the board square to the camera, the whole picture sharp. No balloons, no flowers, no decorations, no furniture, no people, no writing anywhere. Photo-real event-styling photograph, crisp fine detail.",
].join(" ");

const jobs = [];
for (const shape of ["rectangle", "arch", "round", "wavy"]) for (const stand of ["easel", "none"]) {
  jobs.push({ name: `scene-${shape}-${stand}`, size: "square_hd", prompt: scenePrompt(shape, stand), image: async () => sharp(Buffer.from(guide(shape, stand))).jpeg({ quality: 92 }).toBuffer() });
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
