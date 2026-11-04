// The whole party in one photograph (2026-11-04, the owner: "Tasarladığımız Backdrop+table setup beraber
// görebilceğimiz bir render alsın ama bu sayfada outdoor yada indoor işaretlesin ona göre görsel üretelim"): on the
// Venue step, the backdrop she designed (its render, or its live sketch) and her kids' table (its render, or its
// drawing) stood together, indoors or outdoors as she marks it. Shared by the route (app/api/party-render) and the
// builder (is the picture still current?).
import type { BuilderConfig } from "@/lib/config";
import { hexToColorName } from "@/lib/generatePrompt";
import { onFloor, tableOption } from "./tableCatalog";
import { tableCounts, type TableSetup } from "./tableSetup";
import { tableRenderKey } from "./tableRender";

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

/** The table in a few words: how many tables, and for how many children. */
function tableWords(t: TableSetup): string {
  const { tables } = tableCounts(t);
  const kind = tableOption("table", t.choices.table)?.name?.toLowerCase();
  const floor = onFloor(t.choices);
  const cloth = hexToColorName(t.clothColor);
  return [
    `${tables > 1 ? `${tables} kids' party tables` : "one kids' party table"}${kind ? ` (${kind})` : ""}`,
    floor ? "low to the floor, with soft floor cushions for the children" : "with its little chairs",
    `laid for ${t.kids} children`,
    cloth ? `under a ${cloth} tablecloth` : "",
  ].filter(Boolean).join(", ");
}

/** The words for the photograph: the pictures she has, stood together in her setting. */
export function partyPrompt(config: Pick<BuilderConfig, "table">, setting: PartySetting, pictures: { backdrop: boolean; table: boolean }): string {
  const t = pictures.table ? config.table : undefined;
  const tableImage = pictures.backdrop ? 2 : 1;
  return [
    pictures.backdrop ? "Image 1 is the balloon backdrop designed for this children's birthday party." : "",
    t ? `Image ${tableImage} shows the kids' party table designed for it, seen from above: its place setting — the placemat, the plates, the cup, the napkin, the cutlery and every other piece — and its colours.` : "",
    `Make one real, natural photograph of the whole party setup, taken with a full-frame camera from standing height a few metres back, at a gentle three-quarter angle, everything in the picture.`,
    pictures.backdrop
      ? "At the back stands the balloon backdrop of image 1, exactly as designed: the same boards, stands and frames in the same shapes, sizes and colours, the same balloon garland in exactly the same balloon colours and fullness, the same printed words and pictures, nothing moved, added or left out — the printed words copied exactly, letter by letter. Every plinth, pedestal or cylinder stand in image 1 stays standing in front of the backdrop just as image 1 shows it, never hidden or left out."
      : "",
    t
      ? `${pictures.backdrop ? "In front of it, a little further forward so the backdrop and its plinths show clearly, stands" : "In the middle stands"} ${tableWords(t)}: every place set exactly as image ${tableImage} shows — the same tableware, the same colours and prints, each place the same — the table seen from the side at that angle, not from above.`
      : "",
    "The rooms, walls and floors the pictures show are only where they were drawn: leave them out, and set the backdrop and the table up in this setting instead.",
    SETTING[setting],
    LIGHT,
    "Nothing added: no people, no children, no cartoon or licensed characters, no extra decorations, furniture or words beyond those in the pictures.",
  ].filter(Boolean).join(" ");
}
