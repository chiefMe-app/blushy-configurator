// The whole party in one photograph (2026-11-04, the owner: "Tasarladığımız Backdrop+table setup beraber
// görebilceğimiz bir render alsın ama bu sayfada outdoor yada indoor işaretlesin ona göre görsel üretelim"): on the
// Venue step, the backdrop she designed (its render, or its live sketch) and her kids' table (its render, or its
// drawing) stood together, indoors or outdoors as she marks it. Shared by the route (app/api/party-render) and the
// builder (is the picture still current?).
import type { BackdropShapeId, BuilderConfig, DecorConfig } from "@/lib/config";
import { onFloor, type TableItemKey } from "./tableCatalog";
import { tableCounts, type TableSetup } from "./tableSetup";
import { itemWords, referencePictures, tableRenderKey } from "./tableRender";
import { experienceById, type ExperienceId } from "./experiences";

export type PartySetting = "indoor" | "outdoor";

/** What there is to stand together: the backdrop (unless skipped), the kids' table (if she made one). */
export function partyPieces(config: Pick<BuilderConfig, "decor" | "table">): { backdrop: boolean; table: boolean } {
  return {
    backdrop: config.decor.backdropChoice !== "skip" && config.decor.backdropItems.length > 0,
    table: !!config.table?.enabled,
  };
}

/**
 * "Everything in one picture" (2026-11-05, the owner: "tasarladığım her şey tek render'da seçeneğini de yapalım"): the
 * other parts she designed, each by its own real photo or its drawing, stood with the backdrop and the table — the
 * grown-ups' table too (the owner: "büyükler masası ve deneyimler de girsin"). In this order. When they don't all fit
 * in the engine's eight pictures, they go in together as one sheet (partySheet).
 */
export const PARTY_EXTRAS = ["adults", "cake", "welcome", "giveaways", "helium", "pinata"] as const;
export type PartyExtra = (typeof PARTY_EXTRAS)[number];
export const isPartyExtra = (v: unknown): v is PartyExtra => PARTY_EXTRAS.includes(v as PartyExtra);
/**
 * At most this many pictures go to the engine. FLUX.2 [pro] edit takes 9 megapixels in all, its pictures and its
 * photograph together: each picture counts as one (at most 1 MP after the first), the 1344 x 896 photograph as two —
 * so seven pictures. Eight came back 422 "Requested area too large" (2026-11-05, the owner: "olmuyor render").
 */
export const MAX_PARTY_IMAGES = 7;
/**
 * Everything is two photographs (2026-11-06, the owner chose "a olsun"): the backdrop and the kids' table first, kept
 * exact, then at most this many more pieces she picks, added at their sides — a second photo adds about three well;
 * ten in one photo spoiled the backdrop.
 */
export const PARTY_PICKS = 5;
/** What stands with the backdrop and table: those she picked (still there), else the first ones; PARTY_PICKS at most. */
export function partyPicked(available: readonly string[], pick?: readonly string[]): string[] {
  return (pick ? pick.filter((id) => available.includes(id)) : available).slice(0, PARTY_PICKS);
}
export const PARTY_EXTRA_NAMES: Record<PartyExtra, string> = { adults: "Grown-ups' table", cake: "Cake & sweets", welcome: "Welcome board", giveaways: "Giveaways", helium: "Helium balloons", pinata: "Piñata" };
/** Each in the checklist of what the photograph shows. */
const EXTRA_LIST: Record<PartyExtra, string> = { adults: "the grown-ups' table", cake: "the cake", welcome: "the welcome board", giveaways: "the giveaway boxes", helium: "the helium balloons", pinata: "the piñata" };
/** The side of the backdrop a piece stands on. */
export type Side = "left" | "right";
const otherSide = (s: Side): Side => (s === "left" ? "right" : "left");
/**
 * Where each piece stands when the photograph is one (2026-11-05): the welcome board, the helium and the carts on the
 * left, the cake, the giveaways, the piñata and the inflatables on the right. With four or five pieces the photograph
 * is two (partySides), each side's pieces in one, and a piece may be sent to the other side. The giveaways' board and
 * the welcome board — both white boards with her name on — are never on the same side: put together, the engine made
 * them one board every time (2026-11-07, four test renders); apart, every piece came out.
 */
