// The kids' table seen from the front, a little from above (2026-10-27:
// "hep top view görüyoruz, table setup'ı perspective'de de görelim") — a live
// drawing from the same layout as the top view (arrangeTables), so it changes
// with every choice. Not a render: the real render is made on request.
import { NONE } from "@/lib/studio/tableCatalog";
import type { TableSetup } from "@/lib/studio/tableSetup";
import { arrangeTables } from "./TableSketch";
import { CHAIR_COLOUR, GOLD, INK, PASTELS, star } from "./glyphs";

// Projection: floor depth (y) is squeezed and lifted, height rises, and the far
// side shrinks towards the middle (FAR) so the room reads in perspective.
const DEPTH = 0.56, TABLE_H = 50, CHAIR_SEAT = 28, CHAIR_BACK = 58, FAR = 0.74;

export default function TablePerspective({ table, palette, accent, className }: { table: TableSetup; palette: string[]; accent: string; className?: string }) {
  const ch = table.choices;
  const { tables, width, height } = arrangeTables(table);
  const pal = palette.length ? palette : PASTELS;
  const top = 78, mid = width / 2;
  const K = (y: number) => FAR + (1 - FAR) * Math.min(1, Math.max(0, y / height)); // nearer is bigger
  const P = (x: number, y: number, h = 0) => [mid + (x - mid) * K(y), top + y * DEPTH - h * K(y)] as const;
  const pts = (a: (readonly [number, number])[]) => a.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  // A small drawing at a projected point, scaled for its distance.
  const at = (x: number, y: number, k: number) => `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${k.toFixed(3)}) translate(${(-x).toFixed(1)} ${(-y).toFixed(1)})`;
  let floor = 0, ceil = Infinity; // the drawing's real bottom and top, for the viewBox

  // Everything that stands on the floor, drawn back to front.
  type Piece = { depth: number; node: JSX.Element };
  const pieces: Piece[] = [];
  let seatNo = 0;

  const chair = (x: number, y: number, facing: number, key: string, n: number) => {
    const c = CHAIR_COLOUR[ch.chairs] ?? "#fff";
    const clear = ch.chairs === "clear_ghost";
    // The back is on the side away from the table.
    const bx = x - Math.cos(facing) * 15, by = y - Math.sin(facing) * 15;
    const [sx, sy] = P(x, y, CHAIR_SEAT), [bxp, byp] = P(bx, by, CHAIR_BACK);
    const facingUs = Math.sin(facing) < 0; // a chair on the near side faces away from us: its back is in front
    const k = K(y);
    floor = Math.max(floor, P(x, y)[1]);
    ceil = Math.min(ceil, byp - (ch.chairDecor === "balloon" ? 26 * k : 4));
    // A near chair's back is see-through, so the table behind it still shows.
    const op = clear ? 0.45 : facingUs ? 0.72 : 1;
    const back = <rect x={bxp - 15 * k} y={byp} width={30 * k} height={(CHAIR_BACK - CHAIR_SEAT + 6) * k} rx={6 * k} fill={c} fillOpacity={op} stroke={INK} strokeWidth={1.1} />;
    const seat = <ellipse cx={sx} cy={sy} rx={17 * k} ry={7 * k} fill={c} fillOpacity={clear ? 0.45 : 1} stroke={INK} strokeWidth={1.1} />;
    const legs = <path d={`M${sx - 13 * k},${sy}V${P(x, y)[1]}M${sx + 13 * k},${sy}V${P(x, y)[1]}`} stroke={ch.chairs === "gold_chiavari" ? "#B8932B" : INK} strokeWidth={1.4} />;
    const decor = ch.chairDecor === NONE ? null : ch.chairDecor === "tulle_bow"
      ? <g fill={pal[(n + 1) % pal.length]} stroke={INK} strokeWidth={0.7} transform={`translate(${bxp} ${byp + 10 * k}) scale(${k})`}><path d="M0,0L-11,-6L-11,6Z" /><path d="M0,0L11,-6L11,6Z" /><circle r={2.6} /></g>
      : ch.chairDecor === "balloon"
        ? <g transform={`translate(${bxp + 10 * k} ${byp - 4 * k}) scale(${k})`}><path d="M0,0q3,8 -2,16" fill="none" stroke={INK} strokeWidth={0.6} /><ellipse cx={0} cy={-9} rx={8} ry={10} fill={pal[(n + 2) % pal.length]} stroke={INK} strokeWidth={0.8} /></g>
        : <g transform={`translate(${bxp} ${byp + 8 * k}) scale(${k})`}><path d="M-9,-6L9,-6L0,6Z" fill={accent} stroke={INK} strokeWidth={0.7} /></g>;
    pieces.push({ depth: y, node: <g key={key}><ellipse cx={P(x, y)[0]} cy={P(x, y)[1]} rx={19 * k} ry={5 * k} fill="#000" opacity={0.06} />{facingUs ? <>{legs}{seat}{back}{decor}</> : <>{back}{decor}{legs}{seat}</>}</g> });
  };

  tables.forEach((t, ti) => {
    const round = t.kind === "round";
    const cx = t.x + t.w / 2, cy = t.y + t.h / 2;
    const near = t.y + t.h; // the front edge
    t.seats.forEach((s, k) => chair(s.x, s.y, s.facing, `ch-${ti}-${k}`, k));

    const cloth = table.clothColor;
    const ruffle = ch.tablecloth === "ruffle", sequin = ch.tablecloth === "sequin";
    const items: JSX.Element[] = [];
    floor = Math.max(floor, P(cx, near)[1]);
    items.push(<ellipse key="shadow" cx={P(cx, cy)[0]} cy={P(cx, near)[1] - 2} rx={(t.w / 2 + 8) * K(near)} ry={8} fill="#000" opacity={0.06} />);
    // The tabletop and the cloth hanging to the floor in front.
    if (round) {
      const [ex, ey] = P(cx, cy, TABLE_H), rx = (t.w / 2) * K(cy), ry = (t.h / 2) * DEPTH;
      items.push(<path key="drape" d={`M${ex - rx},${ey}V${P(cx, cy)[1]}A${rx},${ry} 0 0 0 ${ex + rx},${P(cx, cy)[1]}V${ey}Z`} fill={cloth} stroke={INK} strokeWidth={1.2} />);
      if (ruffle) items.push(<path key="ruf" d={`M${ex - rx},${P(cx, cy)[1] - 10}A${rx},${ry} 0 0 0 ${ex + rx},${P(cx, cy)[1] - 10}`} fill="none" stroke={INK} strokeWidth={0.9} strokeDasharray="4 3" />);
      items.push(<ellipse key="top" cx={ex} cy={ey} rx={rx} ry={ry} fill={cloth} stroke={INK} strokeWidth={1.3} />);
      if (sequin) items.push(<ellipse key="seq" cx={ex} cy={ey} rx={rx} ry={ry} fill="url(#sequin)" />);
      if (ch.runner !== NONE) items.push(<ellipse key="run" cx={ex} cy={ey} rx={30 * K(cy)} ry={30 * DEPTH} fill={ch.runner === "tulle" ? `${table.runnerColor}99` : table.runnerColor} />);
    } else {
      const a = P(t.x, t.y, TABLE_H), b = P(t.x + t.w, t.y, TABLE_H), c = P(t.x + t.w, near, TABLE_H), d = P(t.x, near, TABLE_H);
      items.push(<polygon key="front" points={pts([d, c, [c[0], P(0, near)[1]], [d[0], P(0, near)[1]]])} fill={cloth} stroke={INK} strokeWidth={1.2} />);
      if (ruffle) items.push(<path key="ruf" d={`M${d[0]},${P(0, near)[1] - 10}H${c[0]}`} stroke={INK} strokeWidth={0.9} strokeDasharray="4 3" />);
      items.push(<polygon key="top" points={pts([a, b, c, d])} fill={cloth} stroke={INK} strokeWidth={1.3} />);
      if (sequin) items.push(<polygon key="seq" points={pts([a, b, c, d])} fill="url(#sequin)" />);
      if (ch.runner !== NONE) {
        const fill = ch.runner === "tulle" ? `${table.runnerColor}99` : table.runnerColor;
        const r = t.kind === "long"
          ? [P(t.x, cy - 9, TABLE_H), P(t.x + t.w, cy - 9, TABLE_H), P(t.x + t.w, cy + 9, TABLE_H), P(t.x, cy + 9, TABLE_H)]
          : [P(cx - 9, t.y, TABLE_H), P(cx + 9, t.y, TABLE_H), P(cx + 9, near, TABLE_H), P(cx - 9, near, TABLE_H)];
        items.push(<polygon key="run" points={pts(r)} fill={fill} />);
        if (ch.runner === "greenery") items.push(<polygon key="leaf" points={pts(r)} fill="url(#leaves)" />);
        if (ch.runner === "sequin") items.push(<polygon key="rseq" points={pts(r)} fill="url(#sequin)" />);
      }
    }

    // Place settings, back to front.
    const settings = [...t.seats].sort((p, q) => p.y - q.y).map((s) => {
      const n = seatNo++;
      const inward = round ? 16 : 13;
      const px = s.ex + Math.cos(s.facing) * inward, py = s.ey + Math.sin(s.facing) * inward;
      const [x, y] = P(px, py, TABLE_H);
      const plateFill = ch.plates === "white_gold" ? "#fff" : ch.plates === "pastel" ? PASTELS[n % PASTELS.length] : pal[n % pal.length];
      const cupX = x + Math.cos(s.facing - Math.PI / 2) * 11;
      return <g key={`s-${n}`} transform={at(x, y, K(py))}>
        {ch.chargers !== NONE && <ellipse cx={x} cy={y} rx={12.5} ry={5.3} fill={ch.chargers === "gold" ? GOLD : ch.chargers === "rattan" ? "#D9B98C" : "#EEF5FA"} stroke={INK} strokeWidth={0.6} />}
        <ellipse cx={x} cy={y} rx={9} ry={3.8} fill={plateFill} stroke={ch.plates === "white_gold" ? GOLD : INK} strokeWidth={ch.plates === "white_gold" ? 1.4 : 0.8} />
        <rect x={x - 17} y={y - 3} width={6} height={5} rx={1} fill={table.napkinColor} stroke={INK} strokeWidth={0.5} />
        <path d={`M${cupX - 3},${y - 10}L${cupX - 2.4},${y - 1}H${cupX + 2.4}L${cupX + 3},${y - 10}Z`} fill={ch.cups === "gold_rim" ? "#F3F7FA" : pal[(n + 2) % pal.length]} stroke={ch.cups === "gold_rim" ? GOLD : INK} strokeWidth={0.7} />
        {ch.cups === "straw" && <path d={`M${cupX},${y - 10}L${cupX + 3},${y - 17}`} stroke={accent} strokeWidth={1} />}
        {ch.cups === "lidded" && <ellipse cx={cupX} cy={y - 10} rx={3.2} ry={1.2} fill="#fff" stroke={INK} strokeWidth={0.5} />}
        {ch.partyHats === "cone" && <path d={`M${x - 4},${y - 1}L${x},${y - 13}L${x + 4},${y - 1}Z`} fill={pal[(n + 3) % pal.length]} stroke={INK} strokeWidth={0.6} />}
        {ch.partyHats === "crown" && <path d={`M${x - 5},${y - 1}V${y - 7}L${x - 2.5},${y - 4}L${x},${y - 9}L${x + 2.5},${y - 4}L${x + 5},${y - 7}V${y - 1}Z`} fill={GOLD} stroke={INK} strokeWidth={0.6} />}
        {ch.partyHats === "headband" && <path d={`M${x - 5},${y - 2}q5,-8 10,0`} fill="none" stroke={accent} strokeWidth={1.4} />}
        {ch.nameCards !== NONE && <rect x={x - 6} y={y + 3} width={12} height={4} rx={0.8} fill={ch.nameCards === "acrylic" ? "#EEF5FA" : "#fff"} stroke={INK} strokeWidth={0.5} />}
        {ch.favourBoxes !== NONE && <rect x={x + 9} y={y - 7} width={6} height={6} fill={ch.favourBoxes === "bag" ? "#F3F7FA" : accent} stroke={INK} strokeWidth={0.6} />}
      </g>;
    });

    // Centrepieces stand up from the middle.
    const centres = ch.centrepiece === NONE ? [] : (t.kind === "long"
      ? (() => { const xs = Array.from(new Set(t.seats.filter((s) => s.facing > 0).map((s) => s.x))).sort((p, q) => p - q); return xs.length > 1 ? xs.slice(1).map((x, i) => (x + xs[i]) / 2) : [t.x + t.w * 0.18, t.x + t.w * 0.82]; })()
      : [cx]).map((x, i) => {
        const [px, py] = P(x, cy, TABLE_H);
        const k = (t.kind === "long" ? 0.62 : 0.85) * K(cy);
        ceil = Math.min(ceil, py - 72 * k);
        if (ch.centrepiece === "balloons") return <g key={`cp-${i}`} transform={`translate(${px} ${py}) scale(${k})`}>
          <path d="M0,0V-40" stroke={INK} strokeWidth={0.8} />{[[0, -48, 11], [-11, -40, 9], [11, -41, 9], [-5, -60, 8], [7, -59, 8]].map(([dx, dy, r], j) => <circle key={j} cx={dx} cy={dy} r={r} fill={pal[j % pal.length]} stroke={INK} strokeWidth={0.8} />)}</g>;
        if (ch.centrepiece === "florals") return <g key={`cp-${i}`} transform={`translate(${px} ${py}) scale(${k})`}>
          <path d="M-10,0h20l-3,-12h-14Z" fill="#EEF5FA" stroke={INK} strokeWidth={0.8} />{[[-8, -18], [6, -20], [-1, -27], [11, -14], [-12, -12]].map(([dx, dy], j) => <circle key={j} cx={dx} cy={dy} r={6} fill={["#F9A8D4", "#FFFFFF", "#FDE68A", "#F9A8D4", "#FFFFFF"][j]} stroke={INK} strokeWidth={0.6} />)}</g>;
        return <g key={`cp-${i}`} transform={`translate(${px} ${py}) scale(${k})`}><path d="M0,0V-30M-10,0V-22M10,0V-22" stroke={INK} strokeWidth={0.8} /><path d={star(0, -36, 9)} fill={accent} stroke={INK} strokeWidth={0.8} /><path d={star(-10, -27, 6)} fill={accent} stroke={INK} strokeWidth={0.8} /><path d={star(10, -27, 6)} fill={accent} stroke={INK} strokeWidth={0.8} /></g>;
      });

    // The table counts as standing at its centre: back chairs before it, front chairs after it.
    pieces.push({ depth: cy, node: <g key={`t-${ti}`}>{items}{settings}{centres}</g> });
  });

  pieces.sort((a, b) => a.depth - b.depth);
  const y0 = (Number.isFinite(ceil) ? ceil : top) - 16, H = floor + 18 - y0;
  return (
    <svg className={className} viewBox={`0 ${y0.toFixed(0)} ${width.toFixed(0)} ${H.toFixed(0)}`} role="img" data-testid="table-perspective-sketch"
      aria-label={`Perspective: ${tables.length} ${tables[0]?.kind ?? "long"} table${tables.length > 1 ? "s" : ""} for ${table.kids} children`}>
      <defs>
        <pattern id="sequin" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.4" fill="#FFFFFF" opacity="0.65" /></pattern>
        <pattern id="leaves" width="14" height="10" patternUnits="userSpaceOnUse"><ellipse cx="7" cy="5" rx="5" ry="2.2" fill="#5E8C5A" opacity="0.8" transform="rotate(-25 7 5)" /></pattern>
      </defs>
      <rect y={y0} width={width} height={H} rx={18} fill="#FBF7F4" />
      <path d={`M0,${P(0, 0)[1] + 6}H${width}V${y0 + H - 18}a18,18 0 0 1 -18,18H18a18,18 0 0 1 -18,-18Z`} fill="#F3ECE7" />
      {pieces.map((p) => p.node)}
    </svg>
  );
}
