// The real render of the kids' table (F3). Since 2026-10-28 it is one
// close-up of a place setting, made from the option pictures the customer
// chose ("3 render çok fazla zaman alıyor ve pahalıya geliyor … sadece
// illüstrasyon olsun masa düzeni ve bir tane close up render … sadece
// opsiyonlardaki görselleri kullanalım"): the layout is only ever the live
// drawings. Every choice is also described in words. Shared by the API route
// (the pictures and the prompt) and the builder (is the render still current?).
import { hexToColorName } from "@/lib/generatePrompt";
import { NONE, PLATE_SHAPES, onFloor, optionPhoto, plainColour, tableOption, type TableItemKey } from "./tableCatalog";
import type { TableScene, TableSetup } from "./tableSetup";
import type { TableView } from "./tableCloseGuide";
import { WORDS_ITEMS, clampKids, itemColour, wordsColour, wordsOn } from "./tableSetup";
import { asPrinted, fontWords, tableFont } from "./tableFonts";

export type { TableRender } from "./tableSetup";

/** Changes whenever anything that shows in the picture changes — the theme too (its designs and colours). */
export function tableRenderKey(t: TableSetup, themeId: string): string {
  const s = JSON.stringify([themeId, clampKids(t.kids), Object.entries(t.choices).sort(), t.clothColor, t.runnerColor, t.napkinColor, t.plateColor, t.cupColor, t.holderColor, t.chairColor, t.placematColor, t.labelColor, t.plateShape, t.placematFont, t.labelFont, t.textColor, t.scene ?? "garden", WORDS_ITEMS.map((w) => wordsOn(t, w.key) ?? "")].flat(2));
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
/** A colour in the prompt's words: the plain colours by their own names. */
export const colourWords = (hex: string) => plainColour(hex)?.name ?? hexToColorName(hex);

// What each option looks like, in words. {motif} is the theme's printed pattern.
// The kids' pieces follow the owner's favourite references (2026-10-28).
const WORDS: Partial<Record<TableItemKey, Record<string, string>>> = {
  table: { standard: "a long white rectangular kids' table with straight edges", half_wave: "a long white kids' table curved like a gentle S-shaped wave", flower: "a white kids' table shaped like a flower with six big round petals", round: "a big white round kids' table", low: "a low white floor table, with white floor cushions instead of chairs", cloud: "a long white kids' table whose edges are soft rounded scallops like a cloud" },
  chairs: { white_kids: "a white children's chair with an oval back and arms", blue_kids: "a {chair} children's chair whose back is a curved top rail over a row of thin upright spindles with open gaps between them, so you see through the back", bow_kids: "a pink metal children's chair with a round mesh seat and a back shaped like a bow" },
  tablecloth: { classic: "a smooth floor-length {cloth} tablecloth" },
  napkins: { plain: "a plain {napkin} paper napkin", printed: "a folded paper napkin printed with {motif}" },
  placemats: { plain: "a plain matte {placemat} A3 paper placemat", watercolour: "an A3 paper placemat with a soft watercolour wash and big {motif} in its corners", sparkle: "an A3 paper placemat with a sparkling glittery background and one elegant emblem" },
  // Two of each, a big one and a small one (2026-10-28).
  plates: { plain: "plain matte {plate} paper plates, {plateShape}", iridescent: "many-sided disposable paper plates with a shimmering iridescent pink, lilac and blue foil finish and a white rim", silver: "round disposable silver foil plates with a fluted rim" },
  cups: { iridescent: "a paper cup with a shimmering iridescent foil finish and a white straw", plain: "a plain matte {cup} paper cup (no straw)" },
  cutlery: { dipped: "a disposable wooden fork, knife and spoon with handles dipped in pastel pink", wooden: "a disposable fork, knife and spoon made of natural light wood, not metal", glitter: "a disposable wooden fork, knife and spoon with handles dipped in silver glitter" },
  cutleryHolder: { band: "a plain {holder} paper napkin band" },
  bottleLabel: { plain: "a small clear water bottle wrapped in a plain matte {label} paper label", watercolour: "a small clear water bottle wrapped in a paper label printed with the design of its picture", sparkle: "a small clear water bottle wrapped in a paper label printed with the design of its picture" },
  // 2026-10-28, the owner's flower references: lush, pastel, garden-style.
  centrepiece: { balloons: "a small bunch of mini balloons in the theme colours", florals: "a small, low, compact arrangement of a few pastel flowers — lilac delphinium tips, pink and cream roses, sweet peas and tiny white blooms — set in a hidden block of floral foam covered by leaves — no visible foam, box or vase — low enough to see across the table", toppers: "glittery star toppers on sticks in a little pot" },
  partyHats: { cone: "a cone party hat" },
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
const LENS: Record<TableView, string> = {
  close: "Shot with a 35mm lens at f/4 from the camera position of image 1 — about 50 degrees down, not straight down — so the inside of the plates, the placemats and every piece on them show clearly; the two place settings in the middle are sharp, and the places further along the table soften into blur towards the edges.",
  // 2026-10-29 (owner): "asıl bir tane top view render lazım" — one place, straight down.
  top: "A flat lay: shot looking straight down from directly above with a 50mm lens at f/5.6, exactly as image 1 is framed — the placemat lies square in the picture with the child's side at the bottom, so its words read the right way up, and the whole place is sharp.",
};

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
    // The kids' chair's picture is the chosen colour's; the plain plates and cups have none (their colour is in words).
    .flatMap((k) => { const photo = optionPhoto(k, tableOption(k, t.choices[k]), themeId, itemColour(t, k)); return photo ? [{ key: k, photo }] : []; })
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
export function tablePrompt(t: TableSetup, theme: { id: string; name: string; balloonColors: string[]; accent: string }, pictures: TableItemKey[], view: TableView = "close"): string {
  const top = view === "top";
  const c = t.choices;
  const floor = onFloor(c);
  const round = c.table === "round" || c.table === "flower";
  const word = (k: TableItemKey) => (c[k] === NONE || (floor && k === "chairs") ? "" : (WORDS[k]?.[c[k]] ?? "")
    .replace("{cloth}", colourWords(t.clothColor)).replace("{napkin}", colourWords(t.napkinColor)).replace("{motif}", motifOf(theme.id))
    .replace("{plate}", colourWords(t.plateColor)).replace("{cup}", colourWords(t.cupColor)).replace("{holder}", colourWords(t.holderColor)).replace("{chair}", colourWords(t.chairColor))
    .replace("{placemat}", colourWords(t.placematColor)).replace("{label}", colourWords(t.labelColor)).replace("{plateShape}", PLATE_SHAPES.find((p) => p.id === t.plateShape)?.words ?? "round"));
  // Image 1 is the layout drawing; the option pictures follow it.
  const pic = (k: TableItemKey) => (pictures.includes(k) ? pictures.indexOf(k) + 2 : 0); // 0: no picture
  const exactly = (k: TableItemKey) => (pic(k) ? ` — exactly as in image ${pic(k)}` : "");
  const colours = Array.from(new Set(theme.balloonColors.map(hexToColorName).filter(Boolean))).join(", ");
  const said = (k: "placemats" | "cutleryHolder" | "bottleLabel") => wordsOn(t, k);
  const placematWords = said("placemats"), holderWords = said("cutleryHolder"), bottleWords = said("bottleLabel");
  const matFont = tableFont(t.placematFont), labelFont = tableFont(t.labelFont);

  // Where everything sits at a place, as the owner set it out (2026-10-28): the
  // cutlery only on the left, in its holder with the napkin; the cup on the
  // placemat's top-right corner, the bottle beside it; the hat on the top-left
  // corner; the words stacked one word a line in the bottom-right corner.
  const seat: string[] = [];
  if (word("placemats")) {
    const stack = placematWords ? asPrinted(placematWords, matFont).split(/\s+/).map((w) => `"${w}"${w.length > 1 ? ` (${Array.from(w).join("-")})` : ""}`).join(" above ") : "";
    seat.push(`${word("placemats")}${exactly("placemats")}, lying flat on the table in front of the chair${stack ? `, with the words printed straight onto the placemat paper in its bottom-right corner in small ${colourWords(wordsColour(t, theme))} letters ${fontWords(matFont)}, stacked one word per line (${stack}) — no sticker, no label, never on the plate` : ""}`);
  }
  // 2026-10-28 (owner): a big plate with a small one on it (2026-10-29: nothing in the small one).
  const themedMats = !!tableOption("placemats", c.placemats)?.themed;
  if (word("plates")) seat.push(`in the middle of the placemat, two ${word("plates")}${exactly("plates")}: a big plate with a smaller plate of the same kind sitting in it, exactly as image 1 shows — one big plate and one small plate${top ? "" : " on each placemat"}, both empty, nothing on them and nothing written on them, and nothing lying beside the plates: to their right is bare placemat`);
  const napkin = `${word("napkins")}${exactly("napkins")}`, cutlery = `${word("cutlery")}${exactly("cutlery")}`;
  const name = holderWords ? ` with a little tag with the name "${holderWords}" on it` : ", with no tag and no words";
  // 2026-10-29 (owner): "peçete her zaman cutlery'nin altında olmalı" — the
  // cutlery lies on the napkin, with the band round both.
  seat.push(c.cutleryHolder === "band" ? `on the left of the placemat: ${napkin} folded flat, with ${cutlery} lying on top of it, the napkin and the cutlery wrapped round the middle together by ${word("cutleryHolder")}${name} — the band is ${colourWords(t.holderColor)}, whatever colour its photo shows`
    : `on the left of the placemat: ${napkin} folded flat, with ${cutlery} lying on top of it`);
  if (word("cups")) seat.push(`${word("cups")}${exactly("cups")} on the top-right corner of the placemat`);
  if (word("bottleLabel")) seat.push(`just beside the cup, ${word("bottleLabel")}${pic("bottleLabel") ? ` (image ${pic("bottleLabel")})` : ""}${bottleWords ? ` with "${asPrinted(bottleWords, labelFont)}" printed on the label in ${colourWords(wordsColour(t, theme))} letters ${fontWords(labelFont)}` : ", its label with no words"} — the cup and the bottle are both there, and this is the place's only bottle`);
  if (word("partyHats")) seat.push(`${word("partyHats")} standing on the top-left corner of the placemat`);
  const words = Array.from(new Set([placematWords, holderWords, bottleWords].filter(Boolean) as string[]));

  const lines = [
    // 2026-10-28 ("saçmaladı render"): words alone did not hold the layout, so
    // a drawing of the exact scene leads, and the photos give each piece its look.
    top ? `Image 1 is a simple drawing, seen from straight above, of one child's place at a ${round ? "big" : "long"} children's party table, with every piece of the place setting in its exact place and the child's ${floor ? "floor cushion" : "chair"} at the bottom.`
      : `Image 1 is a simple drawing of the exact scene: one part of a ${round ? "big" : "long"} children's party table seen from about 50 degrees above, with every chair and every piece of every place setting in its exact place.`,
    pictures.length > 1 ? `Images 2 to ${pictures.length + 1} are product photos of the exact pieces chosen: ${pictures.map((k, i) => `image ${i + 2} is ${LABEL[k]}`).join(", ")}.`
      : pictures.length ? `Image 2 is a product photo of the exact piece chosen: ${LABEL[pictures[0]]}.` : "",
    "Turn image 1 into a real photograph. Keep its camera angle and framing, and keep the table, every chair and every placemat, plate, napkin, cutlery, cup, bottle, hat and centrepiece exactly where image 1 has them — the same number of each, nothing added, moved or left out. Each simple shape in the drawing becomes the real piece; nothing of the drawing itself may remain — no outlines, no flat colours.",
    pictures.length ? "From each product photo take only the piece itself and ignore everything around it — the grass, walls, backdrops, other furniture, napkins, flowers and other tableware in those photos." : "",
    themedMats ? "The placemats in image 1 already carry their exact printed design: keep it exactly, as real printed paper." : c.placemats !== NONE ? `The placemats are plain ${colourWords(t.placematColor)} paper, with nothing printed on them but the words.` : "",
    words.length && placematWords ? "The words on the placemats are already lettered in image 1: keep them exactly, letter for letter, in the same lettering, the same size and the same place, as real print on the paper — every letter there, none added." : "",
    // "Uzun bir masanın bir bölümü gözüksün, masa 2 kişilik gibi durmasın" (2026-10-28).
    top ? `Make a photograph of one child's place at a big, fully set children's party table: ${word("table")}${pic("table") ? " — exactly the table in its photo" : ""}. This one place fills the picture; the table top carries on beyond its edges, where the next places just begin at the sides, cut off by the frame, exactly as in image 1.`
      : `Make a photograph of one part of a big, fully set children's party table: ${word("table")}${pic("table") ? " — exactly the table in its photo, with the same shape, edges, colour and legs" : ""}. The table carries on beyond the edges of the picture, with more chairs and identical place settings continuing softly out of focus, so it is clearly a table for many children, not a table for two.`,
    // Round the round and flower tables the two places sit side by side, seen from across the table (lib/studio/tableCloseGuide.ts).
    top ? (floor ? "At the bottom of the picture, just off the table's edge, is the child's white floor cushion." : `At the bottom of the picture, just off the table's edge, is the front of the child's chair, seen from above: ${word("chairs")}${exactly("chairs")}.`)
      : round ? `In focus, in the middle of the picture: TWO place settings side by side at the far edge of the table, facing us, each with its chair pulled up behind it: ${word("chairs")}${exactly("chairs")}.`
      : `In focus, in the middle of the picture: TWO place settings facing each other across the table. ${floor ? "Two white floor cushions face each other on the two sides of the low table." : `Two chairs face each other on the two sides of the table, each pulled up to it: ${word("chairs")}${exactly("chairs")}.`}`,
    word("tablecloth") ? `The table is covered with ${word("tablecloth")}.` : "The table has no tablecloth: its own bare top and edges show.",
    `${top ? "On the table in front of the chair is the place setting" : "In front of each chair, on the table, is the same setting"}: ${seat.join("; ")}.`,
    word("centrepiece") ? (top ? `At most the edge of the centrepiece (${word("centrepiece")}) shows at the top of the picture, only where image 1 has it.` : `Between the two settings, in the middle of the table: ${word("centrepiece")}${exactly("centrepiece")}.`) : "",
    // 2026-10-28 (owner): an extra metal fork and knife kept appearing to the right of the plate.
    c.cutleryHolder === "band" ? "Each place has exactly one fork, one knife and one spoon, lying side by side on top of its folded napkin on the left, under the band — the napkin is always under the cutlery. No other cutlery anywhere: nothing lies on the placemats, beside or on the plates, or on the table, and there is no metal cutlery at all." : "The only cutlery anywhere is the one set lying on top of the napkin on the left of each placemat — the napkin is always under the cutlery: no other forks, knives or spoons on the placemats, beside the plates or on the table.",
    "Nothing that is not listed: no confetti, no curling ribbon, no extra plates, cups or hats, no name cards, no chair decorations, no balloons unless listed.",
    pictures.length ? "Every piece must look exactly like its photo: the same shape, colour, finish and material, and the printed designs exactly as in their pictures." : "",
    `Colour palette: ${colours}.`,
    words.length ? `The only words anywhere are ${words.map((w) => `"${w}"`).join(" and ")}, spelled exactly like that, where they are described.` : "No text and no letters anywhere.",
  ];
  // Straight down the whole place is sharp: no background to blur.
  return [...lines, LENS[view], top ? "" : SETTING[t.scene ?? "garden"], top ? STYLE.replace(" with a shallow depth of field", "") : STYLE].filter(Boolean).join(" ");
}