export const NATURAL_SIDE: Record<string, Side> = {
  adults: "left", welcome: "left", helium: "left", popcorn: "left", cotton_candy: "left", slime: "left", cupcake: "left",
  cake: "right", giveaways: "right", pinata: "right", bouncy_castle: "right", soft_play: "right", ball_pit: "right", face_painting: "right", dj: "right", painting: "right",
};
/** Where each stands in the setup, told with its picture ("image 3", "picture 2 of image 3") and its side. */
const EXTRA_WORDS: Record<PartyExtra, (r: string, s: Side) => string> = {
  adults: (r, s) => `the grown-ups' table of ${r} — drawn there from above, made into a real table set for the grown-ups with its chairs: the same tablecloth, runner, chargers, plates, glasses, napkins, cutlery and centrepiece in the same colours — further back on the ${s}, apart from the kids' table, seen from the front, not from above, and clearly in the picture: the whole of it, or at least its near half with its chairs and several places set`,
  cake: (r, s) => `the cake and sweets of ${r}, on the same stand, cart, table or plinths ${r} shows, on the ${s}, in front of the ${s} end of the backdrop and a little nearer the camera, on its own stand or little table, a real cake's size (a tier about 20 cm across), never on the backdrop's plinths or the kids' table, never in front of the backdrop or in the kids' table's place — the cake, its toppers and every sweet exactly as ${r} shows them`,
  welcome: (r, s) => `the welcome board of ${r}, standing alone on its own easel at the front, just ${s} of the kids' table and nearest the camera, turned a little towards it — the same shape, colours and pictures, its words copied exactly, letter by letter`,
  giveaways: (r, s) => `the giveaway boxes of ${r} at the front on the ${s}, near the ${s} end of the kids' table, on exactly the board or little table ${r} shows — its shape, colour, shelves and print, its words once, just as ${r} has them — never another stand, cart or shelf; the same boxes, prints and names`,
  helium: (r, s) => `the helium balloon bouquets of ${r}, each tied by its ribbons to its own weight on the floor beside the ${s} end of the backdrop, floating free — never tied to, resting on or rising from another piece — the same balloons, foils and colours`,
  pinata: (r, s) => `the piñata of ${r} on the far ${s}, the outermost thing on that side, hanging from the top of its own tall pole on its own base on the ground — the same shape, colours and age`,
};

/**
 * Her experiences in the picture (2026-11-05): the carts and the inflatables by their own photos, the stations that
 * are things by words. A show, a host or a photographer is a person: the picture has no people, so they stay out of it.
 */
export const PARTY_EXPERIENCE_PHOTOS: Partial<Record<ExperienceId, { pic: string; words: (s: Side) => string }>> = {
  popcorn: { pic: "popcorn", words: (s) => `on the far ${s} and a little further back, the white popcorn cart with its little boxes of popcorn` },
  cotton_candy: { pic: "cotton-candy", words: (s) => `on the far ${s} and a little further back, the white cotton candy cart with its pastel cotton candy` },
  bouncy_castle: { pic: "bouncy-castle", words: (s) => `on the far ${s} and further back, the pastel bouncy castle with its turrets, on the lawn or floor` },
  soft_play: { pic: "soft-play", words: (s) => `on the far ${s} and further back, the soft play corner of foam blocks, steps and a little slide` },
  ball_pit: { pic: "ball-pit", words: (s) => `on the far ${s}, the round ball pit of pastel balls` },
};
const STATION_WORDS: Partial<Record<ExperienceId, (s: Side) => string>> = {
  face_painting: (s) => `further out on the ${s}, a little face-painting table with its paint palette, brushes and a mirror, a small chair beside it`,
  dj: (s) => `further out on the ${s}, a white DJ booth with its decks and two speakers`,
  slime: (s) => `further out on the ${s}, a low white workshop table set for slime making: bowls, glitter and little pots, one place for each child`,
  cupcake: (s) => `further out on the ${s}, a low white workshop table set for cupcake decorating: plain cupcakes, frosting and sprinkles, one place for each child`,
  painting: (s) => `further out on the ${s}, a low white workshop table with little canvases on easels and paints, one place for each child`,
};
/** What of her experiences can be shown: photos (in her order), then the stations told in words. */
export function partyExperiences(picked: readonly string[]): { photos: ExperienceId[]; stations: ExperienceId[] } {
  const ids = Array.from(new Set(picked)).filter((id): id is ExperienceId => !!experienceById(id));
  return { photos: ids.filter((id) => PARTY_EXPERIENCE_PHOTOS[id]), stations: ids.filter((id) => STATION_WORDS[id]) };
}
/** Shown in the parts list: the people (a show, a host, the photographer) stay out of the picture. */
export const partyExperienceShown = (id: ExperienceId) => !!(PARTY_EXPERIENCE_PHOTOS[id] || STATION_WORDS[id]);

