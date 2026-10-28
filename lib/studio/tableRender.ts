// The real render of the kids' table (F3). Since 2026-10-28 it is one
// close-up of a place setting, made from the option pictures the customer
// chose ("3 render çok fazla zaman alıyor ve pahalıya geliyor … sadece
// illüstrasyon olsun masa düzeni ve bir tane close up render … sadece
// opsiyonlardaki görselleri kullanalım"): the layout is only ever the live
// drawings. Every choice is also described in words. Shared by the API route
// (the pictures and the prompt) and the builder (is the render still current?).
import { hexToColorName } from "@/lib/generatePrompt";
import { NONE, onFloor, optionPhoto, tableOption, type TableItemKey } from "./tableCatalog";
import type { TableScene, TableSetup } from "./tableSetup";
import { clampKids } from "./tableSetup";

export type { TableRender } from "./tableSetup";

/** Changes whenever anything that shows in the picture changes. */
export function tableRenderKey(t: TableSetup): string {
  const s = JSON.stringify([clampKids(t.kids), Object.entries(t.choices).sort(), t.clothColor, t.runnerColor, t.napkinColor, t.scene ?? "garden", t.placematText ?? ""].flat(2));
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
  football: "soccer balls and stars", lego: "colourful building blocks and dots", kpop: "hearts, stars and music notes", encanto: "flowers and butterflies",
  cocomelon: "watermelons and little fruits", teddy_bear: "hearts and paw prints", pineapple_tropical: "pineapples and palm leaves", blush_garden: "little flowers",
  minecraft: "pixel squares", star_wars: "stars and planets", luxury_neutral: "gold dots and stars",
};
export const motifOf = (themeId: string) => MOTIF[themeId] ?? "confetti dots and stars";

// What each option looks like, in words. {motif} is the theme's printed pattern.
// The kids' pieces follow the owner's favourite references (2026-10-28).
const WORDS: Partial<Record<TableItemKey, Record<string, string>>> = {
  table: { standard: "a long white rectangular kids' table with straight edges", half_wave: "a long white kids' table curved like a gentle S-shaped wave", flower: "a white kids' table shaped like a flower with six big round petals", round: "a big white round kids' table", low: "a low white floor table, with white floor cushions instead of chairs", cloud: "a long white kids' table whose edges are soft rounded scallops like a cloud" },
  chairs: { white_kids: "a white children's chair with an oval back and arms", blue_kids: "a bright blue children's chair with a slatted back", bow_kids: "a pink metal children's chair with a round mesh seat and a back shaped like a bow" },
  tablecloth: { classic: "a smooth floor-length {cloth} tablecloth" },
  napkins: { striped: "a folded paper napkin with soft pastel pink and white stripes", printed: "a folded paper napkin printed with {motif}", foil: "a folded pale blue paper napkin with a shiny silver foil print" },
  placemats: { pattern: "an A3 paper placemat printed all over with {motif} on a soft background", watercolour: "an A3 paper placemat with a soft watercolour wash and big {motif} in its corners", sparkle: "an A3 paper placemat with a sparkling glittery background and one elegant emblem" },
  plates: { iridescent: "a many-sided disposable paper plate with a shimmering iridescent pink, lilac and blue foil finish and a white rim", holo_square: "a square disposable plate in shiny silver holographic foil", silver: "a round disposable silver foil plate with a fluted rim" },
  cups: { white_straw: "a plain white paper cup with a slim silver paper straw", iridescent: "a paper cup with a shimmering iridescent foil finish and a white straw", pastel: "a matte pastel paper cup" },
  cutlery: { dipped: "a disposable wooden fork, knife and spoon with handles dipped in pastel pink", wooden: "a disposable natural wooden fork, knife and spoon", glitter: "a disposable wooden fork, knife and spoon with handles dipped in silver glitter" },
  cutleryHolder: { pocket: "standing in a printed paper pocket with a blank name panel", band: "wrapped in a napkin held by a paper band with a little blank name tag", tag: "tied with a thin ribbon and a scalloped paper tag" },
  bottleLabel: { printed: "a small water bottle with a label printed with {motif}", name: "a small water bottle with a pale label with a blank name panel", iridescent: "a small water bottle with a shimmering iridescent label" },
  centrepiece: { balloons: "a small bunch of mini balloons in the theme colours", florals: "a low arrangement of fresh flowers", toppers: "glittery star toppers on sticks in a little pot" },
  partyHats: { cone: "a cone party hat", crown: "a little party crown", headband: "a party headband" },
};

// The look every view shares (2026-10-27: "daha cool, daha eğlenceli, daha
// kaliteli" — and the owner's reference shots: long lenses, soft background
// blur, outdoors in sunlight). Then (same day): "çocuk doğum günü olduğu
// belli olsun … daha cıvıl cıvıl": a kids' party, not a dinner.
const STYLE = "Bright, cheerful photograph of a real children's birthday party table, styled by a party planner: everything at the seat is pretty disposable kids' party tableware — printed paper, foil and wood — nothing formal, no glassware, no china, no charger plates. Crisp fine detail, shot on a full-frame camera with a shallow depth of field. No people, no children, no cartoon characters, no faces, no logos.";
const SETTING: Record<TableScene, string> = {
  garden: "The party is outdoors in a sunny garden: the table stands on a pale stone terrace, with a green lawn and trees softly blurred behind, in warm late-afternoon sunlight with soft dappled shadows.",
  indoor: "The party is in a bright, airy party room with tall windows and soft daylight, the room softly decorated in the same colours and out of focus.",
};
const LENS = "Shot with a 50mm lens at f/2 from a high three-quarter angle above one place setting: that seat is sharp and fills about half of the picture, with the table's edge and the chair around it in view, and the rest of the table falls into soft blur behind.";

