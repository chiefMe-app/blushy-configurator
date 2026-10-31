// The welcome board's option pictures (2026-10-31, the owner: "bu seçeneklerin
// renderını alıp" — pictures on the option cards, as the kids' table has):
// balloons & flowers, shapes, board material, stand. Drawn from words only,
// with nothing written on the boards (a model's lettering comes out garbled;
// the customer's own words are in the drawing and the render).
// Paid (flux-2 flash, about $0.005 a picture): run only with the owner's approval.
// node scripts/welcome/option-pictures.mjs <projectDir> <outDir> [id,id…]
import fs from "node:fs"; import path from "node:path";
const [dir, out, only] = process.argv.slice(2);
const projectDir = path.resolve(dir);
const env = fs.readFileSync(path.join(projectDir, ".env.local"), "utf8");
const key = (env.match(/^FAL_KEY\s*=\s*"?([^"\r\n]+)"?/m) || [])[1];
fs.mkdirSync(out, { recursive: true });

const BLANK = "Its printed face is completely blank: plain white with only a very soft pale watercolour wash at the edges — absolutely no words, no letters, no numbers, no writing of any kind anywhere in the picture.";
const ROOM = "In a bright, airy party venue with a pale wall and a light floor, soft natural daylight. Photo-real event-styling photograph, crisp detail, 4:3. No people, no characters, no logos.";
const BOARD = (shape) => `A ${shape} welcome sign board in portrait format — clearly taller than it is wide, about 70 cm wide and 100 cm tall — standing on a simple white wooden display easel.`;
const GARLAND = "An organic balloon garland in white, blush pink, pale blue, lilac and a few silver chrome balloons — mixed sizes, big and small — runs up the right side of the board from the floor to just above its top, overlapping the board's edge.";
const FLOWERS = "Lush sprays of white and blush silk roses with soft green leaves are fixed on the board's top-left corner and bottom-right corner.";
const JOBS = {
  "garnish-none": `${BOARD("rectangular")} ${BLANK} Nothing else on or around it. ${ROOM}`,
  "garnish-balloons": `${BOARD("rectangular")} ${BLANK} ${GARLAND} ${ROOM}`,
  "garnish-flowers": `${BOARD("rectangular")} ${BLANK} ${FLOWERS} No balloons. ${ROOM}`,
  "garnish-both": `${BOARD("rectangular")} ${BLANK} ${GARLAND} White and blush silk roses with green leaves are tucked into the garland and also fixed on the board's top-left corner. ${ROOM}`,
  "shape-rectangle": `${BOARD("tall rectangular")} ${BLANK} ${ROOM}`,
  "shape-arch": `${BOARD("tall arch-topped (a rectangle with a fully rounded semicircular top)")} ${BLANK} ${ROOM}`,
  "shape-round": `A perfectly round, circular welcome sign board, about 70 cm across, standing on a simple white wooden display easel. ${BLANK} ${ROOM}`,
  "material-foam": `A close-up of the top corner of a matt white foam board sign: its flat 5 mm white foam edge is clearly visible, the print matte with no shine. ${BLANK} Soft daylight, shallow depth of field, photo-real product photograph. No people, no logos.`,
  "material-acrylic": `A close-up of the top corner of a thick, glossy, clear-edged acrylic sign: its polished transparent 5 mm edge catches the light with crisp reflections, the face glossy. ${BLANK} Soft daylight, shallow depth of field, photo-real product photograph. No people, no logos.`,
  "stand-easel": `A simple white wooden A-frame display easel holding a portrait-format rectangular sign board, taller than it is wide. ${BLANK} ${ROOM}`,
  "stand-none": `A portrait-format rectangular sign board (taller than wide) with no stand, hung flat on a pale wall above a low white sideboard. ${BLANK} ${ROOM}`,
};

const jobs = Object.entries(JOBS).filter(([id]) => !only || only.split(",").includes(id));
await Promise.all(jobs.map(async ([id, prompt]) => {
  for (let a = 0; a < 3; a++) {
    try {
      const res = await fetch("https://fal.run/fal-ai/flux-2/flash", { method: "POST", headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, image_size: "landscape_4_3", num_images: 1, output_format: "jpeg", seed: 4242 + a * 7 }), signal: AbortSignal.timeout(120_000) });
      const j = await res.json();
      if (!res.ok) { console.log(id, "HTTP", res.status, JSON.stringify(j).slice(0, 300)); if (res.status === 429) { await new Promise((r) => setTimeout(r, 8000)); continue; } return; }
      fs.writeFileSync(path.join(out, `${id}.jpg`), Buffer.from(await (await fetch(j.images[0].url)).arrayBuffer()));
      console.log("ok", id); return;
    } catch (e) { console.log(id, "retry", e.message); await new Promise((r) => setTimeout(r, 4000)); }
  }
}));
