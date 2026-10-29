// The kids' table seen from the front, a little from above (2026-10-27:
// "hep top view görüyoruz, table setup'ı perspective'de de görelim") — a live
// drawing from the same layout as the top view (arrangeTables), so it changes
// with every choice. Not a render: the real render is made on request, with
// this drawing as its layout guide. Seen from a front corner (TURN: the floor
// plan is turned before it is projected) so the table reads in depth
// ("perspective çok uzak … daha cool"); the frame fits the drawing.
import { NONE, onFloor } from "@/lib/studio/tableCatalog";
import type { TableSetup } from "@/lib/studio/tableSetup";
import { arrangeTables, type Pt } from "@/lib/studio/tableShapes";
import { CHAIR_COLOUR, GOLD, INK, PASTELS, PartyPatterns, star } from "./glyphs";

// Projection: floor depth (y) is squeezed and lifted, height rises, and the far
// side shrinks towards the middle (FAR) so the room reads in perspective.
// Each table has its own height (the low table is 35 cm).
const CHAIR_SEAT = 28, CHAIR_BACK = 58;

/**
 * Where the drawing is seen from: the floor plan's turn (radians), how much the
 * far end shrinks, how high the eye is; optionally how far the chairs are
 * pulled in to the table (0–1) and how big the place settings are drawn.
 */
export interface Camera { turn: number; far: number; depth: number; tuck?: number; setting?: number }
/** The live sketch: a front corner. */
export const CORNER: Camera = { turn: 0.36, far: 0.74, depth: 0.56 };
/**
 * The render's front view: from one end, looking down the length of the table.
 * A loose guide on purpose: the engine makes its own magazine shot from it
 * (2026-10-27, "A olsun"); a tighter, lower drawing only made it copy the
 * drawing's angle. Chairs pulled a little in so no plate lands on a seat.
 */
export const DOWN_THE_TABLE: Camera = { turn: 1.42, far: 0.34, depth: 0.6, tuck: 0.25 };

