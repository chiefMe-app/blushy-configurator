// A theme's own art (2026-11-01, the owner: "diğer temaları da yapalım … deneme
// yap, ürettiğin standeeleri beğenmezsem ben yüklerim"): its standees, its
// banner print and its table cutouts, each made once, in the style of the
// owner's example drawings (scripts/themes/refs/<theme>-*.webp). Every piece is
// drawn alone on chroma green; scripts/themes/theme-art-prepare.ts cuts it out.
// Paid (Seedream, $0.035 a piece): run only with the owner's approval.
// node scripts/themes/theme-art.mjs <projectDir> <outDir> <theme> [name,name…]
import fs from "node:fs"; import path from "node:path";
import sharp from "sharp";
const [dir, out, theme, only] = process.argv.slice(2);
const projectDir = path.resolve(dir);
const env = fs.readFileSync(path.join(projectDir, ".env.local"), "utf8");
const key = (env.match(/^FAL_KEY\s*=\s*"?([^"\r\n]+)"?/m) || [])[1];
const img = async (f) => `data:image/jpeg;base64,${(await sharp(path.join(projectDir, f)).resize(1024, 1024, { fit: "inside" }).flatten({ background: "#fff" }).jpeg({ quality: 88 }).toBuffer()).toString("base64")}`;
const GREEN = "alone on a perfectly flat, even, pure chroma-key green background (#00B140), filling most of the picture with a margin all round — no shadow on the green, no ground, no scenery, no confetti, no sparkles, nothing else at all";
const STANDEE = `A brand-new illustration of one character for a life-size party standee (a cut-out board), drawn in exactly the hand-drawn style of the example drawings: the same soft coloured-pencil and crayon texture, watercolour washes, the same gentle pastel colours, the same cute rounded shapes and sleepy smiling eyes. Not a copy of either example: a new pose. The whole figure from head to toe, ${GREEN}. No words, no letters, no logos.`;
// 2026-11-03 (the owner: "add graphic çalışmıyor"): a theme graphic is a print on the board's face — one motif
// per preset (lib/themeCatalog.ts graphicPresets, graphic-0N is <theme>-0N), cut out so the board shows round it.
const GRAPHIC = `A brand-new illustration for a printed decal on the face of a white party backdrop board, drawn in exactly the hand-drawn style of the example drawings: the same soft coloured-pencil and crayon texture, watercolour washes and gentle colours. One single composed motif, ${GREEN}. No words, no letters, no logos.`;
const THEMES = {
  // Frozen in the Unicorn drawings' style: generic ice and snow, no film character's likeness.
  frozen: {
    style: ["scripts/themes/refs/unicorn-watercolour.webp", "scripts/themes/refs/unicorn-crayon.webp"],
    pieces: {
      "graphic-01": ["graphic", "A sparkling fairytale ice palace of pale icy-blue and white crystal towers with pointed spires, on a little snowy hill, with delicate snowflakes floating round it, in icy blue, lilac, white and silver."],
      "graphic-02": ["graphic", "Two little princesses side by side holding hands, seen as soft pale icy-blue silhouettes in long flowing gowns with small tiaras, framed by a ring of delicate snowflakes in icy blue, lilac and silver; plain silhouettes with no faces drawn, not any film's characters."],
      "graphic-03": ["graphic", "A round cluster of delicate snowflakes and ice crystals of different sizes, in icy blue, lilac, white and a touch of silver glitter, arranged as a soft wreath-like motif."],
    },
  },
  unicorn: {
    style: ["scripts/themes/refs/unicorn-crayon.webp", "scripts/themes/refs/unicorn-watercolour.webp"],
    pieces: {
      "standee-rearing": ["standee", "A white unicorn rearing up joyfully on its back legs, front legs raised, head up, with a long flowing mane and tail in pastel pink, lilac, sky blue and buttery yellow, a gold spiral horn, gold hooves, rosy cheeks and a few small pastel stars on its body. Tall, upright pose."],
      "standee-rainbow": ["standee", "A white unicorn standing proudly on all four legs, facing left, under a small pastel rainbow that arcs from a fluffy white cloud at its feet up over its back, with a pastel pink, lilac and blue mane and tail, a gold horn and hooves, rosy cheeks. The unicorn, the rainbow and the cloud joined as one shape."],
      "standee-baby": ["standee", "A small, chubby baby unicorn sitting up, smiling with closed sleepy eyes, wearing a crown of little pastel flowers, a short striped pastel horn, a fluffy pink, lilac and blue mane and tail, holding a single heart-shaped pink balloon on a string."],
      "print": ["print", "A square printed backdrop artwork for a children's unicorn birthday party, in the soft watercolour style of the example drawings: a dreamy pastel sky washed in blush pink, lilac and pale sky blue, a big soft pastel rainbow arcing across it, fluffy white clouds, little gold stars and sparkles scattered all over, gentle rolling hills with tiny pastel flowers along the bottom, and a white unicorn with a pastel mane and a gold horn prancing on the hills at the lower left. The upper middle stays calm, light sky (lettering will be printed there). The artwork fills the whole square edge to edge: no border, no frame, no words, no letters, no logos."],
      "graphic-01": ["graphic", "The head and neck of a white unicorn in profile facing right, with a gold spiral horn, a crown of little pastel pink, lilac and yellow flowers, a flowing pastel pink, lilac and sky-blue mane, closed sleepy eyes with long lashes and rosy cheeks."],
      "graphic-02": ["graphic", "A whole white unicorn prancing to the right with one front leg raised, a flowing rainbow mane and tail in pastel pink, lilac, sky blue, mint and buttery yellow, a gold horn and gold hooves, a few small gold stars round it."],
      "graphic-03": ["graphic", "A soft pastel rainbow arcing between two fluffy white clouds, with small gold glitter stars and sparkles round it, in pastel pink, buttery yellow, mint, sky blue and lilac."],
      "table-cutouts": ["flat", "A little group of three small party cutouts for a children's table, in the pastel unicorn theme of the example drawings: thick white card shapes printed in soft pastel pink, lilac, sky blue and buttery yellow with a touch of gold glitter — a small unicorn head with a gold horn in the middle, a little rainbow with a cloud on one side and a star on the other — lying flat side by side, close together, printed faces up, seen from directly above — no stands, no bases, no sticks. No words, no logos. Alone on a perfectly flat, even, pure chroma-key green background (#00B140), no shadow on the green."],
    },
  },
};
const t = THEMES[theme];
if (!t) throw new Error(`no art for ${theme}`);
const style = await Promise.all(t.style.map(img));
const pick = Object.entries(t.pieces).filter(([n]) => !only || only.split(",").includes(n));
await Promise.all(pick.map(async ([name, [kind, what]]) => {
  const prompt = `Images 1 and 2 are the example drawings, for their style only. ${kind === "standee" ? `${STANDEE} ${what}` : kind === "graphic" ? `${GRAPHIC} ${what}` : what}`;
  const size = kind === "standee" ? { width: 1536, height: 2048 } : kind === "print" || kind === "graphic" ? { width: 2048, height: 2048 } : "square_hd";
  for (let a = 0; a < 3; a++) {
    try {
      const res = await fetch("https://fal.run/fal-ai/bytedance/seedream/v5/lite/edit", { method: "POST", headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, image_urls: style, num_images: 1, output_format: "png", image_size: size }), signal: AbortSignal.timeout(170_000) });
      const j = await res.json();
      if (!res.ok) { console.log(name, "HTTP", res.status, JSON.stringify(j).slice(0, 200)); return; }
      fs.writeFileSync(path.join(out, `${theme}-${name}.png`), Buffer.from(await (await fetch(j.images[0].url)).arrayBuffer()));
      console.log("ok", name); return;
    } catch (e) { console.log(name, "retry", e.message); await new Promise((r) => setTimeout(r, 4000)); }
  }
}));