/** Changes with the backdrop, the table, the theme or the setting: what the photograph shows. */
export function partyRenderKey(config: Pick<BuilderConfig, "decor" | "table" | "theme">, setting: PartySetting, extras: { part: PartyExtra; key: string }[] = [], experiences: readonly string[] = []): string {
  const p = partyPieces(config);
  const s = JSON.stringify([setting, config.theme, p.backdrop ? config.decor : null, p.table && config.table ? tableRenderKey(config.table, config.theme) : null,
    ...(extras.length ? [extras.map((e) => `${e.part}:${e.key}`)] : []), ...(experiences.length ? [["x", ...experiences]] : [])]);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

const SETTING: Record<PartySetting, string> = {
  outdoor: "The party is outdoors in a lovely villa garden: the setup stands on a neat green lawn, with soft green hedges, a few palm trees and a pale garden wall softly out of focus behind, in soft, bright late-afternoon daylight with gentle open shade — never harsh midday sun, never a sunset glow.",
  indoor: "The party is indoors in a bright, airy, elegant party room: plain white walls, a light oak floor and tall windows letting in soft daylight, the room otherwise empty and softly out of focus behind the setup.",
};

const LIGHT = "Light and colour it like a bright, cheerful, well-exposed professional kids' party photo: soft, even light, never overexposed; a fresh, clean white balance, never yellow or orange; every colour clear and true to the pictures, never darker or greyed; only soft, natural shadows.";

/** The party's table pieces whose own option photos go with the picture (the top view shows the rest). */
const PARTY_REFS: TableItemKey[] = ["table", "chairs"];

/** The table's and the chair's option photos, in the order the prompt names them (after the backdrop and the top view). */
export function partyReferences(t: TableSetup, themeId: string): { key: TableItemKey; photo: string }[] {
  return referencePictures(t, themeId).filter((r) => PARTY_REFS.includes(r.key))
    .map((r) => (r.key === "table" && BARE_TABLES.includes(t.choices.table) ? { ...r, photo: `/design/table/table-${t.choices.table}-bare.webp` } : r));
}

/**
 * The tables whose photo has its chairs and things taken out (scripts/table/table-bare-fal.mjs), for the party photo:
 * with the shop's chairs in it, the render sat the children on those, not on hers (2026-11-05, the owner: "sandalye bu
 * seçili değil … userın seçtiğini yapalım"). Every table with chairs; the low table has cushions, no chairs.
 */
export const BARE_TABLES = ["standard", "half_wave", "flower", "round", "cloud"];

const SHAPE: Partial<Record<BackdropShapeId, string>> = {
  arch: "arch board", half_arch: "half-arch side board", round: "round board", rect: "rectangular board", banner: "printed banner",
  open_arch_frame: "open arch frame", shimmer_wall: "shimmer wall", balloon_ring: "balloon ring", wavy: "wavy board",
};

/** The backdrop's pieces in words: each board with its size and its words, the plinths (its colours are its picture's). */
export function backdropWords(decor: Pick<DecorConfig, "backdropItems" | "backdropColor" | "plinths">): string {
  const boards = decor.backdropItems.map((i) => {
    const size = i.widthCm && i.heightCm ? `${i.widthCm} × ${i.heightCm} cm` : "";
    // Its words and their colour (2026-11-06, the owner: "saçmaladı render backdropta özellikle" — white lettering came out pink).
    // Its colour is the picture's (2026-11-06, the owner's pink board came out cream): a colour told in words that its
    // picture shows otherwise pulls it away.
    const words = i.text?.enabled && i.text.value?.trim() ? ` with the words "${i.text.value.trim().replace(/\s+/g, " ")}" on it in exactly the lettering and colour image 1 shows` : "";
    return [SHAPE[i.type] ?? "board", size ? `(${size})` : "", "in exactly the colour image 1 shows"].filter(Boolean).join(" ") + words;
  });
  const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : xs[0] ?? "");
  const plinths = decor.plinths > 0 ? `${decor.plinths === 1 ? "one white cylinder plinth" : `${decor.plinths} white cylinder plinths`} in front of ${boards.length > 1 ? "the boards" : "the board"}` : "";
  return [boards.length ? `${boards.length > 1 ? "the boards" : "the board"}: ${list(boards.map((b) => `a ${b}`))}` : "", plinths].filter(Boolean).join("; ");
}

/** How the chairs stand (2026-11-05, the owner, with a photo taken straight on: "4 er tane bir tarafa bide yanlara 2
 * olabilir"): one at each end of a long table, the rest shared along its two long sides. */