// What each picture shows, in the prompt ("image 1 is the table").
const LABEL: Record<TableItemKey, string> = {
  table: "the table", chairs: "the chair", tablecloth: "the tablecloth", runner: "the runner", napkins: "the napkin",
  placemats: "the placemat's printed design", plates: "the plate", cups: "the cup", cutlery: "the cutlery", chargers: "the charger plate",
  cutleryHolder: "the cutlery holder", bottleLabel: "the water bottle",
  centrepiece: "the centrepiece", chairDecor: "the chair decoration", nameCards: "the name card", partyHats: "the party hat",
};
// The pictures sent with the prompt, the table first (2026-10-28: a close-up of
// the cloud table came out on a small round one): Seedream takes ten.
const REFERENCE_ORDER: TableItemKey[] = ["table", "chairs", "placemats", "plates", "cups", "cutlery", "napkins", "cutleryHolder", "bottleLabel", "tablecloth", "centrepiece", "partyHats"];
export const MAX_REFERENCES = 10;

/** The chosen options' pictures for the render, in the order the prompt names them. */
export function referencePictures(t: TableSetup, themeId: string): { key: TableItemKey; photo: string }[] {
  const floor = onFloor(t.choices); // the low table: cushions, no chair to show
  return REFERENCE_ORDER.filter((k) => !(floor && k === "chairs"))
    .flatMap((k) => { const photo = optionPhoto(k, tableOption(k, t.choices[k]), themeId); return photo ? [{ key: k, photo }] : []; })
    .slice(0, MAX_REFERENCES);
}

/**
 * The words for the close-up; `pictures` are the items whose pictures go with
 * it, in order (referencePictures). 2026-10-28, the owner: "birebir aynı
 * setup'ın close-up'ı olması lazım" — exactly the chosen pieces, on exactly
 * the chosen table, and nothing else.
 */
export function tablePrompt(t: TableSetup, theme: { id: string; name: string; balloonColors: string[] }, pictures: TableItemKey[]): string {
  const c = t.choices;
  const floor = onFloor(c);
  const word = (k: TableItemKey) => (c[k] === NONE || (floor && k === "chairs") ? "" : (WORDS[k]?.[c[k]] ?? "")
    .replace("{cloth}", hexToColorName(t.clothColor)).replace("{motif}", motifOf(theme.id)));
  const colours = Array.from(new Set(theme.balloonColors.map(hexToColorName).filter(Boolean))).join(", ");
  const text = c.placemats !== NONE ? t.placematText?.trim() : undefined;
  const placemat = word("placemats") && `${word("placemats")}, lying flat under the plate${text ? `, with the words "${text}" printed on it in large, neat, correctly spelled letters` : ""}`;
  const cutlery = word("cutlery") && `${word("cutlery")}${word("cutleryHolder") ? ` ${word("cutleryHolder")}` : ""}`;
  // One plate a seat: Seedream stacks plates like china otherwise (2026-10-27).
  const seat = [placemat, word("plates") && `${word("plates")} (one single plate, not a stack)`, word("napkins"), cutlery, word("cups"), word("bottleLabel"), word("partyHats")].filter(Boolean);
  const lines = [
    pictures.length ? `Images 1 to ${pictures.length} are product photos of the exact pieces chosen for this children's party table: ${pictures.map((k, i) => `image ${i + 1} is ${LABEL[k]}`).join(", ")}.` : "",
    pictures.length ? "Take only the piece itself from each photo and ignore everything around it — the grass, walls, backdrops, other furniture, flowers and other tableware in those photos." : "",
    `Make a close-up photograph of ONE place setting at this very table: ${word("table")}${pictures.includes("table") ? " — exactly the table in its photo, with the same shape, edges, colour and legs" : ""}. The part of the table around this seat shows clearly, so its shape can be recognised.`,
    floor ? "In front of the seat is a white floor cushion." : `The chair is ${word("chairs")}${pictures.includes("chairs") ? ", exactly as in its photo" : ""}, pulled up to the table.`,
    word("tablecloth") ? `The table is covered with ${word("tablecloth")}.` : "The table has no tablecloth: its own bare top and edges show.",
    `On the table in front of the chair, and nothing else: ${seat.join("; ")}.`,
    word("centrepiece") ? `Further along the table, softly out of focus: ${word("centrepiece")}.` : "",
    "Nothing that is not listed: no confetti, no curling ribbon, no extra plates, cups or hats, no name cards, no chair decorations, no balloons unless listed.",
    pictures.length ? `Every piece must look exactly like its photo: the same shape, colour, finish and material.${c.placemats !== NONE ? " The placemat carries exactly the printed design of its picture." : ""}` : "",
    `Colour palette: ${colours}.`,
    text ? `The only words anywhere are "${text}" on the placemat.` : "No text and no letters anywhere.",
  ];
  return [...lines, LENS, SETTING[t.scene ?? "garden"], STYLE].filter(Boolean).join(" ");
}
