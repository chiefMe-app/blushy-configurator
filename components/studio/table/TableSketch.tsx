// The Table Setup studio's live drawing: the kids' tables seen from above, to
// scale (1 unit = 1 cm) — every table, chair and place setting, the cloth and
// runner, the centrepieces, and what waits at each seat. Not a render.
import { useId } from "react";
import { themeById } from "@/lib/config";
import { CHAIRS, TABLES, tableLayout, type TableDesign } from "@/lib/studio/table";

const INK = "#5a4950";
const CHAIR = { w: 38, d: 34, gap: 9 };
const PASTELS = ["#FBCFE8", "#BAE6FD", "#DDD6FE", "#BBF7D0", "#FEF08A"];

interface Seat { x: number; y: number; /** Direction from the seat towards the table centre, radians. */ facing: number }
interface Placed { kind: "long" | "round"; x: number; y: number; w: number; h: number; seats: Seat[] }

/** Where every table and seat goes, in cm. */
function arrange(d: TableDesign): { tables: Placed[]; width: number; height: number } {
  const { perTable } = tableLayout(d);
  const T = TABLES[d.shape];
  const reach = CHAIR.gap + CHAIR.d; // from the table edge to the back of a chair
  const margin = 30;
  const tables: Placed[] = [];
  if (d.shape === "long") {
    // Rows of up to two tables joined end to end; four seats a side per table.
    const rowPitch = T.depthCm + 2 * reach + 70;
    // A row's children are split evenly between its two sides and spread
    // along the whole row (2026-10-27: "10 kişide 5 bir tarafta 5 öbür tarafta").
    for (let row = 0; row * 2 < perTable.length; row++) {
      const inRow = perTable.slice(row * 2, row * 2 + 2);
      const rowKids = inRow.reduce((a, b) => a + b, 0), rowLen = inRow.length * T.widthCm;
      const y = margin + reach + row * rowPitch;
      const side = (n: number, top: boolean): Seat[] => Array.from({ length: n }, (_, k) => ({
        x: margin + (k + 0.5) * (rowLen / n),
        y: top ? y - CHAIR.gap - CHAIR.d / 2 : y + T.depthCm + CHAIR.gap + CHAIR.d / 2,
        facing: top ? Math.PI / 2 : -Math.PI / 2,
      }));
      const seats = [...side(Math.ceil(rowKids / 2), true), ...side(Math.floor(rowKids / 2), false)];
      inRow.forEach((_, col) => {
        const x = margin + col * T.widthCm;
        tables.push({ kind: "long", x, y, w: T.widthCm, h: T.depthCm, seats: seats.filter((s) => s.x >= x && s.x < x + T.widthCm) });
      });
    }
    const rows = Math.ceil(perTable.length / 2), cols = Math.min(2, perTable.length);
    return { tables, width: 2 * margin + cols * T.widthCm, height: 2 * margin + rows * rowPitch - 70 };
  }
  const r = T.widthCm / 2, cell = T.widthCm + 2 * reach + 60;
  perTable.forEach((kids, i) => {
    const row = Math.floor(i / 3), col = i % 3;
    const cx = margin + reach + r + col * cell, cy = margin + reach + r + row * cell;
    const seats = Array.from({ length: kids }, (_, k) => {
      const a = -Math.PI / 2 + (k * 2 * Math.PI) / kids;
      const dist = r + CHAIR.gap + CHAIR.d / 2;
      return { x: cx + Math.cos(a) * dist, y: cy + Math.sin(a) * dist, facing: a + Math.PI };
    });
    tables.push({ kind: "round", x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, seats });
  });
  const rows = Math.ceil(perTable.length / 3), cols = Math.min(3, perTable.length);
  return { tables, width: 2 * margin + cols * cell - 60, height: 2 * margin + rows * cell - 60 };
}

const deg = (rad: number) => (rad * 180) / Math.PI;

