// The builder's top view of one place (2026-10-29, the owner: "top view
// renderlarda bütün opsiyonların renderını alıp sonra onları preview olarak
// kullanmak istiyorum … sadece yazılar değişecek … render olmayacak"): the
// chosen pieces, each photographed once from straight above
// (scripts/table/top-render.mjs, cut out by scripts/table/top-prepare.ts), laid
// where the owner sets them, round the place in the middle of the table, with
// the next places carrying on at the sides. This file only works out what goes
// where; components/studio/table/TablePlace.tsx draws it. Every measure is in
// centimetres; in the picture x runs to the child's right and y towards the
// child (the child sits at the bottom). 2026-10-29 (owner, with a flat-lay
// photo): only the table top — no chairs, no floor — with the two places
// facing each other across it (side by side round a round table).
import { NONE, foilOf, tableOption } from "./tableCatalog";
import { arrangeTables, focusSeats, type Pt, type Seat } from "./tableShapes";
import { itemColour, nameColour, wordsColour, wordsOn, type TableSetup } from "./tableSetup";
import { asPrinted, tableFont } from "./tableFonts";
import PIECES from "./tableTopPieces.json";

/** The picture's frame (cm, 4:3), round the two places: placeView. */
export interface PlaceView { x: number; y: number; w: number; h: number }
/** What one place takes up round its middle, cup, bottle and hat included (cm, its own frame). */
const PLACE_BOX = { x0: -24, x1: 28, y0: -23, y1: 15 };

const DIR = "/design/table/top";
type PieceName = keyof typeof PIECES;
const piece = (name: PieceName) => `${DIR}/${name}.webp`;
/** A piece's height for a width (its picture's own proportions). */
const tall = (name: PieceName, w: number) => (w * PIECES[name].h) / PIECES[name].w;

/** How high a piece stands (cm): its shadow's offset and softness. */
export type Lift = number;

export type PlaceNode =
  /** The table top (or its cloth), the floor round it. */
  | { k: "top"; pts: Pt[]; fill: string; cloth: boolean }
  /** A piece's picture centred on (x, y), w wide, turned rot degrees; a white piece may be tinted, printed with a design, or in a foil (FOILS). */
  | { k: "img"; src: string; x: number; y: number; w: number; h: number; rot?: number; tint?: string; print?: string; foil?: string; lift: Lift; id: string }
  /** A printed sheet: the placemat (the design, or a plain colour). */
  | { k: "sheet"; x: number; y: number; w: number; h: number; art?: string; fill?: string; lift: Lift; id: string }
  /** The napkin band, a strip in its colour. */
  | { k: "band"; x: number; y: number; w: number; h: number; fill: string; id: string }
  /** Words in their face (./tableFonts), stacked one word a line in the placemat's bottom-right corner. */
  | { k: "matWords"; lines: string[]; font: string; colour: string; id: string }
  /** Words fitted into a box (the name on its tag), in a face. */
  | { k: "words"; lines: string[]; face: "elegant" | "script"; colour: string; x: number; y: number; w: number; h: number; id: string }
  /** The water bottle and its label: the design or a colour, with the words. */
  | { k: "bottle"; x: number; y: number; w: number; h: number; label: [number, number, number, number]; art?: string; fill?: string; words?: string; font: string; colour: string; id: string }
  /** A place, turned to its seat. */
  | { k: "group"; x: number; y: number; rot: number; nodes: PlaceNode[]; id: string; focus: boolean };