export function seatsWords(t: Pick<TableSetup, "kids" | "choices">): string {
  const { perTable } = tableCounts(t);
  const round = t.choices.table === "round" || t.choices.table === "flower";
  if (round) return " all round it";
  const most = Math.max(...perTable);
  if (most <= 1) return "";
  const ends = most >= 6 ? 2 : most === 5 ? 1 : 0;
  const rest = most - ends, far = Math.ceil(rest / 2), near = rest - far;
  const each = perTable.length > 1 ? " of each table" : "";
  const sides = far === near ? `exactly ${far} along each long side${each}` : `exactly ${far} along the far long side${each} and ${near} along the near one`;
  const atEnds = ends === 2 ? " and one at each end" : ends === 1 ? " and one at one end" : "";
  const metres = (far * 0.45).toFixed(1).replace(/\.0$/, "");
  // 2026-11-05 test: "exactly 4 along each long side" gave 2 — the count told as a sum, the table long and narrow.
  const sum = `${[far, near, ...(ends ? Array(ends).fill(1) : [])].join(" + ")} = ${most} chairs and ${most} places set${each === "" ? "" : " at each table"}`;
  return ` — ${sides}${atEnds}, ${sum}, the table long and narrow (about ${metres} m long and 60 cm wide) so they all fit`;
}

/** One place's pieces on the table, in words with their colours (2026-11-05, the owner, of a party render: "masanın
 * üstündekiler plinthin üstündekiler biraz saçmalamış" — red "Birthday" cards stood on the table and the cups came
 * out blue): the top view alone left the engine to guess. */
const PLACE_PIECES: TableItemKey[] = ["placemats", "plates", "cups", "napkins", "cutlery", "cutleryHolder", "bottleLabel", "partyHats"];
export function placeWords(t: TableSetup, themeId: string): string {
  return PLACE_PIECES.map((k) => itemWords(t, themeId, k)).filter(Boolean).join(", ");
}

/** The table she chose, piece by piece, each told with its picture. */
function tableWords(t: TableSetup, themeId: string, image: (k: TableItemKey) => number): string {
  const { tables } = tableCounts(t);
  const floor = onFloor(t.choices);
  const pic = (k: TableItemKey) => (image(k) ? ` — exactly the one in image ${image(k)}, the same shape, colour, material and style` : "");
  const piece = (k: TableItemKey) => itemWords(t, themeId, k);
  return [
    `${tables > 1 ? `${tables} identical low kids' tables, each` : "a low kids' table"} (about 55 cm high): ${piece("table") || "a kids' party table"}${pic("table")}`,
    floor ? `with soft floor cushions for ${t.kids} children` : `with ${t.kids} small child-sized chairs, half the size of grown-ups' chairs, their backs reaching only a little above the tabletop${seatsWords(t)}, each ${piece("chairs") || "a children's chair"}${pic("chairs")}, every chair the same — never other chairs`,
    piece("tablecloth") ? `dressed in ${piece("tablecloth")}` : "no tablecloth",
    piece("centrepiece") ? `with ${piece("centrepiece")} in the middle` : "",
  ].filter(Boolean).join("; ");
}

/** Left to right across the photograph: each side's pieces, the outermost first on the left, the innermost first on the right. */
const ROW_LEFT = ["popcorn", "cotton_candy", "adults", "welcome", "helium", "slime", "cupcake"] as const;
const ROW_RIGHT = ["cake", "giveaways", "pinata", "face_painting", "dj", "painting", "bouncy_castle", "soft_play", "ball_pit"] as const;
/** A piece in the row, by name. */
const inRow = (id: string) => (isPartyExtra(id) ? EXTRA_LIST[id] : `the ${experienceById(id as ExperienceId)?.name.toLowerCase() ?? id}`);
function rowWords(ids: readonly string[], sideOf: (id: string) => Side): string {
  // A piece sent to the other side stands outermost there.
  const order = (side: Side, row: readonly string[], outerFirst: boolean) => {
    const mine = ids.filter((id) => sideOf(id) === side), own = row.filter((id) => mine.includes(id)), sent = mine.filter((id) => !own.includes(id));
    return (outerFirst ? [...sent, ...own] : [...own, ...sent]).map(inRow);
  };
  const left = order("left", ROW_LEFT, true), right = order("right", ROW_RIGHT, false);
  if (left.length + right.length < 2) return "";
  return `From left to right across the photograph, with open ground between each and the next: ${[...left, "the backdrop with the kids' table", ...right].join(", ")}.`;
}

/** A piece's name in the checklist. */
const pieceName = (id: string) => (isPartyExtra(id) ? EXTRA_LIST[id] : experienceById(id as ExperienceId)?.name.toLowerCase() ?? id);

/**
 * Each piece on its own (2026-11-05, a party photo of the owner's: the welcome board's words came out on the giveaways'
 * shelf, and the popcorn machine sat on the cake's cart).
 */