export default function TableSketch({ design, className }: { design: TableDesign; className?: string }) {
  const gid = useId().replace(/:/g, "");
  const theme = themeById(design.theme);
  const palette = design.tableware === "themed" ? (theme?.balloonColors ?? PASTELS) : PASTELS;
  const chairColour = CHAIRS.find((c) => c.id === design.chairs)!.colour;
  const { tables, width, height } = arrange(design);
  let seatNo = 0;

  const runner = (t: Placed) => {
    if (design.runner === "none") return null;
    const fill = design.runner === "tulle" ? `${design.runnerColor}99` : design.runnerColor;
    const pattern = design.runner === "sequin" ? `url(#${gid}-sequin)` : design.runner === "greenery" ? `url(#${gid}-leaves)` : undefined;
    if (t.kind === "long") {
      const h = 18, y = t.y + (t.h - h) / 2;
      return <g><rect x={t.x} y={y} width={t.w} height={h} fill={fill} />{pattern && <rect x={t.x} y={y} width={t.w} height={h} fill={pattern} />}</g>;
    }
    const cx = t.x + t.w / 2, cy = t.y + t.h / 2;
    return <g><circle cx={cx} cy={cy} r={30} fill={fill} />{pattern && <circle cx={cx} cy={cy} r={30} fill={pattern} />}</g>;
  };

  const centrepiece = (t: Placed, key: string) => {
    if (design.centrepiece === "none") return null;
    const one = (cx: number, cy: number, k: number, i: number) =>
      <g key={`${key}-${i}`} transform={`translate(${cx} ${cy}) scale(${k}) translate(${-cx} ${-cy})`}>{centrepieceArt(cx, cy)}</g>;
    if (t.kind === "round") return one(t.x + t.w / 2, t.y + t.h / 2, 1, 0);
    // A long table is 60 cm deep: the plates leave a ~16 cm strip down the
    // middle, so small centrepieces go in the gaps between the places.
    const xs = Array.from(new Set(t.seats.filter((s) => s.facing > 0).map((s) => s.x))).sort((a, b) => a - b);
    const gaps = xs.length > 1 ? xs.slice(1).map((x, i) => (x + xs[i]) / 2) : [t.x + t.w * 0.18, t.x + t.w * 0.82];
    return <g key={key}>{gaps.map((gx, i) => one(gx, t.y + t.h / 2, 0.5, i))}</g>;
  };
  const centrepieceArt = (cx: number, cy: number) => {
    const key = "art";
    if (design.centrepiece === "balloons") {
      return <g key={key}>{[[0, 0, 11], [-10, -7, 8], [10, -6, 8], [-7, 9, 7], [9, 8, 7]].map(([dx, dy, r], i) =>
        <circle key={i} cx={cx + dx} cy={cy + dy} r={r} fill={palette[i % palette.length]} stroke={INK} strokeWidth={0.8} />)}</g>;
    }
    if (design.centrepiece === "florals") {
      return <g key={key}>{[[-9, -3], [8, -5], [0, 8]].map(([dx, dy], f) => (
        <g key={f} transform={`translate(${cx + dx} ${cy + dy})`}>
          {Array.from({ length: 5 }, (_, p) => <ellipse key={p} cx={0} cy={-5} rx={3.2} ry={5} fill={["#F9A8D4", "#FFFFFF", "#FDE68A"][f]} stroke={INK} strokeWidth={0.5} transform={`rotate(${p * 72})`} />)}
          <circle r={2.4} fill="#E8A33D" />
        </g>
      ))}<path d={`M${cx - 18},${cy + 4}q6,-6 12,0M${cx + 6},${cy - 12}q6,4 12,0`} fill="none" stroke="#5E8C5A" strokeWidth={2} strokeLinecap="round" /></g>;
    }
    if (design.centrepiece === "toppers") {
      const star = (x: number, y: number, r: number) => Array.from({ length: 10 }, (_, i) => {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
        return `${i ? "L" : "M"}${(x + Math.cos(a) * rr).toFixed(1)},${(y + Math.sin(a) * rr).toFixed(1)}`;
      }).join("") + "Z";
      return <g key={key}>{[[0, 0, 10], [-14, 4, 6], [14, 4, 6]].map(([dx, dy, r], i) =>
        <path key={i} d={star(cx + dx, cy + dy, r)} fill={theme?.accent ?? "#E84F8B"} stroke={INK} strokeWidth={0.8} />)}</g>;
    }
    return null;
  };

  const setting = (s: Seat, t: Placed) => {
    const n = seatNo++;
    // The place setting sits on the table, in from the edge, towards the seat.
    const inward = t.kind === "long" ? 13 : 16;
    const edge = t.kind === "long"
      ? { x: s.x, y: s.facing > 0 ? t.y : t.y + t.h }
      : { x: s.x + Math.cos(s.facing) * (CHAIR.gap + CHAIR.d / 2), y: s.y + Math.sin(s.facing) * (CHAIR.gap + CHAIR.d / 2) };
    const px = edge.x + Math.cos(s.facing) * inward, py = edge.y + Math.sin(s.facing) * inward;
    const rot = deg(s.facing) - 90;
    const plateFill = design.tableware === "white_gold" ? "#FFFFFF" : palette[n % palette.length];
    const rim = design.tableware === "white_gold" ? "#D4AF37" : INK;
    return (
      <g key={`set-${n}`} transform={`translate(${px} ${py}) rotate(${rot})`}>
        {/* An 18 cm plate; cup top right, cutlery on the left; the name card beyond the plate, a favour box beside it, a hat on it. */}
        <circle r={9} fill={plateFill} stroke={rim} strokeWidth={design.tableware === "white_gold" ? 1.8 : 0.9} />
        <circle r={5.2} fill="none" stroke={rim} strokeWidth={0.5} opacity={0.6} />
        <circle cx={11.5} cy={-5} r={3.2} fill={design.tableware === "white_gold" ? "#F5EBD0" : palette[(n + 2) % palette.length]} stroke={INK} strokeWidth={0.7} />
        <rect x={-15} y={-5} width={3.6} height={10} rx={1.2} fill={design.tableware === "white_gold" ? "#D4AF37" : palette[(n + 1) % palette.length]} stroke={INK} strokeWidth={0.5} />
        {design.placeCards && <rect x={-6} y={10.5} width={12} height={4} rx={1} fill="#FFFFFF" stroke={INK} strokeWidth={0.6} />}
        {design.favourBoxes && <g><rect x={9} y={3} width={6} height={6} fill={theme?.accent ?? "#E84F8B"} stroke={INK} strokeWidth={0.6} /><path d="M9,6h6M12,3v6" stroke="#FFFFFF" strokeWidth={0.8} /></g>}
        {design.partyHats && <path d="M-3.5,3.5L0,-4.5L3.5,3.5Z" fill={palette[(n + 3) % palette.length]} stroke={INK} strokeWidth={0.6} />}
      </g>
    );
  };

  return (
    <svg className={className} viewBox={`0 0 ${width.toFixed(0)} ${height.toFixed(0)}`} role="img" data-testid="table-sketch"
      aria-label={`Top view: ${tables.length} ${design.shape === "round" ? "round" : "long"} table${tables.length > 1 ? "s" : ""} for ${design.kids} children`}>
      <defs>
        <pattern id={`${gid}-sequin`} width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.4" fill="#FFFFFF" opacity="0.65" /></pattern>
        <pattern id={`${gid}-leaves`} width="14" height="10" patternUnits="userSpaceOnUse"><ellipse cx="7" cy="5" rx="5" ry="2.2" fill="#5E8C5A" opacity="0.8" transform="rotate(-25 7 5)" /></pattern>
      </defs>
      <rect width={width} height={height} rx={18} fill="#FBF7F4" />
      {tables.map((t, i) => (
        <g key={`t-${i}`}>
          {t.seats.map((s, k) => (
            <rect key={`c-${k}`} x={-CHAIR.w / 2} y={-CHAIR.d / 2} width={CHAIR.w} height={CHAIR.d} rx={9}
              transform={`translate(${s.x} ${s.y}) rotate(${deg(s.facing) - 90})`}
              fill={chairColour} fillOpacity={design.chairs === "clear_ghost" ? 0.55 : 1} stroke={INK} strokeWidth={1.2} data-chair="" />
          ))}
          {t.kind === "long"
            ? <rect x={t.x} y={t.y} width={t.w} height={t.h} rx={3} fill={design.clothColor} stroke={INK} strokeWidth={1.4} />
            : <circle cx={t.x + t.w / 2} cy={t.y + t.h / 2} r={t.w / 2} fill={design.clothColor} stroke={INK} strokeWidth={1.4} />}
          {runner(t)}
          {t.seats.map((s) => setting(s, t))}
          {centrepiece(t, `cp-${i}`)}
        </g>
      ))}
    </svg>
  );
}
