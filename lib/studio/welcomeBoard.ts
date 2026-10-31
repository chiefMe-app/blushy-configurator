// The welcome board (2026-10-31, the owner: "şimdi welcome board'a geçelim";
// "welcome board istemiyorsa skip edebilmeli"): the Decor step's third part,
// after the tables. A printed board at the entrance with the customer's words,
// on the theme's own art (the placemat designs, lib/studio/tableCatalog.ts) or
// a plain colour, drawn live as the customer chooses. Prices are placeholders
// until the owner sets them (TO CONFIRM). Pure data and sums.
import { TABLE_FONTS } from "./tableFonts";

export interface BoardSize { id: string; name: string; note: string; w: number; h: number; price: number }
/** Portrait boards, in centimetres. */
export const BOARD_SIZES: BoardSize[] = [
  { id: "a1", name: "A1", note: "60 × 84 cm", w: 60, h: 84, price: 180 },
  { id: "medium", name: "Medium", note: "70 × 100 cm", w: 70, h: 100, price: 250 },
  { id: "large", name: "Large", note: "80 × 120 cm", w: 80, h: 120, price: 320 },
];

export const BOARD_SHAPES = [
  { id: "rectangle", name: "Rectangle" },
  { id: "arch", name: "Arch top" },
] as const;
export type BoardShape = (typeof BOARD_SHAPES)[number]["id"];

/** The board's face: the theme's art (as on the placemats), or a plain colour. */
export const BOARD_DESIGNS = [
  { id: "watercolour", name: "Watercolour", note: "The theme's soft wash, shapes in the corners" },
  { id: "sparkle", name: "Sparkle", note: "The theme's glittering design" },
  { id: "plain", name: "Plain colour", note: "One colour you pick" },
] as const;
export type BoardDesign = (typeof BOARD_DESIGNS)[number]["id"];

export const BOARD_MATERIALS = [
  { id: "foam", name: "Foam board", note: "Light, matt print", extra: 0 },
  { id: "acrylic", name: "Acrylic", note: "Glossy and rigid, keeps for years", extra: 150 },
] as const;
export type BoardMaterial = (typeof BOARD_MATERIALS)[number]["id"];

export const BOARD_STANDS = [
  { id: "easel", name: "Easel", note: "A white easel to stand it on", extra: 40 },
  { id: "none", name: "No stand", note: "You have a stand or a wall", extra: 0 },
] as const;
export type BoardStand = (typeof BOARD_STANDS)[number]["id"];

export interface WelcomeBoard {
  /** false: the customer skipped it. */
  enabled: boolean;
  size: string;
  shape: BoardShape;
  design: BoardDesign;
  /** The plain board's colour. */
  colour: string;
  material: BoardMaterial;
  stand: BoardStand;
  /** The words, top to bottom: a small heading, the name (big, in the lettering), a line under it. */
  heading: string;
  name: string;
  line: string;
  /** The name's lettering (lib/studio/tableFonts.ts). */
  font: string;
  /** The words' colour, once the customer picks one; the theme's accent until then. */
  textColor?: string;
  /** The customer pressed Finish (they may still change it). */
  done?: boolean;
}

export const MAX_BOARD_TEXT = 30;

/** Words: no markup or control characters, single spaces, at most 30. */
export function cleanBoardText(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.replace(/[\u0000-\u001f<>{}[\]\\/"`$^*=|~#%@+;:_]/g, "").replace(/\s+/g, " ").slice(0, MAX_BOARD_TEXT);
}

export function defaultWelcomeBoard(theme: { backdropColors: string[]; accent: string }): WelcomeBoard {
  return {
    enabled: true, size: "medium", shape: "arch", design: "watercolour",
    colour: theme.backdropColors[0] ?? "#FFFFFF", material: "foam", stand: "easel",
    heading: "Welcome to", name: "", line: "", font: "birthstone-bounce",
  };
}

export const boardSize = (b: Pick<WelcomeBoard, "size">) => BOARD_SIZES.find((s) => s.id === b.size) ?? BOARD_SIZES[1];
export const boardWordsColour = (b: Pick<WelcomeBoard, "textColor">, theme: { accent: string }) => b.textColor ?? theme.accent;
/** The theme's art for the board's face, if it has one. */
export const boardArt = (b: Pick<WelcomeBoard, "design">, themeId: string) => (b.design === "plain" ? null : `/design/table/placemats/${themeId}/${b.design}.webp`);

export function welcomePriceLines(b: WelcomeBoard): { label: string; amount: number }[] {
  if (!b.enabled) return [];
  const size = boardSize(b);
  const material = BOARD_MATERIALS.find((m) => m.id === b.material)!;
  const stand = BOARD_STANDS.find((s) => s.id === b.stand)!;
  const lines = [{ label: `Welcome board, ${size.name} ${size.note}`, amount: size.price }];
  if (material.extra) lines.push({ label: `${material.name} board`, amount: material.extra });
  if (stand.extra) lines.push({ label: stand.name, amount: stand.extra });
  return lines;
}

export const welcomeTotal = (b: WelcomeBoard) => welcomePriceLines(b).reduce((s, l) => s + l.amount, 0);

const HEX = /^#[0-9A-F]{6}$/i;
const oneOf = <T extends string>(list: readonly { id: T }[], v: unknown, d: T): T => list.find((x) => x.id === v)?.id ?? d;

/** A stored welcome board read back over the defaults. */
export function readWelcomeBoard(raw: unknown, theme: { backdropColors: string[]; accent: string }): WelcomeBoard | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const base = defaultWelcomeBoard(theme);
  return {
    enabled: r.enabled !== false,
    size: oneOf(BOARD_SIZES, r.size, base.size),
    shape: oneOf(BOARD_SHAPES, r.shape, base.shape),
    design: oneOf(BOARD_DESIGNS, r.design, base.design),
    colour: typeof r.colour === "string" && HEX.test(r.colour) ? r.colour : base.colour,
    material: oneOf(BOARD_MATERIALS, r.material, base.material),
    stand: oneOf(BOARD_STANDS, r.stand, base.stand),
    heading: typeof r.heading === "string" ? cleanBoardText(r.heading) : base.heading,
    name: cleanBoardText(r.name),
    line: cleanBoardText(r.line),
    font: oneOf(TABLE_FONTS, r.font, base.font),
    ...(typeof r.textColor === "string" && HEX.test(r.textColor) ? { textColor: r.textColor } : {}),
    ...(r.done === true ? { done: true } : {}),
  };
}
