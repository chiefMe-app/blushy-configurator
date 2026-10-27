// The real render of the kids' table (2026-10-27, F3: "seçimlerden sonra son
// halini render alalım … top view ve perspective view, gerçek render"). Two
// pictures, made on request from the live drawings (TablePerspective and
// TableSketch) as layout guides; every choice is described in words. Shared by
// the API route (the prompt) and the builder (is the render still current?).
import { hexToColorName } from "@/lib/generatePrompt";
import { NONE, type TableItemKey } from "./tableCatalog";
import { clampKids, tableCounts, type TableScene, type TableSetup } from "./tableSetup";

export type { TableRender } from "./tableSetup";

export type TableView = "perspective" | "top" | "close";

/** Changes whenever anything that shows in the picture changes. */
export function tableRenderKey(t: TableSetup): string {
  const s = JSON.stringify([clampKids(t.kids), Object.entries(t.choices).sort(), t.clothColor, t.runnerColor, t.napkinColor, t.scene ?? "garden"].flat(2));
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

// The pattern printed on the kids' party paper (cover, placemats, plates,
// cups, napkins): the theme's motifs, never its characters (2026-10-27: the
// owner's references are printed character tableware; a render must not draw
// licensed characters).
const MOTIF: Record<string, string> = {
  frozen: "snowflakes and little stars", unicorn: "rainbows, clouds and stars", dinosaur: "dinosaur footprints and leaves", safari: "palm leaves and animal-print spots",
  princess: "crowns, hearts and stars", superhero: "comic bursts, stars and lightning bolts", barbie: "hearts, stars and bows", bluey: "clouds and paw prints",
  pokemon: "lightning bolts and stars", stitch: "hibiscus flowers and palm leaves", mermaid: "seashells, scales and bubbles", space: "planets, rockets and stars",
  football: "footballs and stars", lego: "colourful building blocks and dots", kpop: "hearts, stars and music notes", encanto: "flowers and butterflies",
  cocomelon: "watermelons and little fruits", teddy_bear: "hearts and paw prints", pineapple_tropical: "pineapples and palm leaves", blush_garden: "little flowers",
  minecraft: "pixel squares", star_wars: "stars and planets", luxury_neutral: "gold dots and stars",
};
export const motifOf = (themeId: string) => MOTIF[themeId] ?? "confetti dots and stars";

// What each option looks like, in words. {motif} is the theme's printed pattern.
const WORDS: Partial<Record<TableItemKey, Record<string, string>>> = {
  chairs: { white_kids: "small white children's chairs", pastel_kids: "small children's chairs painted in mixed pastel colours from the palette", clear_ghost: "small clear transparent acrylic chairs with plain oval backs" },
  tablecloth: { printed: "a disposable party table cover printed all over with {motif} in the palette colours, hanging over the edges", classic: "a smooth floor-length {cloth} tablecloth", ruffle: "a {cloth} tablecloth with layered ruffled frills all the way round to the floor" },
  runner: { tulle: "a soft airy {runner} tulle runner down the middle", sequin: "a shimmering {runner} sequin runner down the middle", confetti: "colourful confetti, little paper stars and shiny curly ribbons scattered down the middle" },
  placemats: { printed: "a rectangular paper placemat printed with {motif}", shaped: "a paper placemat cut in the shape of one of the {motif}", name: "a printed paper placemat with a border of {motif} and a blank panel for a name" },
  napkins: { printed: "a paper napkin printed with {motif}", plain: "a {napkin} paper napkin folded into a triangle", bow: "a {napkin} napkin tied with a ribbon bow" },
  plates: { themed: "a disposable paper party plate printed with {motif}", scalloped: "a pastel paper party plate with a wavy scalloped edge", shaped: "a paper party plate cut in the shape of one of the {motif}" },
  cups: { straw: "a paper party cup with a striped paper straw", printed: "a paper party cup printed with {motif}", pouch: "a little juice pouch with a straw and a blank label" },
  cutlery: { pastel: "disposable pastel plastic cutlery (plastic, not metal)", wooden: "disposable wooden cutlery", silver: "disposable silver-coloured plastic cutlery" },
  chargers: { gold: "a gold charger plate under the plate", rattan: "a woven rattan charger under the plate", beaded: "a clear beaded glass charger under the plate" },
  centrepiece: { balloons: "a small bunch of mini balloons in the theme colours", florals: "a low arrangement of fresh flowers", toppers: "glittery star and snowflake toppers on sticks in a little pot" },
  chairDecor: { tulle_bow: "a big tulle bow on every chair back", balloon: "a balloon tied to every chair back", name_flag: "a little blank fabric flag on every chair back" },
  nameCards: { tent: "a blank folded tent name card", tag: "a blank round name tag on the napkin", acrylic: "a blank clear acrylic name card" },
  partyHats: { cone: "a cone party hat", crown: "a little party crown", headband: "a party headband" },
};

/** The seating in words, exactly as TableSketch's arrangeTables lays it out. */
export function seatingWords(t: TableSetup, view: TableView = "perspective"): string {
  // The front photo looks down the table from one end, so its sides are left and right.
  const [far, near] = view === "top" ? ["the top side", "the bottom side"] : ["the left side", "the right side"];
  const { perTable, tables } = tableCounts(t);
  const shape = t.choices.table;
  if (shape === "round" || shape === "square") {
    const each = Array.from(new Set(perTable)).sort((a, b) => b - a).join(" or ");
    return `${tables} separate ${shape} kids' table${tables > 1 ? "s" : ""} side by side, with exactly ${each} chairs ${shape === "round" ? "spaced widely and evenly around" : "on the four sides of"} each table (count them), no more`;
  }
  const rows: number[] = [];
  for (let i = 0; i < perTable.length; i += 2) rows.push(perTable[i] + (perTable[i + 1] ?? 0));
  // Joined tables still have one runner (or one line of confetti) down the whole length.
  const middle = t.choices.runner === NONE ? "" : `, and ${t.choices.runner === "confetti" ? "the confetti in one straight line" : "one straight runner"} along its length`;
  const row = (kids: number, n: number) => `${n === 2 ? "two long rectangular tables joined end to end into one long table" : "one long rectangular table"}, with exactly ${Math.ceil(kids / 2)} chairs along ${far} and ${Math.floor(kids / 2)} along ${near} (count them), no chairs at the ends${middle}`;
  return rows.length === 1 ? row(rows[0], perTable.length)
    : `${rows.length} parallel rows: ${rows.map((k, i) => `row ${i + 1} is ${row(k, Math.min(2, perTable.length - i * 2))}`).join("; ")}`;
}

// The look every view shares (2026-10-27: "daha cool, daha eğlenceli, daha
// kaliteli" — and the owner's reference shots: long lenses, soft background
// blur, outdoors in sunlight). Then (same day): "çocuk doğum günü olduğu
// belli olsun … daha cıvıl cıvıl": a kids' party, not a dinner.
const STYLE = "Bright, cheerful photograph of a real children's birthday party table, styled by a party planner: playful and colourful, everything at the seats is fun disposable kids' party tableware — printed paper and plastic, party hats and confetti — nothing formal, no glassware, no china, no charger plates. Crisp fine detail, shot on a full-frame camera with a shallow depth of field. No people, no children, no cartoon characters, no faces, no text, no letters, no logos.";
const SETTING: Record<TableScene, string> = {
  garden: "The party is outdoors in a sunny garden: the table stands on a pale stone terrace, with a green lawn and trees softly blurred behind, in warm late-afternoon sunlight with soft dappled shadows.",
  indoor: "The party is in a bright, airy party room with tall windows and soft daylight, the room softly decorated in the same colours and out of focus.",
};
// The lens for each view, as in the owner's reference photos.
const LENS: Record<TableView, string> = {
  perspective: "Shot with a long 85mm lens at f/2 from one end of the table at standing eye height, looking down the whole length of the table: the chairs line both sides and recede into soft blur, the nearest place settings are sharp.",
  top: "Shot straight down from directly above, like a drone photo, the whole table in the picture.",
  close: "Shot with a 50mm lens at f/1.8 from a high three-quarter angle just above one place setting: that seat is sharp and fills most of the picture, the rest of the table and the setting fall into soft blur behind.",
};

/**
 * The words for each view. The front view comes first, from the drawing; the
 * top view and the close-up are made from that photo (image 2 / image 1), so
 * all three show the very same chairs, tableware and colours.
 */
export function tablePrompt(t: TableSetup, theme: { id: string; name: string; balloonColors: string[] }, view: TableView): string {
  const c = t.choices;
  const word = (k: TableItemKey) => (c[k] === NONE ? "" : (WORDS[k]?.[c[k]] ?? "")
    .replace("{cloth}", hexToColorName(t.clothColor)).replace("{runner}", hexToColorName(t.runnerColor)).replace("{napkin}", hexToColorName(t.napkinColor))
    .replace("{motif}", motifOf(theme.id)));
  const kids = clampKids(t.kids);
  const colours = Array.from(new Set(theme.balloonColors.map(hexToColorName).filter(Boolean))).join(", ");
  // One paper plate a seat: Seedream stacks plates like china otherwise (2026-10-27).
  const seat = ["placemats", "plates", "chargers", "napkins", "cups", "cutlery", "nameCards", "partyHats"].map((k) => word(k as TableItemKey)).filter(Boolean).join(", ");
  const choices = [
    `Colour palette: ${colours}.`,
    `Every table has ${word("tablecloth")}${word("runner") ? ` and ${word("runner")}` : ""}.`,
    `The chairs are ${word("chairs")}${word("chairDecor") ? `, with ${word("chairDecor")}` : ""}.`,
    // "At every seat" put plates on the chairs themselves (2026-10-27 test).
    `On the table in front of every chair (never on the chairs): ${seat} — one single plate, not a stack.`,
    word("centrepiece") ? `In the middle of each table: ${word("centrepiece")}.` : "",
  ];
  const layout = `${seatingWords(t, view)} — ${kids} chairs in all, tucked in at the table, with one place setting on the table in front of every chair, nothing added or moved`;
  // Seedream likes to stretch a long table and add seats (2026-10-27 test: 6–7
  // a side for 5). The front view may (the owner chose its look, "A olsun");
  // the top view is the exact layout.
  const count = `Count before you finish: exactly ${kids} chairs and ${kids} place settings in the whole picture, no more. The table is only as long as the drawing shows; do not extend it.`;
  const lines = view === "perspective" ? [
    "Turn this simple line drawing into a photograph of a children's birthday party table setup. The drawing is only a rough layout: photograph it as a real camera would see it.",
    // 2026-10-27: a round-table render kept the drawing's flat chairs and outlines.
    "Every shape in the drawing becomes a real, solid object; nothing of the drawing itself may remain in the photo — no outlines, no flat cut-out shapes.",
    `Keep the layout as drawn: ${layout}.`,
    ...choices,
  ] : view === "top" ? [
    "Image 1 is the exact layout, seen straight down from directly above. Image 2 is a photo of this very party table.",
    `Make a photograph of the table from directly above (a flat top-down view), laid out exactly as image 1: ${layout}.`,
    count,
    "Everything must look exactly as in image 2: the same chairs, tablecloth, runner, placemats, plates, napkins, cups, cutlery, name cards, hats, chair decorations and centrepieces, in the same colours, prints and materials, and the same surroundings and light.",
  ] : [
    "Image 1 is a photo of a children's party table.",
    "Make a close-up photograph of ONE place setting at this very table: the placemat and the plate with everything on and around it, the cup, the cutlery, the name card and the hat, with a centrepiece and the runner softly out of focus.",
    "Everything must look exactly as in image 1: the same placemat, plate, napkin, cup, cutlery, name card, hat, chair and decorations, in the same colours, prints and materials, and the same surroundings and light.",
    `At this seat: ${seat}.`,
  ];
  return [...lines, LENS[view], SETTING[t.scene ?? "garden"], STYLE].filter(Boolean).join(" ");
}