function apartWords(extras: readonly PartyExtra[], experiences: readonly ExperienceId[], main: string[], sideOf: (id: string) => Side): string {
  if (extras.length + experiences.length < 2) return "";
  const all = [...main, ...extras.map(pieceName), ...experiences.map(pieceName)];
  const has = (id: PartyExtra) => extras.includes(id);
  const carts = experiences.filter((id) => id === "popcorn" || id === "cotton_candy").map((id) => (id === "popcorn" ? "the popcorn cart" : "the cotton candy cart"));
  return [
    "Every piece stands on its own at its own place on the floor, a little apart from the others: never two pieces made into one, never one set on, in or against another, and only one of each — never a piece twice.",
    // 2026-11-06 test: the welcome board's words went onto the popcorn cart beside it.
    has("welcome") && carts.length ? `The welcome board stands alone on its easel; ${carts.join(" and ")} ${carts.length > 1 ? "carry" : "carries"} none of its words.` : "",
    has("welcome") && has("giveaways") ? "The welcome board and the giveaways' board or table are two separate things standing well apart: the welcome board's words only on the welcome board, the giveaway boxes only on their own board." : "",
    has("cake") && carts.length ? `The cake's stand or cart holds only the cake and its sweets; ${carts.join(" and ")} ${carts.length > 1 ? "are carts" : "is a cart"} of ${carts.length > 1 ? "their" : "its"} own, standing apart from it.` : "",
    has("pinata") ? "The piñata hangs alone from its own pole." : "",
    // 2026-11-07 test: with the cake kept in the middle, the giveaways' board slid out to the piñata's spot and the piñata sat on top of it.
    has("pinata") && has("giveaways") ? "The piñata's pole stands on the grass or floor well beyond the giveaways' board, open ground between them: the piñata hangs from its pole, never from, on or above the board." : "",
    // 2026-11-07 tests: twice the cake went small onto the top of the giveaways' board, then the welcome board did.
    has("cake") && has("giveaways") ? "The cake is on its own stand or little table, at its real size — never on the giveaways' board, its top or its shelves." : "",
    has("welcome") && has("giveaways") ? "The welcome board is on its own wooden easel — never on the giveaways' board, its top or its shelves." : "",
    rowWords([...extras, ...experiences], sideOf),
    has("helium") && (has("welcome") || has("giveaways")) ? `The helium balloons float only from their own weights: ${has("welcome") && has("giveaways") ? "the welcome board and the giveaways carry" : has("welcome") ? "the welcome board carries" : "the giveaways carry"} only the balloons their own pictures show.` : "",
    main.length ? `The photograph shows all ${all.length} of them, each once and none left out: ${all.join(", ")}.` : `All ${all.length} are added, each once and none left out: ${all.join(", ")}.`,
  ].filter(Boolean).join(" ");
}

const piece = (t: TableSetup, themeId: string, k: TableItemKey) => itemWords(t, themeId, k);

