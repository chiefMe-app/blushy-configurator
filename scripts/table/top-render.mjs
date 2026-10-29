// The top view's pieces (2026-10-29, the owner approved rendering every option
// once: "Ok suggestionını uygula", then "İyi gözüküyor"): each one alone,
// straight down, on chroma green; scripts/table/top-prepare.ts cuts them out.
// Paid (Seedream, $0.035 a piece): run only with the owner's approval.
// node scripts/table/top-render.mjs <projectDir> <outDir> [name,name…]
import fs from "node:fs"; import path from "node:path";
import sharp from "sharp";
const [projectDir, out, only] = process.argv.slice(2);
const env = fs.readFileSync(path.join(projectDir, ".env.local"), "utf8");
const key = (env.match(/^FAL_KEY\s*=\s*"?([^"\r\n]+)"?/m) || [])[1];
const photo = async (f) => `data:image/jpeg;base64,${(await sharp(path.join(projectDir, "public/design/table", f)).resize(768, 768, { fit: "inside" }).flatten({ background: "#fff" }).jpeg({ quality: 88 }).toBuffer()).toString("base64")}`;
const green = `data:image/jpeg;base64,${(await sharp({ create: { width: 768, height: 576, channels: 3, background: "#00B140" } }).jpeg().toBuffer()).toString("base64")}`;
const STAGE = "Shot looking straight down from directly above (a flat lay, top view, the camera square to the table), the piece centred with plenty of space round it, alone on a perfectly flat, even, pure chroma-key green background (#00B140) — no shadow on the green, no texture, no props, no other objects, no hands. Soft, bright, even daylight. Photo-real product photograph, crisp fine detail.";
const P = [
  ["plates-plain-round", null, "A big round plain matte white paper party plate, about 23 cm across, with a smaller round plain matte white paper plate, about 18 cm across, sitting exactly in its centre; both empty, nothing on them."],
  ["pocket", null, "One plain matte white paper napkin folded into a flat, tall, narrow rectangular cutlery pocket, about 8 cm wide and 20 cm long, lying flat, its open pocket edge straight across the top. Empty: no cutlery, no band."],
  ["cutlery-wooden", "cutlery-wooden.webp", "The disposable wooden fork, knife and spoon of image 2, natural light birch wood: lying flat side by side, parallel and upright in the picture, handles at the bottom, heads at the top, a small gap between them. Only the cutlery: nothing else from image 2."],
  ["tag", null, "One small blank white paper name tag with a scalloped edge, about 5 cm wide and 3.5 cm tall, lying flat. Nothing written or printed on it."],
  ["bottle", null, "One small clear plastic water bottle (330 ml) full of water, lying flat on its side, pointing straight up the picture with its cap at the top, with a blank plain matte white paper label wrapped round its middle — nothing printed on the label."],
  ["hat-cone", "partyHats-cone.webp", "The cone party hat of image 2, but made of plain matte white card with a white fluffy pom-pom on its tip and no print: lying on its side, its tip pointing up and to the left."],
  ["chair-white_kids", "chairs-white_kids.webp", "The white children's chair of image 2, seen from directly above: its back and arms at the bottom of the picture, the front edge of its seat at the top. Only the chair."],
  ["centrepiece-florals", "centrepiece-florals.webp", "The small, low flower arrangement of image 2 — pastel pink and cream roses, lilac flowers, tiny white blooms and leaves — seen from directly above as a round posy. No vase, no box, no foam showing."],
  ["plates-plain-scalloped", null, "A big plain matte white paper party plate, about 23 cm across, round with a wavy scalloped edge, with a smaller plate of exactly the same kind, about 18 cm across, sitting exactly in its centre; both empty, nothing on them."],
  ["plates-plain-square", null, "A big plain matte white square paper party plate with softly rounded corners, about 23 cm across, with a smaller plate of exactly the same kind, about 18 cm across, sitting exactly in its centre, square to it; both empty, nothing on them."],
  ["plates-iridescent", "plates-iridescent.webp", "Two of the plates of image 2 — a big one, about 23 cm across, with a smaller one, about 18 cm across, sitting exactly in its centre — with their shimmering iridescent pink, lilac and blue foil finish; both empty."],
  ["plates-silver", "plates-silver.webp", "Two of the silver foil plates of image 2 — a big one, about 23 cm across, with a smaller one, about 18 cm across, sitting exactly in its centre — round, with a fluted rim; both empty."],
  ["cup-plain", null, "One paper party cup standing upright, seen from above and a little in front so you see into it and also its outside: its inside is plain matte white, and its whole outside is printed solid pure blue (#0000FF) with no pattern. Empty, no straw, no lid."],
  ["cup-iridescent", "cups-iridescent.webp", "One cup like the one of image 2, with its shimmering iridescent foil finish, standing upright, seen from above and a little in front so you see into it and also its outside. Empty, no straw, no lid."],
  ["cutlery-dipped", "cutlery-dipped.webp", "A disposable wooden fork, knife and spoon whose handle ends are dipped in pastel pink, like image 2: lying flat side by side, parallel and upright in the picture, handles at the bottom, heads at the top, a small gap between them."],
  ["cutlery-glitter", "cutlery-glitter.webp", "A disposable wooden fork, knife and spoon whose handle ends are dipped in silver glitter, like image 2: lying flat side by side, parallel and upright in the picture, handles at the bottom, heads at the top, a small gap between them."],
  ["centrepiece-balloons", "centrepiece-balloons.webp", "The small bunch of mini balloons of image 2, seen from directly above, the balloons clustered close together. Only the balloons."],
  ["centrepiece-toppers", "centrepiece-toppers.webp", "The little pot of glittery star toppers on sticks of image 2, seen from directly above. Only the pot and its toppers."],
  ["chair-blue_kids", "chairs-blue_kids.webp", "The children's chair of image 2, but in plain matte white, seen from directly above: its slatted back at the bottom of the picture, the front edge of its seat at the top. Only the chair."],
  ["chair-bow_kids", "chairs-bow_kids.webp", "The pink children's chair with the bow-shaped back of image 2, seen from directly above: its back at the bottom of the picture, the front edge of its round seat at the top. Only the chair."],
  ["cushion", null, "One soft square white floor cushion for a child, about 40 cm across, with gently rounded corners and a soft linen cover, lying flat."],
  // 2026-10-29 (owner): "themed centerpiece, standing themed cutouts … aralarda" — theme shapes only, never characters.
  ["centrepiece-cutouts-frozen", "placemats/frozen/pattern.webp", "A little group of three small standing party cutouts for a children's table, in the wintry snowflake theme of image 2: thick white card shapes printed in soft icy blue, lilac and white with a touch of silver glitter — a big snowflake in the middle, a small ice-castle silhouette on one side and a star on the other — each standing upright on a small clear acrylic base, close together. Seen from above and a little in front, about 45 degrees down, so their printed faces show. No characters, no people, no faces, no words, no logos."],
];
// The floor round the table (2026-10-29, the owner: "maybe we can do grass the floor"): a photo, not a cut-out piece.
const FLOORS = {
  "floor-grass": "Replace image 1 entirely with a photograph of a neat, healthy, freshly mown green garden lawn seen from straight above, filling the whole picture edge to edge: short even grass blades, natural slight variation of green, soft even daylight, no shadows of objects, no flowers, no paths, no objects, no edges. Photo-real, crisp fine detail, as seen from about one metre up.",
};
const pick = only ? P.filter((p) => only.split(",").includes(p[0])) : P;
for (const [name, what] of Object.entries(FLOORS)) if (only?.split(",").includes(name)) pick.push([name, null, what, true]);
await Promise.all(pick.map(async ([name, ref, what, floor]) => {
  const images = [green, ...(ref ? [await photo(ref)] : [])];
  const prompt = floor ? what : `${ref ? "Image 2 is a product photo of the exact piece. " : ""}Image 1 is only the green background to use. ${what} ${STAGE}`;
  for (let a = 0; a < 3; a++) {
    try {
      const res = await fetch("https://fal.run/fal-ai/bytedance/seedream/v5/lite/edit", { method: "POST", headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, image_urls: images, num_images: 1, output_format: "png", image_size: "square_hd" }), signal: AbortSignal.timeout(170_000) });
      const j = await res.json();
      if (!res.ok) { console.log(name, "HTTP", res.status, JSON.stringify(j).slice(0, 200)); return; }
      fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(await (await fetch(j.images[0].url)).arrayBuffer()));
      console.log("ok", name); return;
    } catch (e) { console.log(name, "retry", e.message); await new Promise((r) => setTimeout(r, 4000)); }
  }
}));
