// The whole party in one photograph (2026-11-04, the owner: "Tasarladığımız Backdrop+table setup beraber
// görebilceğimiz bir render alsın ama bu sayfada outdoor yada indoor işaretlesin ona göre görsel üretelim"): on the
// Venue step, the backdrop she designed (its render, or its live sketch) and her kids' table (its render, or its
// drawing) stood together, indoors or outdoors as she marks it. Shared by the route (app/api/party-render) and the
// builder (is the picture still current?).
import type { BackdropShapeId, BuilderConfig, DecorConfig } from "@/lib/config";
import { hexToColorName } from "@/lib/generatePrompt";
import { onFloor, type TableItemKey } from "./tableCatalog";
import { tableCounts, type TableSetup } from "./tableSetup";
import { itemWords, referencePictures, tableRenderKey } from "./tableRender";

export type PartySetting = "indoor" | "outdoor";

/** What there is to stand together: the backdrop (unless skipped), the kids' table (if she made one). */
export function partyPieces(config: Pick<BuilderConfig, "decor" | "table">): { backdrop: boolean; table: boolean } {
  return {
    backdrop: config.decor.backdropChoice !== "skip" && config.decor.backdropItems.length > 0,
    table: !!config.table?.enabled,
  };
}

/** Changes with the backdrop, the table, the theme or the setting: what the photograph shows. */
export function partyRenderKey(config: Pick<BuilderConfig, "decor" | "table" | "theme">, setting: PartySetting): string {
  const p = partyPieces(config);
  const s = JSON.stringify([setting, config.theme, p.backdrop ? config.decor : null, p.table && config.table ? tableRenderKey(config.table, config.theme) : null]);
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
  return referencePictures(t, themeId).filter((r) => PARTY_REFS.includes(r.key));
}

const SHAPE: Partial<Record<BackdropShapeId, string>> = {
  arch: "arch board", half_arch: "half-arch side board", round: "round board", rect: "rectangular board", banner: "printed banner",
  open_arch_frame: "open arch frame", shimmer_wall: "shimmer wall", balloon_ring: "balloon ring", wavy: "wavy board",
};

/** The backdrop's pieces in words: each board with its size and colour, the plinths. */
export function backdropWords(decor: Pick<DecorConfig, "backdropItems" | "backdropColor" | "plinths">): string {
  const boards = decor.backdropItems.map((i) => {
    const colour = hexToColorName(i.color || decor.backdropColor);
    const size = i.widthCm && i.heightCm ? `${i.widthCm} × ${i.heightCm} cm` : "";
    return [colour, SHAPE[i.type] ?? "board", size ? `(${size})` : ""].filter(Boolean).join(" ");
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

const piece = (t: TableSetup, themeId: string, k: TableItemKey) => itemWords(t, themeId, k);

/** The words for the photograph: the pictures she has, stood together in her setting. */
export function partyPrompt(config: Pick<BuilderConfig, "table" | "decor" | "theme">, setting: PartySetting, pictures: { backdrop: boolean; table: boolean; refs?: TableItemKey[] }): string {
  const t = pictures.table ? config.table : undefined;
  const tableImage = pictures.backdrop ? 2 : 1;
  const refs = t ? pictures.refs ?? [] : [];
  const image = (k: TableItemKey) => (refs.includes(k) ? tableImage + 1 + refs.indexOf(k) : 0);
  // The table's photo is a shop's set table: only the table itself is hers (2026-11-04 test: its cups and toys came along).
  const named = refs.map((k) => (k === "table"
    ? `image ${image(k)} is the table she chose — copy only the table itself, its shape, top and legs; the chairs, cups, plates and everything else on or around it in that photo are not hers and stay out`
    : `image ${image(k)} is the chair she chose`));
  const words = pictures.backdrop ? backdropWords(config.decor) : "";
  return [
    pictures.backdrop ? "Image 1 is the balloon backdrop designed for this children's birthday party." : "",
    // The top view is a cut of six places (2026-11-05 test: the photo copied its six chairs, not her ten).
    t ? `Image ${tableImage} shows the kids' party table designed for it, seen from above: its place setting — the placemat, the plates, the cup, the napkin, the cutlery and every other piece — and its colours. It is only a sample cut of a few places, never the count: the real table has ${t.kids} places, one at each chair.` : "",
    named.length ? `${named.join("; ").replace(/^i/, "I")}.` : "",
    "Make one real, natural photograph of the whole party setup exactly as she designed it, the way a party stylist photographs a finished setup: taken with a full-frame camera straight on from the front, a few metres back, from a little below standing height, facing the backdrop square on, everything in the picture.",
    pictures.backdrop
      ? `At the back stands the balloon backdrop of image 1, exactly as designed${words ? ` (${words})` : ""}: the same boards, stands and frames in the same shapes, sizes and colours, the same balloon garland in exactly the same balloon colours and fullness, the same printed words and pictures, nothing moved, added or left out — the printed words copied exactly, letter by letter. Every plinth in image 1 stays standing in front of the backdrop just as image 1 shows it, never hidden or left out, and bare on top as image 1 shows it — no cards, signs, letters or cakes on them.`
      : "",
    t
      ? `${pictures.backdrop ? "Centred in front of it and a little forward, its long side facing the camera, with the backdrop rising behind and above it and its plinths in view beside the table's ends," : "In the middle, its long side facing the camera,"} stands ${tableWords(t, config.theme, image)}. ${t.choices.table === "round" || t.choices.table === "flower" || onFloor(t.choices) ? "" : "The chairs on the near side are seen from behind, those along the far side face the camera. "}Every place is set exactly as image ${tableImage} shows — ${placeWords(t, config.theme) || "the same placemats, plates, cups, napkins and cutlery"} — the same colours and prints, each place the same, the table seen from the front at that height, not from above. Everything at the places lies flat or stands low as in image ${tableImage}: the placemats' words are printed flat on the paper; nothing stands up on the table — no cards, signs, place cards, standing letters or words — beyond ${piece(t, config.theme, "centrepiece") ? "the centrepiece in its middle" : "the pieces named"}.`
      : "",
    "The rooms, walls and floors the pictures show are only where they were drawn: leave them out, and set the backdrop and the table up in this setting instead.",
    SETTING[setting],
    LIGHT,
    "Nothing added: no people, no children, no cartoon or licensed characters, no extra decorations, furniture or words beyond those in the pictures.",
  ].filter(Boolean).join(" ");
}