/** The words for the photograph: the pictures she has, stood together in her setting. */
export function partyPrompt(config: Pick<BuilderConfig, "table" | "decor" | "theme">, setting: PartySetting, pictures: { backdrop: boolean; table: boolean; refs?: TableItemKey[]; extras?: PartyExtra[]; sheet?: boolean; experiences?: ExperienceId[]; stations?: ExperienceId[] }): string {
  const t = pictures.table ? config.table : undefined;
  const tableImage = pictures.backdrop ? 2 : 1;
  const refs = t ? pictures.refs ?? [] : [];
  const extras = pictures.extras ?? [];
  // The pictures in order: the backdrop, the table's top view, the other parts' photos, then the table's and chair's own.
  const firstExtra = (pictures.backdrop ? 1 : 0) + (t ? 1 : 0) + 1;
  // The other parts each a picture of their own, or (too many for the engine) all on one sheet.
  const sheet = !!pictures.sheet && extras.length > 1;
  const extraImages = sheet ? 1 : extras.length;
  const xs = pictures.experiences ?? [];
  const xImage = firstExtra + extraImages;
  const image = (k: TableItemKey) => (refs.includes(k) ? xImage + (xs.length ? 1 : 0) + refs.indexOf(k) : 0);
  const extraWords = extras.map((e, i) => EXTRA_WORDS[e](sheet ? `picture ${i + 1} of image ${firstExtra}` : `image ${firstExtra + i}`, NATURAL_SIDE[e]));
  const nth = (n: number, of: number) => (of > 1 ? `picture ${n} of image ${xImage}` : `image ${xImage}`);
  const xWords = [...xs.map((id, i) => `${PARTY_EXPERIENCE_PHOTOS[id]!.words(NATURAL_SIDE[id])} exactly as ${nth(i + 1, xs.length)} shows it`), ...(pictures.stations ?? []).map((id) => STATION_WORDS[id]!(NATURAL_SIDE[id]))];
  const sheetWords = (n: number, what: string) => `Image ${n} is a sheet of ${what} laid side by side on white, numbered in reading order — left to right, the top row first; it is only a list of the pieces, never a layout to copy.`;
  // The table's photo is a shop's set table: only the table itself is hers (2026-11-04 test: its cups and toys came along).
  const named = refs.map((k) => (k === "table"
    ? `image ${image(k)} is the table she chose — copy only the table itself, its shape, top and legs; the chairs, cups, plates and everything else on or around it in that photo are not hers and stay out`
    : `image ${image(k)} is the chair she chose — every child's chair is this one, its shape, back and colour, never a chair from any other image`));
  const words = pictures.backdrop ? backdropWords(config.decor) : "";
  return [
    pictures.backdrop ? "Image 1 is the balloon backdrop designed for this children's birthday party." : "",
    // The top view is a cut of six places (2026-11-05 test: the photo copied its six chairs, not her ten).
    t ? `Image ${tableImage} shows the kids' party table designed for it, seen from above: its place setting — the placemat, the plates, the cup, the napkin, the cutlery and every other piece — and its colours. It is only a sample cut of a few places, never the count: the real table has ${t.kids} places, one at each chair.` : "",
    sheet ? sheetWords(firstExtra, "the other pieces she designed, one picture each") : "",
    xs.length > 1 ? sheetWords(xImage, "the party's activities, one picture each") : "",
    named.length ? `${named.join("; ").replace(/^i/, "I")}.` : "",
    "Make one real, natural photograph of the whole party setup exactly as she designed it, the way a party stylist photographs a finished setup: taken with a full-frame camera straight on from the front, a few metres back, from a little below standing height, facing the backdrop square on, everything in the picture.",
    pictures.backdrop
      ? `At the back stands the balloon backdrop of image 1, exactly as designed${words ? ` (${words})` : ""}: the same boards, stands and frames in the same shapes, sizes and colours, the same balloon garland in exactly the same balloon colours and fullness, the same printed words and pictures, nothing moved, added or left out — the printed words copied exactly, letter by letter. Every plinth in image 1 stays standing in front of the backdrop just as image 1 shows it, never hidden or left out, and bare on top as image 1 shows it — no cards, signs, letters or cakes on them.`
      : "",
    t
      ? `${pictures.backdrop ? "Centred in front of it and a little forward, its long side facing the camera, with the backdrop rising behind and above it and its plinths in view beside the table's ends," : "In the middle, its long side facing the camera,"} stands ${tableWords(t, config.theme, image)}. ${t.choices.table === "round" || t.choices.table === "flower" || onFloor(t.choices) ? "" : "The chairs on the near side are seen from behind, those along the far side face the camera. "}Every place is set exactly as image ${tableImage} shows — ${placeWords(t, config.theme) || "the same placemats, plates, cups, napkins and cutlery"} — the same colours and prints, each place the same, the table seen from the front at that height, not from above. Everything at the places lies flat or stands low as in image ${tableImage}: the placemats' words are printed flat on the paper; nothing stands up on the table — no cards, signs, place cards, standing letters or words — beyond ${piece(t, config.theme, "centrepiece") ? "the centrepiece in its middle" : "the pieces named"}.`
      : "",
    extraWords.length
      ? `Around them, in the same one setup and the same photograph, stand the other pieces she designed, each exactly as its own picture shows it — a drawing made into the real thing, a photo copied — at a believable real size beside the table and the backdrop, none hiding the backdrop or the table: ${extraWords.join("; ")}. The camera stands far enough back for every piece to be in the picture.`
      : "",
    apartWords(extras, [...xs, ...(pictures.stations ?? [])], [pictures.backdrop ? "the balloon backdrop" : "", t ? "the kids' table" : ""].filter(Boolean), (id) => NATURAL_SIDE[id] ?? "right"),
    xWords.length
      ? `Further out at the sides of the same setup, set up and ready with no one at them, stand the party's activities: ${xWords.join("; ")} — each its real size, whole in the picture, none in front of the backdrop or the tables.`
      : "",
    `The rooms, walls and floors the pictures show are only where they were drawn: leave them out, and set ${extraWords.length || xWords.length ? "every piece" : "the backdrop and the table"} up in this setting instead.`,
    SETTING[setting],
    LIGHT,
    "Nothing added: no people, no children, no cartoon or licensed characters, no extra decorations, furniture or words beyond those in the pictures.",
  ].filter(Boolean).join(" ");
}