export default function TablePerspective({ table, palette, accent, className, camera = CORNER }: { table: TableSetup; palette: string[]; accent: string; className?: string; camera?: Camera }) {
  const { turn, far: FAR, depth: DEPTH, tuck = 0, setting: SET = 1 } = camera;
  const ch = table.choices;
  const { tables, width, height } = arrangeTables(table);
  const pal = palette.length ? palette : PASTELS;
  const top = 78, cx0 = width / 2, cy0 = height / 2;
  const cos = Math.cos(turn), sin = Math.sin(turn);
  // The floor plan turned about its middle.
  const R = (x: number, y: number) => [cx0 + (x - cx0) * cos - (y - cy0) * sin, cy0 + (x - cx0) * sin + (y - cy0) * cos] as const;
  const depths = tables.flatMap((t) => [R(t.x, t.y), R(t.x + t.w, t.y), R(t.x, t.y + t.h), R(t.x + t.w, t.y + t.h), ...t.seats.map((q) => R(q.x, q.y))]).map((q) => q[1]);
  const far = Math.min(...depths) - 20, nearest = Math.max(...depths) + 20;
  const K = (x: number, y: number) => FAR + (1 - FAR) * Math.min(1, Math.max(0, (R(x, y)[1] - far) / (nearest - far))); // nearer is bigger
  let minX = Infinity, maxX = -Infinity, floor = 0, ceil = Infinity; // the drawing's bounds, for the viewBox
  const P = (x: number, y: number, h = 0) => {
    const [rx, ry] = R(x, y), k = K(x, y);
    const q = [cx0 + (rx - cx0) * k, top + (ry - far) * DEPTH - h * k] as const;
    minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]); floor = Math.max(floor, q[1]); ceil = Math.min(ceil, q[1]);
    return q;
  };
  const pts = (a: (readonly [number, number])[]) => a.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  // A small drawing at a projected point, scaled for its distance.
  const at = (x: number, y: number, k: number) => `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${k.toFixed(3)}) translate(${(-x).toFixed(1)} ${(-y).toFixed(1)})`;

  // Everything that stands on the floor, drawn back to front: table by table,
  // the chairs behind a table before it and the chairs in front after it.
  type Piece = { depth: number; node: JSX.Element };
  const pieces: Piece[] = [];
  let seatNo = 0;

  const floorSeats = onFloor(ch);
  const chair = (x: number, y: number, facing: number, key: string, n: number, tableDepth: number) => {
    const k = K(x, y);
    const facingUs = Math.sin(facing + turn) < 0; // a seat on the near side faces away from us: its back is in front
    if (floorSeats) {
      // The low table: a white cushion on the floor at every place.
      const [fx, fy] = P(x, y), [tx, ty] = P(x, y, 11);
      pieces.push({ depth: tableDepth + (facingUs ? 0.5 : -0.5), node: <g key={key}>
        <path d={`M${fx - 20 * k},${fy}V${ty}H${tx + 20 * k}V${fy}Z`} fill="#F1ECE8" stroke={INK} strokeWidth={1} />
        <ellipse cx={fx} cy={fy} rx={20 * k} ry={8 * k} fill="#F1ECE8" stroke={INK} strokeWidth={1} />
        <ellipse cx={tx} cy={ty} rx={20 * k} ry={8 * k} fill="#FFFFFF" stroke={INK} strokeWidth={1.1} />
      </g> });
      return;
    }
    const c = ch.chairs === "blue_kids" ? table.chairColor : CHAIR_COLOUR[ch.chairs] ?? "#fff";
    // The back is on the side away from the table.
    const bx = x - Math.cos(facing) * 15, by = y - Math.sin(facing) * 15;
    const [sx, sy] = P(x, y, CHAIR_SEAT), [bxp, byp] = P(bx, by, CHAIR_BACK);
    ceil = Math.min(ceil, byp - (ch.chairDecor === "balloon" ? 30 * k : ch.chairs === "bow_kids" ? 14 * k : 4));
    minX = Math.min(minX, bxp - 20 * k); maxX = Math.max(maxX, bxp + 20 * k);
    // A near chair's back is see-through, so the table behind it still shows.
    const op = facingUs ? 0.72 : 1;
    const bh = (CHAIR_BACK - CHAIR_SEAT + 6) * k;
    const back = ch.chairs === "bow_kids"
      // Two loops of a bow for a back.
      ? <g fill={c} fillOpacity={0.35} stroke="#D9A3B5" strokeWidth={2}><ellipse cx={bxp - 8 * k} cy={byp} rx={8 * k} ry={10 * k} /><ellipse cx={bxp + 8 * k} cy={byp} rx={8 * k} ry={10 * k} /><path d={`M${bxp},${byp + 8 * k}V${byp + bh}`} /></g>
      : ch.chairs === "white_kids"
        ? <ellipse cx={bxp} cy={byp + bh / 2} rx={15 * k} ry={bh / 2 + 2 * k} fill={c} fillOpacity={op} stroke={INK} strokeWidth={1.1} />
        : <g><rect x={bxp - 15 * k} y={byp} width={30 * k} height={bh} rx={4 * k} fill={c} fillOpacity={op} stroke={INK} strokeWidth={1.1} />
          {ch.chairs === "blue_kids" && <path d={[-8, -3, 3, 8].map((dx) => `M${bxp + dx * k},${byp + 4 * k}V${byp + bh - 3 * k}`).join("")} stroke="#0E7490" strokeWidth={1} />}</g>;
    const seat = <ellipse cx={sx} cy={sy} rx={17 * k} ry={7 * k} fill={c} stroke={ch.chairs === "bow_kids" ? "#D9A3B5" : INK} strokeWidth={1.1} />;
    const legs = <path d={`M${sx - 13 * k},${sy}V${P(x, y)[1]}M${sx + 13 * k},${sy}V${P(x, y)[1]}`} stroke={ch.chairs === "gold_chiavari" ? "#B8932B" : ch.chairs === "bow_kids" ? "#D9A3B5" : INK} strokeWidth={1.4} />;
    const decor = ch.chairDecor === NONE ? null : ch.chairDecor === "tulle_bow"
      ? <g fill={pal[(n + 1) % pal.length]} stroke={INK} strokeWidth={0.7} transform={`translate(${bxp} ${byp + 10 * k}) scale(${k})`}><path d="M0,0L-11,-6L-11,6Z" /><path d="M0,0L11,-6L11,6Z" /><circle r={2.6} /></g>
      : ch.chairDecor === "balloon"
        // Tied to the back's corner and floating off to the side, so a chair never reads as a figure with a head (2026-10-27 render).
        ? <g transform={`translate(${bxp + 15 * k} ${byp + 2 * k}) scale(${k})`}><path d="M0,0q2,-8 8,-14" fill="none" stroke={INK} strokeWidth={0.6} /><ellipse cx={10} cy={-21} rx={6} ry={7.5} fill={pal[(n + 2) % pal.length]} stroke={INK} strokeWidth={0.8} /><path d="M9,-13.5l1,-1l1,1Z" fill={INK} /></g>
        : <g transform={`translate(${bxp} ${byp + 8 * k}) scale(${k})`}><path d="M-9,-6L9,-6L0,6Z" fill={accent} stroke={INK} strokeWidth={0.7} /></g>;
    pieces.push({ depth: tableDepth + (facingUs ? 0.5 : -0.5), node: <g key={key}><ellipse cx={P(x, y)[0]} cy={P(x, y)[1]} rx={19 * k} ry={5 * k} fill="#000" opacity={0.06} />{facingUs ? <>{legs}{seat}{back}{decor}</> : <>{back}{decor}{legs}{seat}</>}</g> });
  };

  tables.forEach((t, ti) => {
    const TABLE_H = t.height;
    const cx = t.x + t.w / 2, cy = t.y + t.h / 2;
    const depth = R(cx, cy)[1];
    t.seats.forEach((s, k) => chair(s.x + (s.ex - s.x) * tuck, s.y + (s.ey - s.y) * tuck, s.facing, `ch-${ti}-${k}`, k, depth));

    const cloth = table.clothColor;
    const ruffle = ch.tablecloth === "ruffle", sequin = ch.tablecloth === "sequin", printed = ch.tablecloth === "printed";
    const top = (pl: Pt[]) => pts(pl.map(([x, y]) => P(x, y, TABLE_H)));
    const items: JSX.Element[] = [];
    items.push(<ellipse key="shadow" cx={P(cx, cy)[0]} cy={P(cx, cy)[1] + 6} rx={(t.w / 2 + 8) * K(cx, cy)} ry={14} fill="#000" opacity={0.06} />);
    // The cloth hangs to the floor on every edge that faces us, the far ones first.
    const o = t.outline;
    const turning = Math.sign(o.reduce((a, [x1, y1], i) => { const [x2, y2] = o[(i + 1) % o.length]; return a + x1 * y2 - x2 * y1; }, 0)) || 1;
    o.map((p1, i) => {
      const p2 = o[(i + 1) % o.length];
      const dx = p2[0] - p1[0], dy = p2[1] - p1[1], len = Math.hypot(dx, dy) || 1;
      const nx = (turning * dy) / len, ny = (-turning * dx) / len; // outward
      return { p1, p2, toUs: nx * sin + ny * cos, depth: R((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2)[1], i };
    }).filter((e) => e.toUs > 0.02).sort((a, b) => a.depth - b.depth).forEach(({ p1: [x1, y1], p2: [x2, y2], i }) => {
      const side = pts([P(x1, y1, TABLE_H), P(x2, y2, TABLE_H), P(x2, y2), P(x1, y1)]);
      // Neighbouring edges of a curve share a colour, so no seam shows between them.
      items.push(<polygon key={`side-${i}`} points={side} fill={cloth} stroke={cloth} strokeWidth={0.6} />);
      if (printed) items.push(<polygon key={`print-${i}`} points={side} fill="url(#cloth-print)" />);
      items.push(<path key={`hem-${i}`} d={`M${P(x1, y1).join(",")}L${P(x2, y2).join(",")}`} stroke={INK} strokeWidth={1.2} />);
      if (ruffle) items.push(<path key={`ruf-${i}`} d={`M${P(x1, y1, 10).join(",")}L${P(x2, y2, 10).join(",")}`} stroke={INK} strokeWidth={0.9} strokeDasharray="4 3" />);
    });
    items.push(<polygon key="top" points={top(o)} fill={cloth} stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />);
    if (sequin || printed) items.push(<polygon key="seq" points={top(o)} fill={sequin ? "url(#sequin)" : "url(#cloth-print)"} />);
    if (ch.runner !== NONE) {
      const fill = ch.runner === "tulle" ? `${table.runnerColor}99` : ch.runner === "confetti" ? "url(#confetti)" : table.runnerColor;
      items.push(<polygon key="run" points={top(t.runner)} fill={fill} />);
      if (ch.runner === "greenery") items.push(<polygon key="leaf" points={top(t.runner)} fill="url(#leaves)" />);
      if (ch.runner === "sequin") items.push(<polygon key="rseq" points={top(t.runner)} fill="url(#sequin)" />);
    }

    // Place settings, back to front.
    const settings = [...t.seats].sort((p, q) => R(p.x, p.y)[1] - R(q.x, q.y)[1]).map((s) => {
      const n = seatNo++;
      const inward = 16;
      const px = s.ex + Math.cos(s.facing) * inward, py = s.ey + Math.sin(s.facing) * inward;
      const [x, y] = P(px, py, TABLE_H);
      const plateFill = ch.plates === "plain" ? table.plateColor : ch.plates === "white_gold" ? "#fff" : ch.plates === "iridescent" ? "#EBDDF7" : ch.plates === "silver" ? "#E5E8EC" : ch.plates === "pastel" || ch.plates === "scalloped" ? PASTELS[n % PASTELS.length] : pal[n % pal.length];
      const foil = ch.plates === "iridescent" || ch.plates === "silver";
      const square = ch.plates === "plain" && table.plateShape === "square";
      const cupX = x + Math.cos(s.facing + turn - Math.PI / 2) * 11;
      return <g key={`s-${n}`} transform={at(x, y, K(px, py) * SET)}>
        {ch.placemats !== NONE && <rect x={x - 21} y={y - 7.5} width={42} height={15} rx={1.2} fill={ch.placemats === "plain" ? table.placematColor : pal[(n + 1) % pal.length]} stroke={INK} strokeWidth={0.5} />}
        {ch.placemats === "watercolour" && <rect x={x - 16} y={y - 5} width={32} height={10} rx={4} fill="#fff" opacity={0.55} />}
        {ch.placemats === "sparkle" && <rect x={x - 21} y={y - 7.5} width={42} height={15} rx={1.2} fill="url(#sequin)" />}
        {ch.chargers !== NONE && <ellipse cx={x} cy={y} rx={12.5} ry={5.3} fill={ch.chargers === "gold" ? GOLD : ch.chargers === "rattan" ? "#D9B98C" : "#EEF5FA"} stroke={INK} strokeWidth={0.6} />}
        {square
          ? <rect x={x - 9} y={y - 3.8} width={18} height={7.6} rx={1.5} fill={plateFill} stroke="#8C99A6" strokeWidth={0.8} />
          : <ellipse cx={x} cy={y} rx={9} ry={3.8} fill={plateFill} stroke={ch.plates === "white_gold" ? GOLD : foil ? "#8C99A6" : INK} strokeWidth={ch.plates === "white_gold" ? 1.4 : 0.8} strokeDasharray={(ch.plates === "plain" && table.plateShape === "scalloped") || ch.plates === "silver" ? "2.2 1" : undefined} />}
        {ch.plates === "themed" && <ellipse cx={x} cy={y} rx={9} ry={3.8} fill="url(#cloth-print)" />}
        {/* The small plate on the big one, with the theme's round card in it (2026-10-28). */}
        <ellipse cx={x} cy={y} rx={5.6} ry={2.4} fill={plateFill} stroke={foil ? "#8C99A6" : INK} strokeWidth={0.6} />
        <ellipse cx={x} cy={y} rx={3.4} ry={1.45} fill={pal[(n + 1) % pal.length]} stroke={INK} strokeWidth={0.4} />
        <rect x={x - 17} y={y - 3} width={6} height={5} rx={1} fill={ch.napkins === "striped" ? "#FCE7F3" : ch.napkins === "foil" ? "#DCEBF7" : table.napkinColor} stroke={INK} strokeWidth={0.5} />
        {ch.cutleryHolder !== NONE && <rect x={x - 16.5} y={y - 6} width={5} height={7} rx={0.8} fill={ch.cutleryHolder === "band" ? table.holderColor : pal[(n + 1) % pal.length]} stroke={INK} strokeWidth={0.5} />}
        {ch.bottleLabel !== NONE && <g><rect x={cupX + 6} y={y - 14} width={4} height={12} rx={1.5} fill="#EAF4FB" stroke="#8C99A6" strokeWidth={0.6} /><rect x={cupX + 6} y={y - 9} width={4} height={4} fill={ch.bottleLabel === "sparkle" ? "#E9DDF7" : pal[(n + 2) % pal.length]} /><rect x={cupX + 6.8} y={y - 16} width={2.4} height={2} fill="#93C5FD" /></g>}
        {ch.cups === "pouch"
          ? <rect x={cupX - 3} y={y - 10} width={6} height={9} rx={1.5} fill={pal[(n + 2) % pal.length]} stroke={INK} strokeWidth={0.7} />
          : <path d={`M${cupX - 3},${y - 10}L${cupX - 2.4},${y - 1}H${cupX + 2.4}L${cupX + 3},${y - 10}Z`} fill={ch.cups === "gold_rim" ? "#F3F7FA" : ch.cups === "white_straw" ? "#FFFFFF" : ch.cups === "iridescent" ? "#E9DDF7" : ch.cups === "plain" ? table.cupColor : ch.cups === "pastel" ? PASTELS[(n + 2) % PASTELS.length] : pal[(n + 2) % pal.length]} stroke={ch.cups === "gold_rim" ? GOLD : INK} strokeWidth={0.7} />}
        {(ch.cups === "white_straw" || ch.cups === "iridescent") && <path d={`M${cupX},${y - 10}L${cupX + 3},${y - 17}`} stroke={ch.cups === "white_straw" ? "#9AA6B2" : "#FFFFFF"} strokeWidth={1} />}
        {ch.cups === "pouch" && <path d={`M${cupX},${y - 10}L${cupX + 2},${y - 14}`} stroke={accent} strokeWidth={1} />}
        {ch.cups === "straw" && <path d={`M${cupX},${y - 10}L${cupX + 3},${y - 17}`} stroke={accent} strokeWidth={1} />}
        {ch.cups === "lidded" && <ellipse cx={cupX} cy={y - 10} rx={3.2} ry={1.2} fill="#fff" stroke={INK} strokeWidth={0.5} />}
        {ch.partyHats === "cone" && <path d={`M${x - 4},${y - 1}L${x},${y - 13}L${x + 4},${y - 1}Z`} fill={pal[(n + 3) % pal.length]} stroke={INK} strokeWidth={0.6} />}
        {ch.partyHats === "crown" && <path d={`M${x - 5},${y - 1}V${y - 7}L${x - 2.5},${y - 4}L${x},${y - 9}L${x + 2.5},${y - 4}L${x + 5},${y - 7}V${y - 1}Z`} fill={GOLD} stroke={INK} strokeWidth={0.6} />}
        {ch.partyHats === "headband" && <path d={`M${x - 5},${y - 2}q5,-8 10,0`} fill="none" stroke={accent} strokeWidth={1.4} />}
        {ch.nameCards !== NONE && <rect x={x - 6} y={y + 3} width={12} height={4} rx={0.8} fill={ch.nameCards === "acrylic" ? "#EEF5FA" : "#fff"} stroke={INK} strokeWidth={0.5} />}
      </g>;
    });

    // Centrepieces stand up from the middle.
    const centres = ch.centrepiece === NONE ? [] : t.centres.map(([x, y], i) => {
        const [px, py] = P(x, y, TABLE_H);
        const k = (t.centres.length > 1 ? 0.62 : t.kind === "round" ? 1.1 : 0.85) * K(x, y);
        ceil = Math.min(ceil, py - 72 * k);
        if (ch.centrepiece === "balloons") return <g key={`cp-${i}`} transform={`translate(${px} ${py}) scale(${k})`}>
          <path d="M0,0V-40" stroke={INK} strokeWidth={0.8} />{[[0, -48, 11], [-11, -40, 9], [11, -41, 9], [-5, -60, 8], [7, -59, 8]].map(([dx, dy, r], j) => <circle key={j} cx={dx} cy={dy} r={r} fill={pal[j % pal.length]} stroke={INK} strokeWidth={0.8} />)}</g>;
        if (ch.centrepiece === "florals") return <g key={`cp-${i}`} transform={`translate(${px} ${py}) scale(${k})`}>
          <path d="M-10,0h20l-3,-12h-14Z" fill="#EEF5FA" stroke={INK} strokeWidth={0.8} />{[[-8, -18], [6, -20], [-1, -27], [11, -14], [-12, -12]].map(([dx, dy], j) => <circle key={j} cx={dx} cy={dy} r={6} fill={["#F9A8D4", "#FFFFFF", "#FDE68A", "#F9A8D4", "#FFFFFF"][j]} stroke={INK} strokeWidth={0.6} />)}</g>;
        return <g key={`cp-${i}`} transform={`translate(${px} ${py}) scale(${k})`}><path d="M0,0V-30M-10,0V-22M10,0V-22" stroke={INK} strokeWidth={0.8} /><path d={star(0, -36, 9)} fill={accent} stroke={INK} strokeWidth={0.8} /><path d={star(-10, -27, 6)} fill={accent} stroke={INK} strokeWidth={0.8} /><path d={star(10, -27, 6)} fill={accent} stroke={INK} strokeWidth={0.8} /></g>;
      });

    // The table counts as standing at its centre: back chairs before it, front chairs after it.
    pieces.push({ depth, node: <g key={`t-${ti}`}>{items}{settings}{centres}</g> });
  });

  pieces.sort((a, b) => a.depth - b.depth);
  const x0 = minX - 18, W = maxX + 18 - x0;
  const y0 = (Number.isFinite(ceil) ? ceil : top) - 16, H = floor + 18 - y0;
  return (
    <svg className={className} viewBox={`${x0.toFixed(0)} ${y0.toFixed(0)} ${W.toFixed(0)} ${H.toFixed(0)}`} role="img" data-testid="table-perspective-sketch"
      aria-label={`Perspective: ${tables.length} ${(tables[0]?.kind ?? "standard").replace("_", " ")} table${tables.length > 1 ? "s" : ""} for ${table.kids} children`}>
      <defs>
        <pattern id="sequin" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.4" fill="#FFFFFF" opacity="0.65" /></pattern>
        <pattern id="leaves" width="14" height="10" patternUnits="userSpaceOnUse"><ellipse cx="7" cy="5" rx="5" ry="2.2" fill="#5E8C5A" opacity="0.8" transform="rotate(-25 7 5)" /></pattern>
        <PartyPatterns />
      </defs>
      <rect x={x0} y={y0} width={W} height={H} rx={18} fill="#FBF7F4" />
      <path d={`M${x0},${top - 10}H${x0 + W}V${y0 + H - 18}a18,18 0 0 1 -18,18H${x0 + 18}a18,18 0 0 1 -18,-18Z`} fill="#F3ECE7" />
      {pieces.map((p) => p.node)}
    </svg>
  );
}