/** One place's pieces, in its own frame (x to the child's right, y towards the child). */
function setting(t: TableSetup, theme: { id: string; balloonColors: string[]; accent: string }, id: string): PlaceNode[] {
  const ch = t.choices, nodes: PlaceNode[] = [];
  const colour = (k: Parameters<typeof itemColour>[1]) => itemColour(t, k);
  const words = wordsColour(t, theme);
  const mat = tableOption("placemats", ch.placemats);
  if (mat) {
    nodes.push({ k: "sheet", x: 0, y: 0, w: 42, h: 29.7, ...(mat.themed ? { art: `/design/table/placemats/${theme.id}/${mat.id}.webp` } : { fill: colour("placemats") ?? "#FFFFFF" }), lift: 0.05, id: `${id}-mat` });
    const w = wordsOn(t, "placemats");
    if (w) nodes.push({ k: "matWords", lines: asPrinted(w, tableFont(t.placematFont)).split(/\s+/), font: tableFont(t.placematFont).id, colour: words, id: `${id}-matwords` });
  }
  // The big plate with the small one in it (2026-10-29: nothing in the small one).
  // Each in a colour or a foil (2026-10-29: "iridescent, silver, gold metallic renk olarak girsin").
  const finish = (c: string) => (foilOf(c) ? { foil: c } : { tint: c });
  const plates = `plates-plain-${t.plateShape}` as PieceName;
  if (PIECES[plates]) nodes.push({ k: "img", src: piece(plates), x: 0, y: 0, w: 23, h: tall(plates, 23), ...finish(t.plateColor), lift: 0.4, id: `${id}-plates` });
  // The small plate in its own colour (2026-10-29: "içindeki tabağın rengi farklı seçilebilsin, bir de tabak olduğu anlaşılsın"):
  // the same plate, smaller, over the big one's middle, with its own rim and shadow.
  if (PIECES[plates]) nodes.push({ k: "img", src: piece(plates), x: 0, y: 0, w: 23 * 0.76, h: tall(plates, 23 * 0.76), ...finish(t.smallPlateColor), lift: 0.6, id: `${id}-small-plate` });
  // On the left: the folded napkin, the cutlery lying on it (2026-10-29, the
  // owner: "peçete her zaman cutlery'nin altında olmalı"), the band round both.
  const printed = ch.napkins === "printed" ? `/design/table/placemats/${theme.id}/pattern.webp` : undefined;
  nodes.push({ k: "img", src: piece("pocket"), x: -16.6, y: 1.5, w: 8.6, h: tall("pocket", 8.6), ...(printed ? { print: printed } : { tint: colour("napkins") ?? "#FFFFFF" }), lift: 0.2, id: `${id}-napkin` });
  const cutlery = `cutlery-${ch.cutlery}` as const;
  [0, 1, 2].forEach((k) => {
    const name = `${cutlery}-${k}` as PieceName;
    if (PIECES[name]) nodes.push({ k: "img", src: piece(name), x: -18.5 + k * 1.9, y: 1.5, w: (16.5 * PIECES[name].w) / PIECES[name].h, h: 16.5, rot: (k - 1) * 2, lift: 0.4, id: `${id}-cutlery-${k}` });
  });
  if (ch.cutleryHolder !== NONE) {
    nodes.push({ k: "band", x: -16.6, y: 1.5, w: 8.4, h: 4.2, fill: colour("cutleryHolder") ?? "#FFFFFF", id: `${id}-band` });
    // The name printed on the band itself, no tag (2026-10-29: "bir bütün olsun, o minik beyaz kısmı olmasın").
    const name = wordsOn(t, "cutleryHolder");
    if (name) nodes.push({ k: "words", lines: [name], face: "script", colour: nameColour(t, theme), x: -16.6, y: 1.5, w: 7.4, h: 3.4, id: `${id}-name` });
  }
  // The cup on the top-right corner, white inside, lying on its side (2026-10-29: "cup daha yatay"); the bottle beside it.
  if (ch.cups !== NONE) {
    const cup = { x: 15.2, y: -11, rot: CUP_TURN };
    nodes.push({ k: "img", src: piece("cup-plain-in"), ...cup, w: 8.6, h: tall("cup-plain-in", 8.6), lift: 1.2, id: `${id}-cup-in` });
    nodes.push({ k: "img", src: piece("cup-plain-out"), ...cup, w: 8.6, h: tall("cup-plain-out", 8.6), ...finish(t.cupColor), lift: 0, id: `${id}-cup-out` });
  }
  const label = tableOption("bottleLabel", ch.bottleLabel);
  if (label) {
    const w = wordsOn(t, "bottleLabel");
    nodes.push({ k: "bottle", x: 23.4, y: -4, w: 6.4, h: tall("bottle", 6.4), label: PIECES.bottle.label as [number, number, number, number],
      ...(label.themed ? { art: `/design/table/placemats/${theme.id}/${label.id}.webp` } : { fill: colour("bottleLabel") ?? "#FFFFFF" }), ...(w ? { words: asPrinted(w, tableFont(t.labelFont)) } : {}), font: tableFont(t.labelFont).id, colour: words, id: `${id}-bottle` });
  }
  // The cone hat on its side, top-left, in the customer's colour (2026-10-29).
  if (ch.partyHats === "cone") nodes.push({ k: "img", src: piece("hat-cone"), x: -14.5, y: -17.5, w: (11 * PIECES["hat-cone"].w) / PIECES["hat-cone"].h, h: 11, tint: colour("partyHats") ?? t.hatColor, lift: 2, id: `${id}-hat` });
  return nodes;
}

/** How the standing cup's photo is turned to lie on its side, its mouth to the upper left (degrees). */
const CUP_TURN = 115;

