// Giveaways (2026-11-03, the owner: "giveaway boxlarından hazırlanabilir bir çeşit box olsun şimdilik her temaya
// göre bir tasarımı olsun … boxın içindekileri görsel olarak değil şimdilik liste olarak verelim … bu box'ı masaya mı
// yoksa giveaway board mu istiyor onun seçimini yapsın … board rengi vs customizable olacak"): the Decor step's
// fourth part, after the welcome board. One box for now — a white gable box dressed in the theme (its placemat
// print, its picture as a sticker, a name plate and the age) — what goes in it as a list, one box a child, set at
// each place on the kids' table or on a shelved arch board in a colour of the customer's. Prices are placeholders
// until the owner sets them (TO CONFIRM). Pure data and sums.
import { TABLE_FONTS } from "./tableFonts";
import { cleanBoardText } from "./welcomeBoard";

/** What goes in each box, by name (no pictures for now). Placeholder prices a box. */
export const GIVEAWAY_CONTENTS = [
  { id: "playdough", name: "Playdough", note: "A little tub", price: 6 },
  { id: "bubbles", name: "Bubbles", note: "A bubble wand", price: 5 },
  { id: "candy", name: "Candy", note: "A small bag of sweets", price: 6 },
  { id: "stickers", name: "Stickers", note: "A sheet in the theme", price: 4 },
  { id: "themed", name: "Themed items", note: "Little toys in the theme", price: 12 },
] as const;
export type GiveawayContent = (typeof GIVEAWAY_CONTENTS)[number]["id"];

export const GIVEAWAY_PLACES = [
  { id: "table", name: "On the table", note: "One at each place on the kids' table" },
  { id: "board", name: "On a giveaway board", note: "An arch board with shelves, by the door" },
] as const;
export type GiveawayPlace = (typeof GIVEAWAY_PLACES)[number]["id"];

/** The gable box, dressed in the theme (placeholder). */
export const BOX_PRICE = 18;
/** The shelved arch board, 60 × 150 cm (placeholder). */
export const GIVEAWAY_BOARD_PRICE = 350;
/** Boxes the board's four shelves show (three a shelf). */
export const BOARD_SHOWS = 12;
export const MAX_BOXES = 60;

export interface Giveaways {
  /** false: the customer skipped them. */
  enabled: boolean;
  /** Boxes: one a child. */
  count: number;
  place: GiveawayPlace;
  contents: GiveawayContent[];
  /** On the box's name plate, and on the board. */
  name: string;
  /** The big number on the box. */
  age: string;
  /** The name's lettering (lib/studio/tableFonts.ts). */
  font: string;
  /** The board's colour. */
  boardColour: string;
  /** The line under the name on the board. */
  boardLine: string;
  /** The customer pressed Finish (they may still change it). */
  done?: boolean;
  /** The last render (2026-11-03), kept in the customer's folder: giveawaysRenderKey of what it shows. */
  render?: { key: string; path: string };
}

export function defaultGiveaways(seed: { kids?: number; name?: string; age?: string } = {}): Giveaways {
  return {
    enabled: true, count: clampCount(seed.kids ?? 10), place: "table", contents: ["playdough", "bubbles", "candy", "stickers", "themed"],
    name: cleanBoardText(seed.name ?? ""), age: cleanAge(seed.age ?? ""), font: "sacramento", boardColour: "#FFFFFF", boardLine: "Thank you for coming",
  };
}

export const clampCount = (n: unknown) => Math.max(1, Math.min(MAX_BOXES, Math.round(Number(n) || 1)));
/** One or two digits. */
export const cleanAge = (v: unknown) => (typeof v === "string" ? v.replace(/\D/g, "").slice(0, 2) : "");

