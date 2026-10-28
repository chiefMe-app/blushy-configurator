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
import { WORDS_ITEMS, clampKids, wordsOn } from "./tableSetup";

export type { TableRender } from "./tableSetup";

/** Changes whenever anything that shows in the picture changes. */
export function tableRenderKey(t: TableSetup): string {
  const s = JSON.stringify([clampKids(t.kids), Object.entries(t.choices).sort(), t.clothColor, t.runnerColor, t.napkinColor, t.scene ?? "garden", WORDS_ITEMS.map((w) => wordsOn(t, w.key) ?? "")].flat(2));
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
  chairs: { white_kids: "a white children's chair with an oval back and arms", blue_kids: "a bright blue children's chair whose back is a curved top rail over a row of thin upright spindles with open gaps between them, so you see through the back", bow_kids: "a pink metal children's chair with a round mesh seat and a back shaped like a bow" },
  tablecloth: { classic: "a smooth floor-length {cloth} tablecloth" },
  napkins: { plain: "a plain {napkin} paper napkin", striped: "a folded paper napkin with soft pastel pink and white stripes", printed: "a folded paper napkin printed with {motif}", foil: "a folded pale blue paper napkin with a shiny silver foil print" },
  placemats: { pattern: "an A3 paper placemat printed all over with {motif} on a soft background", watercolour: "an A3 paper placemat with a soft watercolour wash and big {motif} in its corners", sparkle: "an A3 paper placemat with a sparkling glittery background and one elegant emblem" },
  plates: { iridescent: "a many-sided disposable paper plate with a shimmering iridescent pink, lilac and blue foil finish and a white rim", holo_square: "a square disposable plate in shiny silver holographic foil", silver: "a round disposable silver foil plate with a fluted rim" },
  cups: { white_straw: "a plain white paper cup with a slim silver paper straw", iridescent: "a paper cup with a shimmering iridescent foil finish and a white straw", pastel: "a matte pastel paper cup" },
  cutlery: { dipped: "a disposable wooden fork, knife and spoon with handles dipped in pastel pink", wooden: "a disposable fork, knife and spoon made of natural light wood, not metal", glitter: "a disposable wooden fork, knife and spoon with handles dipped in silver glitter" },
  cutleryHolder: { pocket: "a printed paper cutlery pocket with a name panel", band: "a paper napkin band with a little name tag", tag: "a thin ribbon with a scalloped paper tag" },
  bottleLabel: { pattern: "a small clear water bottle wrapped in a paper label printed with the design of its picture", watercolour: "a small clear water bottle wrapped in a paper label printed with the design of its picture", sparkle: "a small clear water bottle wrapped in a paper label printed with the design of its picture" },
  // 2026-10-28, the owner's flower references: lush, pastel, garden-style.
  centrepiece: { balloons: "a small bunch of mini balloons in the theme colours", florals: "a small, low, compact arrangement of a few pastel flowers — lilac delphinium tips, pink and cream roses, sweet peas and tiny white blooms — set in a hidden block of floral foam covered by leaves — no visible foam, box or vase — low enough to see across the table", toppers: "glittery star toppers on sticks in a little pot" },
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
// 2026-10-28, the owner: "biraz daha üstten bakalım … tabağın içi gözükecek bir view olsun, tam top değil".
const LENS = "Shot with a 35mm lens at f/4 from the camera position of image 1 — about 50 degrees down, not straight down — so the inside of the plates, the placemats and every piece on them show clearly; the two place settings in the middle are sharp, and the places further along the table soften into blur towards the edges.";

// What each picture shows, in the prompt ("image 1 is the table").
const LABEL: Record<TableItemKey, string> = {
  table: "the table", chairs: "the chair", tablecloth: "the tablecloth", runner: "the runner", napkins: "the napkin",
  placemats: "the placemat's printed design", plates: "the plate", cups: "the cup", cutlery: "the cutlery", chargers: "the charger plate",
  cutleryHolder: "the cutlery holder (only the holder itself)", bottleLabel: "the water bottle label's printed design",
  centrepiece: "the centrepiece", chairDecor: "the chair decoration", nameCards: "the name card", partyHats: "the party hat",
};
// The pictures sent after the layout drawing, the table first (2026-10-28: a
// close-up of the cloud table came out on a small round one). The placemats
// are drawn into the layout with their own design; the cloth, cutlery, hat
// and centrepiece go in words only (2026-10-28 tests: the cutlery's own
// picture brought loose cutlery back).
const REFERENCE_ORDER: TableItemKey[] = ["table", "chairs", "plates", "napkins", "cups", "cutleryHolder", "bottleLabel"];
/** With the layout drawing (tableCloseGuide.ts) first, a few option pictures: more drowned the drawing out (2026-10-28 test). */
export const MAX_REFERENCES = 7;

/** The chosen options' pictures for the render, in the order the prompt names them. */
export function referencePictures(t: TableSetup, themeId: string): { key: TableItemKey; photo: string }[] {
  const floor = onFloor(t.choices); // the low table: cushions, no chair to show
  // A plain napkin is its chosen colour, in words: its picture shows another colour.
  const plainNapkin = !!tableOption("napkins", t.choices.napkins)?.coloured;
  return REFERENCE_ORDER.filter((k) => !(floor && k === "chairs") && !(plainNapkin && k === "napkins"))
    .flatMap((k) => { const photo = optionPhoto(k, tableOption(k, t.choices[k]), themeId); return photo ? [{ key: k, photo }] : []; })
    .slice(0, MAX_REFERENCES);
}

/**
 * The words for the close-up; `pictures` are the items whose pictures go with
 * it, in order (referencePictures). 2026-10-28, the owner: "birebir aynı
 * setup'ın close-up'ı olması lazım" — exactly the chosen pieces, on exactly
 * the chosen table, and nothing else; then, after her first render: two
 * children facing each other, each with the whole setting; the words on the
 * placemat (bottom-right, never on the plate); the chosen napkin with only
 * the band from the holder's photo; the cup and the bottle both; the
 * centrepiece between them; the hat on a corner of the placemat.
 */
export function tablePrompt(t: TableSetup, theme: { id: string; name: string; balloonColors: string[] }, pictures: TableItemKey[]): string {
  const c = t.choices;
  const floor = onFloor(c);
  const word = (k: TableItemKey) => (c[k] === NONE || (floor && k === "chairs") ? "" : (WORDS[k]?.[c[k]] ?? "")
    .replace("{cloth}", hexToColorName(t.clothColor)).replace("{napkin}", hexToColorName(t.napkinColor)).replace("{motif}", motifOf(theme.id)));
  // Image 1 is the layout drawing; the option pictures follow it.
  const pic = (k: TableItemKey) => (pictures.includes(k) ? pictures.indexOf(k) + 2 : 0); // 0: no picture
  const exactly = (k: TableItemKey) => (pic(k) ? ` — exactly as in image ${pic(k)}` : "");
  const colours = Array.from(new Set(theme.balloonColors.map(hexToColorName).filter(Boolean))).join(", ");
  const said = (k: "placemats" | "cutleryHolder" | "bottleLabel") => wordsOn(t, k);
  const placematWords = said("placemats"), holderWords = said("cutleryHolder"), bottleWords = said("bottleLabel");

  // Where everything sits at a place, as the owner set it out (2026-10-28): the
  // cutlery only on the left, in its holder with the napkin; the cup on the
  // placemat's top-right corner, the bottle beside it; the hat on the top-left
  // corner; the words stacked one word a line in the bottom-right corner.
  const seat: string[] = [];
  if (word("placemats")) {
    const stack = placematWords ? placematWords.split(/\s+/).map((w) => `"${w}"`).join(" above ") : "";
    seat.push(`${word("placemats")}${exactly("placemats")}, lying flat on the table in front of the chair${stack ? `, with the words printed straight onto the placemat paper in its bottom-right corner in elegant periwinkle-blue serif capitals, stacked one word per line (${stack}) — no sticker, no label, never on the plate` : ""}`);
  }
  if (word("plates")) seat.push(`${word("plates")}${exactly("plates")} in the middle of the placemat — exactly one plate on each placemat, never two, not a stack, nothing on it or written on it, its inside clearly visible, and nothing lying beside it: to its right is bare printed placemat`);
  const napkin = `${word("napkins")}${exactly("napkins")}`, cutlery = `${word("cutlery")}${exactly("cutlery")}`;
  const name = holderWords ? ` with the name "${holderWords}" on it` : "";
  const like = pic("cutleryHolder") ? `, arranged exactly like the cutlery holder in image ${pic("cutleryHolder")}` : "";
  // Tests 2026-10-28: "with the cutlery" read as loose cutlery beside the plate;
  // the best one put it in a napkin pocket, as the band's picture now shows.
  seat.push(c.cutleryHolder === "band" ? `on the left of the placemat: ${napkin} folded into a pocket with the cutlery (${word("cutlery")}) standing up out of it, wrapped round the middle by ${word("cutleryHolder")}${name}${like}, in this napkin's colour`
    : c.cutleryHolder === "pocket" ? `on the left of the placemat: ${napkin} folded, with ${cutlery} standing in ${word("cutleryHolder")}${name}${like}`
    : c.cutleryHolder === "tag" ? `on the left of the placemat: ${napkin} folded, with ${cutlery} laid on it and tied with ${word("cutleryHolder")}${name}${like}`
    : `on the left of the placemat: ${napkin} folded, with ${cutlery} laid on it`);
  if (word("cups")) seat.push(`${word("cups")}${exactly("cups")} on the top-right corner of the placemat`);
  if (word("bottleLabel")) seat.push(`just beside the cup, ${word("bottleLabel")} (image ${pic("bottleLabel")})${bottleWords ? ` with "${bottleWords}" printed on the label` : ", its label with no words"} — the cup and the bottle are both there`);
  if (word("partyHats")) seat.push(`${word("partyHats")} standing on the top-left corner of the placemat`);
  const words = [placematWords, holderWords, bottleWords].filter(Boolean) as string[];

  const lines = [
    // 2026-10-28 ("saçmaladı render"): words alone did not hold the layout, so
    // a drawing of the exact scene leads, and the photos give each piece its look.
    "Image 1 is a simple drawing of the exact scene: one part of a long children's party table seen from about 50 degrees above, with every chair and every piece of every place setting in its exact place.",
    pictures.length ? `Images 2 to ${pictures.length + 1} are product photos of the exact pieces chosen: ${pictures.map((k, i) => `image ${i + 2} is ${LABEL[k]}`).join(", ")}.` : "",
    "Turn image 1 into a real photograph. Keep its camera angle and framing, and keep the table, every chair and every placemat, plate, napkin, cutlery, cup, bottle, hat and centrepiece exactly where image 1 has them — the same number of each, nothing added, moved or left out. Each simple shape in the drawing becomes the real piece; nothing of the drawing itself may remain — no outlines, no flat colours.",
    pictures.length ? "From each product photo take only the piece itself and ignore everything around it — the grass, walls, backdrops, other furniture, napkins, flowers and other tableware in those photos." : "",
    c.placemats !== NONE ? "The placemats in image 1 already carry their exact printed design: keep it exactly, as real printed paper." : "",
    words.length && placematWords ? "The words on the placemats are already lettered in image 1: keep them exactly, letter for letter, in the same place, as real print on the paper." : "",
    // "Uzun bir masanın bir bölümü gözüksün, masa 2 kişilik gibi durmasın" (2026-10-28).
    `Make a photograph of one part of a big, fully set children's party table: ${word("table")}${pic("table") ? " — exactly the table in its photo, with the same shape, edges, colour and legs" : ""}. The table carries on beyond the edges of the picture, with more chairs and identical place settings continuing softly out of focus, so it is clearly a table for many children, not a table for two.`,
    `In focus, in the middle of the picture: TWO place settings facing each other across the table. ${floor ? "Two white floor cushions face each other on the two sides of the low table." : `Two chairs face each other on the two sides of the table, each pulled up to it: ${word("chairs")}${exactly("chairs")}.`}`,
    word("tablecloth") ? `The table is covered with ${word("tablecloth")}.` : "The table has no tablecloth: its own bare top and edges show.",
    `In front of each chair, on the table, is the same setting: ${seat.join("; ")}.`,
    word("centrepiece") ? `Between the two settings, in the middle of the table: ${word("centrepiece")}${exactly("centrepiece")}.` : "",
    // 2026-10-28 (owner): an extra metal fork and knife kept appearing to the right of the plate.
    c.cutleryHolder === "band" ? "Each place has exactly one fork, one knife and one spoon, all standing in its napkin pocket on the left. No other cutlery anywhere: nothing lies on the placemats, beside or on the plates, or on the table, and there is no metal cutlery at all." : "The only cutlery anywhere is the one set on the left of each placemat: no other forks, knives or spoons on the placemats, beside the plates or on the table.",
    "Nothing that is not listed: no confetti, no curling ribbon, no extra plates, cups or hats, no name cards, no chair decorations, no balloons unless listed.",
    pictures.length ? "Every piece must look exactly like its photo: the same shape, colour, finish and material, and the printed designs exactly as in their pictures." : "",
    `Colour palette: ${colours}.`,
    words.length ? `The only words anywhere are ${words.map((w) => `"${w}"`).join(" and ")}, spelled exactly like that, where they are described.` : "No text and no letters anywhere.",
  ];
  return [...lines, LENS, SETTING[t.scene ?? "garden"], STYLE].filter(Boolean).join(" ");
}