/** The focus place and the plan in the picture's frame. */
function frame(t: TableSetup) {
  const { tables } = arrangeTables(t);
  const table = tables[0];
  const [a, b] = focusSeats(table);
  const focus = table.kind === "round" || table.kind === "flower" ? a : b;
  // The plan has y down; a place's forward is towards the table, its right the child's right.
  const fwd = (s: Seat): Pt => [Math.cos(s.facing), Math.sin(s.facing)];
  const right = (s: Seat): Pt => [-Math.sin(s.facing), Math.cos(s.facing)];
  const centre = (s: Seat): Pt => [s.ex + fwd(s)[0] * 17, s.ey + fwd(s)[1] * 17];
  const C = centre(focus), F = fwd(focus), R = right(focus);
  /** A plan point in the picture: x to the child's right, y towards the child. */
  const at = ([px, py]: Pt): Pt => { const dx = px - C[0], dy = py - C[1]; return [dx * R[0] + dy * R[1], -(dx * F[0] + dy * F[1])]; };
  /** How far a seat's frame is turned in the picture, degrees. */
  const turn = (s: Seat) => { const r = right(s); return (Math.atan2(-(r[0] * F[0] + r[1] * F[1]), r[0] * R[0] + r[1] * R[1]) * 180) / Math.PI; };
  // The other place in the picture: across the table, or beside it round a round one.
  const other = focus === a ? b : a;
  return { table, focus, other, at, turn, centre };
}

/** The picture's frame: the two places and a little round them, 4:3. */
export function placeView(t: TableSetup): PlaceView {
  const { focus, other, at, turn, centre } = frame(t);
  const pts = [focus, other].flatMap((s) => {
    const [cx, cy] = at(centre(s)), r = (turn(s) * Math.PI) / 180;
    return [[PLACE_BOX.x0, PLACE_BOX.y0], [PLACE_BOX.x1, PLACE_BOX.y0], [PLACE_BOX.x0, PLACE_BOX.y1], [PLACE_BOX.x1, PLACE_BOX.y1]]
      .map(([x, y]) => [cx + x * Math.cos(r) - y * Math.sin(r), cy + x * Math.sin(r) + y * Math.cos(r)]);
  });
  const x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0])), y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1]));
  let w = x1 - x0 + 4, h = y1 - y0 + 2;
  if (w / h > 4 / 3) h = (w * 3) / 4; else w = (h * 4) / 3;
  return { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - h / 2, w, h };
}

/**
 * Everything in the top view, back to front: the table top (filling the
 * picture), every place in sight (the middle one last), the centrepieces.
 */
export function placeLayout(t: TableSetup, theme: { id: string; balloonColors: string[]; accent: string }): PlaceNode[] {
  const { table, focus, at, turn, centre } = frame(t);
  const view = placeView(t);
  const inView = ([x, y]: Pt, margin: number) => x > view.x - margin && x < view.x + view.w + margin && y > view.y - margin && y < view.y + view.h + margin;
  const seats = table.seats.map((s, i) => ({ s, i, c: at(centre(s)) })).filter(({ c }) => inView(c, 30));
  const nodes: PlaceNode[] = [];
  const cloth = t.choices.tablecloth !== NONE;
  nodes.push({ k: "top", pts: table.outline.map(at), fill: cloth ? t.clothColor : "#F7F5F2", cloth });
  for (const { s, i, c } of [...seats].sort((p, q) => Number(p.s === focus) - Number(q.s === focus))) {
    nodes.push({ k: "group", x: c[0], y: c[1], rot: turn(s), nodes: setting(t, theme, `place-${i}`), id: `place-${i}`, focus: s === focus });
  }
  const cp = t.choices.centrepiece;
  // The theme cutouts are the theme's own piece (2026-10-29: Frozen first).
  const cpName = (cp === "cutouts" ? `centrepiece-cutouts-${theme.id}` : `centrepiece-${cp}`) as PieceName;
  if (cp !== NONE && PIECES[cpName]) {
    const name = cpName, w = cp === "toppers" ? 16 : cp === "balloons" ? 22 : cp === "cutouts" ? 24 : 20;
    table.centres.map(at).filter((p) => inView(p, 12)).forEach(([x, y], k) => nodes.push({ k: "img", src: piece(name), x, y, w, h: tall(name, w), lift: 4, id: `centre-${k}` }));
  }
  return nodes;
}

/** The pictures a view needs (to load them before it shows). */
export function placePictures(nodes: PlaceNode[]): string[] {
  const out = new Set<string>();
  const walk = (l: PlaceNode[]) => l.forEach((n) => {
    if (n.k === "img") { out.add(n.src); if (n.print) out.add(n.print); }
    else if (n.k === "sheet" && n.art) out.add(n.art);
    else if (n.k === "bottle") { out.add(`${DIR}/bottle.webp`); out.add(`${DIR}/bottle-label.webp`); if (n.art) out.add(n.art); }
    else if (n.k === "group") walk(n.nodes);
  });
  walk(nodes);
  return Array.from(out);
}