/**
 * How many pieces one photograph takes in (2026-11-07, nine test renders: with five pieces one was always lost or set on
 * another — the giveaways' board and the welcome board, both white boards with her name, became one; with three, every
 * piece came out every time).
 */
export const PARTY_PASS = 3;
/** What the engine sets on the giveaways' shelves when they share a photograph (2026-11-07 tests): the cake went small onto its top, the welcome board became one with it. */
const SHELF_FOES: readonly string[] = ["welcome", "cake"];
/** Pairs the engine makes into one thing when they share a photograph: the two boards; the helium's theme foil and the theme-shaped piñata (2026-11-07: one unicorn head). */
const ALIKE: readonly (readonly [string, string])[] = [["welcome", "giveaways"], ["cake", "giveaways"], ["cake", "welcome"], ["helium", "pinata"]];
const alike = (a: string, b: string) => ALIKE.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
/**
 * The three that each spoil the other two in one photograph — the cake, the welcome board and the giveaways' board (the
 * owner's live render, 2026-11-07: the cake drawn onto the welcome board, its cupcakes on the easel's ledge) — can't
 * all be kept apart in two: with all three picked, the cake goes into the first photograph, with the backdrop and the
 * table, and the sides take the two boards.
 */
export function partyMainExtras(ids: readonly string[]): PartyExtra[] {
  return ["cake", "welcome", "giveaways"].every((id) => ids.includes(id)) ? ["cake"] : [];
}
/**
 * Four or five pieces: two photographs at once from the same first one, each with one side's pieces (NATURAL_SIDE), then
 * joined down the middle (stitchSides). The giveaways' board never shares a photograph with the cake or the welcome
 * board: they go to its other side. A side with too many sends its last movable pieces to the other. A piece already
 * in the first photograph (`inMiddle`, partyMainExtras) stands on its side's inner room and takes two of its places
 * (2026-11-07 test: with the cake there, the giveaways' board slid out to the piñata's spot and the piñata sat on it).
 * Null: one photograph takes them.
 */
export function partySides(ids: readonly string[], inMiddle: readonly string[] = []): { left: string[]; right: string[] } | null {
  if (ids.length <= PARTY_PASS && !inMiddle.length) return null;
  const shelves = ids.includes("giveaways");
  const fixed = (id: string) => shelves && (id === "giveaways" || SHELF_FOES.includes(id));
  const sideOf = (id: string): Side => (shelves && SHELF_FOES.includes(id) ? otherSide(NATURAL_SIDE.giveaways) : NATURAL_SIDE[id] ?? "right");
  // A piece in the first photograph stands in its side's inner room: one place of that side's (its white is all on
  // that side now, twice the room).
  const room = (side: Side) => PARTY_PASS - inMiddle.filter((id) => (NATURAL_SIDE[id] ?? "right") === side).length;
  const left = ids.filter((id) => sideOf(id) === "left"), right = ids.filter((id) => sideOf(id) === "right");
  if (ids.length <= PARTY_PASS && left.length <= room("left") && right.length <= room("right")) return null;
  // Never sent to a side where it would be made one with another piece.
  const balance = (from: string[], to: string[], fromSide: Side, toSide: Side) => {
    for (let i = from.length - 1; from.length > room(fromSide) && to.length < room(toSide) && i >= 0; i--) if (!fixed(from[i]) && !to.some((id) => alike(id, from[i]))) to.push(...from.splice(i, 1));
  };
  balance(left, right, "left", "right"); balance(right, left, "right", "left");
  return { left, right };
}

/**
 * The second of two photographs (2026-11-06, the owner: "saçmaladı render backdropta özellikle" — ten pieces in one
 * photo spoiled the backdrop, put the welcome board in twice and left the carts out): image 1 is the photograph of the
 * backdrop and the kids' table in the middle of a wider white canvas, kept as it is, and the pieces she picked are
 * added into the new room at its sides. Image 2 on: the parts, then the experiences' photos. With a `side`, this is
 * one of two photographs (partySides): every piece in it stands on that side, the other side stays open.
 */
