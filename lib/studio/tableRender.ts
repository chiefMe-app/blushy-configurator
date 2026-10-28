// The real render of the kids' table (F3). Since 2026-10-28 it is one
// close-up of a place setting, made from the option pictures the customer
// chose ("3 render çok fazla zaman alıyor ve pahalıya geliyor … sadece
// illüstrasyon olsun masa düzeni ve bir tane close up render … sadece
// opsiyonlardaki görselleri kullanalım"): the layout is only ever the live
// drawings. Every choice is also described in words. Shared by the API route
// (the pictures and the prompt) and the builder (is the render still current?).
import { hexToColorName } from "@/lib/generatePrompt";
import { NONE, onFloor, tableOption, type TableItemKey } from "./tableCatalog";
import type { TableScene, TableSetup } from "./tableSetup";
import { clampKids } from "./tableSetup";

export type { TableRender } from "./tableSetup";

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
  table: { standard: "a long white rectangular kids' table", half_wave: "a white kids' table curved like a gentle S-shaped wave", flower: "a white kids' table shaped like a flower with six round petals", round: "a big white round kids' table", low: "a low white floor table, with white floor cushions instead of chairs", cloud: "a white kids' table with soft wavy cloud-shaped edges" },
  chairs: { white_kids: "a white children's chair with an oval back and arms", blue_kids: "a bright blue children's chair with a slatted back", bow_kids: "a pink metal children's chair with a round mesh seat and a back shaped like a bow" },
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

// The look every view shares (2026-10-27: "daha cool, daha eğlenceli, daha
// kaliteli" — and the owner's reference shots: long lenses, soft background
// blur, outdoors in sunlight). Then (same day): "çocuk doğum günü olduğu
// belli olsun … daha cıvıl cıvıl": a kids' party, not a dinner.
const STYLE = "Bright, cheerful photograph of a real children's birthday party table, styled by a party planner: playful and colourful, everything at the seats is fun disposable kids' party tableware — printed paper and plastic, party hats and confetti — nothing formal, no glassware, no china, no charger plates. Crisp fine detail, shot on a full-frame camera with a shallow depth of field. No people, no children, no cartoon characters, no faces, no text, no letters, no logos.";
const SETTING: Record<TableScene, string> = {
  garden: "The party is outdoors in a sunny garden: the table stands on a pale stone terrace, with a green lawn and trees softly blurred behind, in warm late-afternoon sunlight with soft dappled shadows.",
  indoor: "The party is in a bright, airy party room with tall windows and soft daylight, the room softly decorated in the same colours and out of focus.",
};
const LENS = "Shot with a 50mm lens at f/1.8 from a high three-quarter angle just above one place setting: that seat is sharp and fills most of the picture, the rest of the table and the setting fall into soft blur behind.";

// What each picture shows, in the prompt ("image 2 is the table").
const LABEL: Record<TableItemKey, string> = {
  table: "the table", chairs: "the chair", tablecloth: "the tablecloth", runner: "the runner", napkins: "the napkin",
  placemats: "the placemat", plates: "the plate", cups: "the cup", cutlery: "the cutlery", chargers: "the charger plate",
  centrepiece: "the centrepiece", chairDecor: "the chair decoration", nameCards: "the name card", partyHats: "the party hat",
};
// The pictures sent with the prompt, most telling first: Seedream takes ten.
const REFERENCE_ORDER: TableItemKey[] = ["chairs", "table", "plates", "cups", "placemats", "cutlery", "napkins", "tablecloth", "partyHats", "centrepiece", "nameCards", "runner", "chairDecor"];
export const MAX_REFERENCES = 10;

/** The chosen options' pictures for the render, in the order the prompt names them. */
export function referencePictures(t: TableSetup): { key: TableItemKey; photo: string }[] {
  const floor = onFloor(t.choices); // the low table: cushions, no chair to show
  return REFERENCE_ORDER.filter((k) => !(floor && (k === "chairs" || k === "chairDecor")))
    .flatMap((k) => { const photo = tableOption(k, t.choices[k])?.photo; return photo ? [{ key: k, photo }] : []; })
    .slice(0, MAX_REFERENCES);
}

/** The words for the close-up; `pictures` are the items whose pictures go with it, in order (referencePictures). */
export function tablePrompt(t: TableSetup, theme: { id: string; name: string; balloonColors: string[] }, pictures: TableItemKey[]): string {
  const c = t.choices;
  const floor = onFloor(c);
  const word = (k: TableItemKey) => (c[k] === NONE || (floor && (k === "chairs" || k === "chairDecor")) ? "" : (WORDS[k]?.[c[k]] ?? "")
    .replace("{cloth}", hexToColorName(t.clothColor)).replace("{runner}", hexToColorName(t.runnerColor)).replace("{napkin}", hexToColorName(t.napkinColor))
    .replace("{motif}", motifOf(theme.id)));
  const colours = Array.from(new Set(theme.balloonColors.map(hexToColorName).filter(Boolean))).join(", ");
  // One paper plate a seat: Seedream stacks plates like china otherwise (2026-10-27).
  const seat = ["placemats", "plates", "chargers", "napkins", "cups", "cutlery", "nameCards", "partyHats"].map((k) => word(k as TableItemKey)).filter(Boolean).join(", ");
  const lines = [
    pictures.length ? `Images 1 to ${pictures.length} are product photos of the exact pieces chosen for this children's party table: ${pictures.map((k, i) => `image ${i + 1} is ${LABEL[k]}`).join(", ")}.` : "",
    pictures.length ? "Take only the piece itself from each photo and ignore everything around it — the grass, walls, backdrops, other furniture and other tableware in those photos." : "",
    `Make a close-up photograph of ONE place setting at this table: ${floor ? "a white floor cushion in front of the low table" : "the chair pulled up to the table"}, and on the table in front of it ${seat} — one single plate, not a stack — with ${word("centrepiece") || "the rest of the table"} softly out of focus behind.`,
    pictures.length ? `Every piece must look exactly like its photo: the same shape, colour and material. Printed paper pieces are printed with ${motifOf(theme.id)} in the palette colours.` : "",
    `The table is ${word("table")}, with ${word("tablecloth")}${word("runner") ? ` and ${word("runner")}` : ""}.`,
    floor ? "" : `The chair is ${word("chairs")}${word("chairDecor") ? `, with ${word("chairDecor")}` : ""}.`,
    `Colour palette: ${colours}. ${clampKids(t.kids)} children's places in all; this picture shows one of them.`,
  ];
  return [...lines, LENS, SETTING[t.scene ?? "garden"], STYLE].filter(Boolean).join(" ");
}
