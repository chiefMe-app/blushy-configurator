// The real render of the kids' table (2026-10-27, F3: "seçimlerden sonra son
// halini render alalım … top view ve perspective view, gerçek render"). Two
// pictures, made on request from the live drawings (TablePerspective and
// TableSketch) as layout guides; every choice is described in words. Shared by
// the API route (the prompt) and the builder (is the render still current?).
import { hexToColorName } from "@/lib/generatePrompt";
import { NONE, type TableItemKey } from "./tableCatalog";
import { clampKids, tableCounts, type TableSetup } from "./tableSetup";

export type { TableRender } from "./tableSetup";

export type TableView = "perspective" | "top";

/** Changes whenever anything that shows in the picture changes. */
export function tableRenderKey(t: TableSetup): string {
  const s = JSON.stringify([clampKids(t.kids), Object.entries(t.choices).sort(), t.clothColor, t.runnerColor, t.napkinColor].flat(2));
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
  favourBoxes: { box: "a little gift box with a bow", bag: "a clear treat bag of sweets", bucket: "a mini bucket of surprises" },
  partyHats: { cone: "a cone party hat", crown: "a little party crown", headband: "a party headband" },
};

/** The seating in words, exactly as TableSketch's arrangeTables lays it out. */
export function seatingWords(t: TableSetup, view: TableView = "perspective"): string {
  const [far, near] = view === "top" ? ["the top side", "the bottom side"] : ["the far side", "the near side"];
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

export function tablePrompt(t: TableSetup, theme: { name: string; balloonColors: string[] }, view: TableView): string {
  const c = t.choices;
  const word = (k: TableItemKey) => (c[k] === NONE ? "" : (WORDS[k]?.[c[k]] ?? "")
    .replace("{cloth}", hexToColorName(t.clothColor)).replace("{runner}", hexToColorName(t.runnerColor)).replace("{napkin}", hexToColorName(t.napkinColor)));
  const kids = clampKids(t.kids);
  const colours = Array.from(new Set(theme.balloonColors.map(hexToColorName).filter(Boolean))).join(", ");
  const seat = ["plates", "chargers", "napkins", "cups", "cutlery", "nameCards", "partyHats", "favourBoxes"].map((k) => word(k as TableItemKey)).filter(Boolean).join(", ");
  const camera = view === "top"
    ? "Seen straight down from directly above (a flat top-down view), exactly as the drawing shows."
    : "Seen from the front at a gentle three-quarter angle, slightly from above, exactly as the drawing shows.";
  return [
    "Turn this simple line drawing into a realistic, high-quality photograph of a children's birthday party table setup in a bright, elegant party room.",
    `Keep the layout exactly as drawn: ${seatingWords(t, view)} — ${kids} chairs in all, one place setting in front of every chair, nothing added or moved. ${camera}`,
    `Colour palette: ${colours}.`,
    `Every table has ${word("tablecloth")}${word("runner") ? ` and ${word("runner")}` : ""}.`,
    `The chairs are ${word("chairs")}${word("chairDecor") ? `, with ${word("chairDecor")}` : ""}.`,
    `At every seat: ${seat}.`,
    word("centrepiece") ? `In the middle of each table: ${word("centrepiece")}.` : "",
    "Photorealistic styled event photography, soft natural daylight, fine detail, everything neat and symmetrical. No people, no children, no cartoon characters, no faces, no text, no letters, no logos.",
  ].filter(Boolean).join(" ");
}