export function partyAddPrompt(setting: PartySetting, pictures: { extras: PartyExtra[]; experiences?: ExperienceId[]; stations?: ExperienceId[]; /** Already in image 1 (partyMainExtras). */ there?: PartyExtra[] }, side?: Side): string {
  const extras = pictures.extras, there = pictures.there ?? [];
  const middle = ["its balloon backdrop", "its kids' table", ...there.map(pieceName)];
  const middleList = middle.length > 2 ? `${middle.slice(0, -1).join(", ")} and ${middle.at(-1)}` : middle.join(" and ");
  const xImage = 2 + extras.length;
  const xs = pictures.experiences ?? [], stations = pictures.stations ?? [];
  const sideOf = (id: string): Side => side ?? NATURAL_SIDE[id] ?? "right";
  // A piece already in image 1 holds its side's inner room (2026-11-07 test: the giveaways' board, told "near the right
  // end of the kids' table", took the cake's place and the cake was gone): what is added on that side stands beyond it.
  const beyond = there.filter((id) => !side || (NATURAL_SIDE[id] ?? "right") === side);
  const outward = (id: string, words: string) => {
    const past = beyond.filter((b) => (NATURAL_SIDE[b] ?? "right") === sideOf(id) && b !== id);
    return past.length ? words.replace(/ near the (left|right) end of the kids' table/, ` beyond ${past.map(pieceName).join(" and ")}, further out`) : words;
  };
  const extraWords = extras.map((e, i) => outward(e, EXTRA_WORDS[e](`image ${2 + i}`, sideOf(e))));
  const xWords = [...xs.map((id, i) => `${PARTY_EXPERIENCE_PHOTOS[id]!.words(sideOf(id))} exactly as image ${xImage + i} shows it`), ...stations.map((id) => STATION_WORDS[id]!(sideOf(id)))];
  const place = setting === "outdoor" ? "garden" : "room";
  const white = side ? `on the ${side}` : "at both sides";
  return [
    `Image 1 is the finished photograph of this children's birthday party — ${middleList} — set ${side ? `at the ${otherSide(side)} end` : "in the middle"} of a wider white canvas, white ${white}.`,
    `Make it one wider photograph of the same party: fill the white ${white} by carrying the same ${setting === "outdoor" ? "garden — the same lawn, hedges, trees and sky" : "room — the same floor, walls and windows"} — on outward, in the same light and seen by the same camera, seamless, with no frame, border or edge left.`,
    `Keep ${side ? "the photograph" : "the middle"} exactly as image 1 shows it: the backdrop with its boards, balloons, colours and words, the kids' table with its chairs and every place on it${there.length ? `, ${there.map(pieceName).join(" and ")} just as ${there.length > 1 ? "they stand" : "it stands"} there, on ${there.length > 1 ? "their" : "its"} own` : ""} — nothing in it moved, changed, redrawn, covered or taken away.`,
    // 2026-11-07, the owner: "table setup neden yok?" — the second photo had lost the kids' table.
    `The kids' table and its chairs stay in the photograph, in front of the backdrop just where image 1 has them: no other table, stand or piece ever takes their place. The backdrop and the table stay ${side ? "exactly where image 1 has them" : "in the very middle of the photograph"}, not slid left or right, not made bigger or smaller: the new room is only ${side ? `on the ${side}` : "at the sides"}.`,
    extraWords.length ? `In the wider space ${side ? `on the ${side} of them` : "at both sides of them"}, in the same photograph, add the other pieces she designed, each exactly as its own picture shows it — a drawing made into the real thing, a photo copied — at a believable real size, standing on the ground, none in front of the backdrop or the table: ${extraWords.join("; ")}.` : "",
    xWords.length ? `${extraWords.length ? "Further out" : "In the wider space"} ${side ? `on the ${side}` : "at the sides"}, set up and ready with no one at them, add the party's activities: ${xWords.join("; ")} — each its real size, whole in the picture, none in front of the backdrop or the tables.` : "",
    side ? `Everything added stands on the ${side} of the backdrop and the kids' table; the ${otherSide(side)} side of the photograph stays open ${place}, with nothing added there.` : "",
    there.includes("cake") ? `The cake of image 1 stays where it is, on its own stand, the only cake in the photograph: no second cake anywhere, none on the kids' table${extras.includes("giveaways") ? ", nothing of it on the giveaways' board or its shelves" : ""}.` : "",
    beyond.length ? `${beyond.map(pieceName).join(" and ").replace(/^./, (c) => c.toUpperCase())} of image 1 ${beyond.length > 1 ? "are" : "is"} part of the photograph to keep, exactly where image 1 has ${beyond.length > 1 ? "them" : "it"}, never replaced, moved or covered: every piece added on the ${side ?? "same side"} stands further out than ${beyond.length > 1 ? "them" : "it"}, beyond, with open ground between.` : "",
    apartWords(extras, [...xs, ...stations], [], sideOf),
    "The rooms, walls and floors the other pictures show are only where they were drawn: leave them out; every piece added stands in the setting of image 1, in its light, with soft natural shadows on the ground.",
    "Nothing else added: no people, no children, no cartoon or licensed characters, no extra decorations, furniture or words beyond those in the pictures.",
  ].filter(Boolean).join(" ");
}