export function giveawayPriceLines(g: Giveaways): { label: string; amount: number }[] {
  if (!g.enabled) return [];
  const inside = GIVEAWAY_CONTENTS.filter((c) => g.contents.includes(c.id));
  const each = BOX_PRICE + inside.reduce((s, c) => s + c.price, 0);
  const lines = [{ label: `Giveaway boxes × ${g.count}${inside.length ? ` (${inside.map((c) => c.name.toLowerCase()).join(", ")})` : ""}`, amount: each * g.count }];
  if (g.place === "board") lines.push({ label: "Giveaway board", amount: GIVEAWAY_BOARD_PRICE });
  return lines;
}
export const giveawaysTotal = (g: Giveaways) => giveawayPriceLines(g).reduce((s, l) => s + l.amount, 0);

const HEX = /^#[0-9A-F]{6}$/i;
const RENDER_PATH = /^[0-9a-z-]{1,64}\/[0-9a-z]{1,40}\.jpg$/i;

/** Stored giveaways read back over the defaults. */
export function readGiveaways(raw: unknown): Giveaways | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const base = defaultGiveaways();
  const kept = r.render as Record<string, unknown> | null;
  return {
    enabled: r.enabled !== false,
    count: r.count === undefined ? base.count : clampCount(r.count),
    place: GIVEAWAY_PLACES.find((p) => p.id === r.place)?.id ?? base.place,
    contents: Array.isArray(r.contents) ? GIVEAWAY_CONTENTS.filter((c) => (r.contents as unknown[]).includes(c.id)).map((c) => c.id) : base.contents,
    name: cleanBoardText(r.name),
    age: cleanAge(r.age),
    font: TABLE_FONTS.find((f) => f.id === r.font)?.id ?? base.font,
    boardColour: typeof r.boardColour === "string" && HEX.test(r.boardColour) ? r.boardColour : base.boardColour,
    boardLine: typeof r.boardLine === "string" ? cleanBoardText(r.boardLine) : base.boardLine,
    ...(r.done === true ? { done: true } : {}),
    ...(kept && typeof kept === "object" && typeof kept.key === "string" && /^[a-z0-9]{1,13}$/.test(kept.key) && typeof kept.path === "string" && RENDER_PATH.test(kept.path)
      ? { render: { key: kept.key, path: kept.path } } : {}),
  };
}

/** Changes whenever anything that shows in the picture changes (on the table, the table too: its key). */
export function giveawaysRenderKey(g: Giveaways, themeId: string, tableKey = ""): string {
  // The count and the contents do not show (one box a place; what is inside is a list).
  const shown = { place: g.place, name: g.name, age: g.age, font: g.font, ...(g.place === "board" ? { boardColour: g.boardColour, boardLine: g.boardLine } : { tableKey }) };
  const s = JSON.stringify([themeId, shown]);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

/** The box's photo and where its front panel is in it (scripts/giveaways/README: white gable box, cut out). */
export const BOX_PHOTO = { src: "/design/giveaways/box.webp", shade: "/design/giveaways/box-shade.webp", w: 562, h: 736, panel: { x: 4, y: 282, w: 553, h: 450 } };
/**
 * The board's photo (an empty white arch board with four shelves, in a room), its outline and where the boxes
 * stand: the tops of its shelves, three boxes to a shelf.
 */
export const BOARD_PHOTO = {
  src: "/design/giveaways/board.webp", w: 896, h: 1152,
  board: { x0: 245, x1: 626, top: 105, bottom: 1075 },
  shelves: [415, 568, 725, 895],
  /** A box on a shelf, its height. */
  boxH: 118,
  /** The arch's clear space for the words, above the first shelf's boxes. */
  words: { cx: 435, top: 150, bottom: 285, w: 300 },
};
/** The board's outline in the photo: a rectangle with a round top. */
export function boardOutline(): string {
  const { x0, x1, top, bottom } = BOARD_PHOTO.board;
  const r = (x1 - x0) / 2;
  return `M ${x0} ${bottom} V ${top + r} A ${r} ${r} 0 0 1 ${x1} ${top + r} V ${bottom} Z`;
}
