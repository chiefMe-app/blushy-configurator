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

// What each option looks like, in words.
const WORDS: Partial<Record<TableItemKey, Record<string, string>>> = {
  chairs: { white_kids: "small white children's chairs", gold_chiavari: "small gold chiavari chairs with white seat cushions", clear_ghost: "small clear transparent acrylic chairs with plain oval backs" },
  tablecloth: { classic: "a smooth floor-length {cloth} tablecloth", ruffle: "a {cloth} tablecloth with layered ruffled frills all the way round to the floor", sequin: "a shimmering {cloth} sequin tablecloth to the floor" },
  runner: { tulle: "a soft airy {runner} tulle runner down the middle", sequin: "a shimmering {runner} sequin runner down the middle", greenery: "a fresh eucalyptus greenery garland down the middle" },
  napkins: { folded: "a neatly folded {napkin} cotton napkin", printed: "a {napkin} printed paper napkin", bow: "a {napkin} napkin tied with a satin ribbon bow" },
  plates: { themed: "a plate in the theme's colours", white_gold: "a white plate with a thin gold rim", pastel: "a pastel melamine plate" },
  cups: { straw: "a paper cup with a striped straw", gold_rim: "a clear cup with a gold rim", lidded: "a pastel cup with a little clear lid" },
  cutlery: { wooden: "wooden cutlery", gold: "gold cutlery", pastel: "pastel cutlery" },
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
  const row = (kids: number, n: number) => `${n === 2 ? "two long rectangular tables joined end to end into one long table" : "one long rectangular table"}, with exactly ${Math.ceil(kids / 2)} chairs along ${far} and ${Math.floor(kids / 2)} along ${near} (count them), no chairs at the ends, and one straight runner along its length`;
  return rows.length === 1 ? row(rows[0], perTable.length)
    : `${rows.length} parallel rows: ${rows.map((k, i) => `row ${i + 1} is ${row(k, Math.min(2, perTable.length - i * 2))}`).join("; ")}`;
}

// The look every view shares (2026-10-27: "daha cool, daha eğlenceli, daha
// kaliteli" — and the owner's reference shots: long lenses, soft background
// blur, outdoors in sunlight).
const STYLE = "High-end editorial photograph for a children's party magazine: joyful, magical and fun, airy, soft vivid colours, crisp fine detail, shot on a full-frame camera with a shallow depth of field. No people, no children, no cartoon characters, no faces, no text, no letters, no logos.";
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
export function tablePrompt(t: TableSetup, theme: { name: string; balloonColors: string[] }, view: TableView): string {
  const c = t.choices;
  const word = (k: TableItemKey) => (c[k] === NONE ? "" : (WORDS[k]?.[c[k]] ?? "")
    .replace("{cloth}", hexToColorName(t.clothColor)).replace("{runner}", hexToColorName(t.runnerColor)).replace("{napkin}", hexToColorName(t.napkinColor)));
  const kids = clampKids(t.kids);
  const colours = Array.from(new Set(theme.balloonColors.map(hexToColorName).filter(Boolean))).join(", ");
  const seat = ["plates", "chargers", "napkins", "cups", "cutlery", "nameCards", "partyHats"].map((k) => word(k as TableItemKey)).filter(Boolean).join(", ");
  const choices = [
    `Colour palette: ${colours}.`,
    `Every table has ${word("tablecloth")}${word("runner") ? ` and ${word("runner")}` : ""}.`,
    `The chairs are ${word("chairs")}${word("chairDecor") ? `, with ${word("chairDecor")}` : ""}.`,
    `At every seat: ${seat}.`,
    word("centrepiece") ? `In the middle of each table: ${word("centrepiece")}.` : "",
  ];
  const layout = `${seatingWords(t, view)} — ${kids} chairs in all, tucked in at the table, with one place setting on the table in front of every chair, nothing added or moved`;
  // Seedream likes to stretch a long table and add seats (2026-10-27 test: 6–7
  // a side for 5). The front view may (the owner chose its look, "A olsun");
  // the top view is the exact layout.
  const count = `Count before you finish: exactly ${kids} chairs and ${kids} place settings in the whole picture, no more. The table is only as long as the drawing shows; do not extend it.`;
  const lines = view === "perspective" ? [
    "Turn this simple line drawing into a photograph of a children's birthday party table setup. The drawing is only a rough layout: photograph it as a real camera would see it.",
    `Keep the layout as drawn: ${layout}.`,
    ...choices,
  ] : view === "top" ? [
    "Image 1 is the exact layout, seen straight down from directly above. Image 2 is a photo of this very party table.",
    `Make a photograph of the table from directly above (a flat top-down view), laid out exactly as image 1: ${layout}.`,
    count,
    "Everything must look exactly as in image 2: the same chairs, tablecloth, runner, plates, napkins, cups, cutlery, name cards, hats, chair decorations and centrepieces, in the same colours and materials, and the same surroundings and light.",
  ] : [
    "Image 1 is a photo of a children's party table.",
    "Make a close-up photograph of ONE place setting at this very table: the plate with everything on and around it, the cup, the cutlery, the name card and the hat, with a centrepiece and the runner softly out of focus.",
    "Everything must look exactly as in image 1: the same plate, napkin, cup, cutlery, name card, hat, charger, chair and decorations, in the same colours and materials, and the same surroundings and light.",
    `At this seat: ${seat}.`,
  ];
  return [...lines, LENS[view], SETTING[t.scene ?? "garden"], STYLE].filter(Boolean).join(" ");
}
