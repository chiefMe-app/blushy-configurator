// The kids' table seen from above, to scale (1 unit = 1 cm): every table,
// chair and place setting as chosen (lib/studio/tableCatalog.ts), drawn with
// the same pictures as the option cards (./glyphs). Not a render.
import { NONE } from "@/lib/studio/tableCatalog";
import { tableCounts, type TableSetup } from "@/lib/studio/tableSetup";
import { GlyphDefs, INK, glyph, type GlyphColours } from "./glyphs";

const CHAIR = { d: 34, gap: 9 };
const SIZES = { long: { w: 180, h: 60 }, round: { w: 120, h: 120 }, square: { w: 100, h: 100 } };

interface Seat { x: number; y: number; /** Direction from the seat towards the table, radians. */ facing: number; /** The table edge in front of the seat. */ ex: number; ey: number }
interface Placed { kind: "long" | "round" | "square"; x: number; y: number; w: number; h: number; seats: Seat[] }

const facingSeat = (ex: number, ey: number, facing: number): Seat => ({
  ex, ey, facing,
  x: ex - Math.cos(facing) * (CHAIR.gap + CHAIR.d / 2),
  y: ey - Math.sin(facing) * (CHAIR.gap + CHAIR.d / 2),
});

/** Where every table and seat goes, in cm. */
export function arrangeTables(t: Pick<TableSetup, "kids" | "choices">): { tables: Placed[]; width: number; height: number } {
  const { perTable } = tableCounts(t);
  const shape = (t.choices.table as Placed["kind"]) in SIZES ? (t.choices.table as Placed["kind"]) : "long";
  const S = SIZES[shape];
  const reach = CHAIR.gap + CHAIR.d, margin = 30;
  const tables: Placed[] = [];
  if (shape === "long") {
    // Rows of up to two tables joined; a row's children are shared evenly
    // between its two sides along the whole row (10 kids: five a side).
    const rowPitch = S.h + 2 * reach + 70;
    for (let row = 0; row * 2 < perTable.length; row++) {
      const inRow = perTable.slice(row * 2, row * 2 + 2);
      const kids = inRow.reduce((a, b) => a + b, 0), len = inRow.length * S.w;
      const y = margin + reach + row * rowPitch;
      const side = (n: number, top: boolean) => Array.from({ length: n }, (_, k) =>
        facingSeat(margin + (k + 0.5) * (len / n), top ? y : y + S.h, top ? Math.PI / 2 : -Math.PI / 2));
      const seats = [...side(Math.ceil(kids / 2), true), ...side(Math.floor(kids / 2), false)];
      inRow.forEach((_, col) => {
        const x = margin + col * S.w;
        tables.push({ kind: "long", x, y, w: S.w, h: S.h, seats: seats.filter((s) => s.x >= x && s.x < x + S.w) });
      });
    }
    const rows = Math.ceil(perTable.length / 2), cols = Math.min(2, perTable.length);
    return { tables, width: 2 * margin + cols * S.w, height: 2 * margin + rows * rowPitch - 70 };
  }
  const cell = S.w + 2 * reach + 60;
  perTable.forEach((kids, i) => {
    const row = Math.floor(i / 3), col = i % 3;
    const cx = margin + reach + S.w / 2 + col * cell, cy = margin + reach + S.h / 2 + row * cell;
    let seats: Seat[];
    if (shape === "round") {
      seats = Array.from({ length: kids }, (_, k) => {
        const a = -Math.PI / 2 + (k * 2 * Math.PI) / kids;
        return facingSeat(cx + Math.cos(a) * (S.w / 2), cy + Math.sin(a) * (S.w / 2), a + Math.PI);
      });
    } else {
      // Square: up to two a side, the sides filled in turn.
      const perSide = [0, 0, 0, 0];
      for (let k = 0; k < kids; k++) perSide[k % 4]++;
      const h = S.w / 2;
      seats = perSide.flatMap((n, sideNo) => Array.from({ length: n }, (_, k) => {
        const off = (k + 0.5) * (S.w / n) - h;
        const [ex, ey, f] = sideNo === 0 ? [cx + off, cy - h, Math.PI / 2] : sideNo === 1 ? [cx + h, cy + off, Math.PI]
          : sideNo === 2 ? [cx - off, cy + h, -Math.PI / 2] : [cx - h, cy - off, 0];
        return facingSeat(ex, ey, f);
      }));
    }
    tables.push({ kind: shape, x: cx - S.w / 2, y: cy - S.h / 2, w: S.w, h: S.h, seats });
  });
  const rows = Math.ceil(perTable.length / 3), cols = Math.min(3, perTable.length);
  return { tables, width: 2 * margin + cols * cell - 60, height: 2 * margin + rows * cell - 60 };
}

const deg = (rad: number) => (rad * 180) / Math.PI;

export default function TableSketch({ table, palette, accent, className }: { table: TableSetup; palette: string[]; accent: string; className?: string }) {
  const ch = table.choices;
  const { tables, width, height } = arrangeTables(table);
  const colours: GlyphColours = { palette: palette.length ? palette : ["#FBCFE8"], accent, cloth: table.clothColor, runner: table.runnerColor, napkin: table.napkinColor };
  let seatNo = 0;

  const tableShape = (t: Placed, props: Record<string, unknown>) => t.kind === "round"
    ? <circle cx={t.x + t.w / 2} cy={t.y + t.h / 2} r={t.w / 2} {...props} />
    : <rect x={t.x} y={t.y} width={t.w} height={t.h} rx={3} {...props} />;

  const cloth = (t: Placed) => <g>
    {ch.tablecloth === "ruffle" && (t.kind === "round"
      ? <circle cx={t.x + t.w / 2} cy={t.y + t.h / 2} r={t.w / 2 + 5} fill={table.clothColor} stroke={INK} strokeWidth={0.8} strokeDasharray="3 2" />
      : <rect x={t.x - 5} y={t.y - 5} width={t.w + 10} height={t.h + 10} rx={6} fill={table.clothColor} stroke={INK} strokeWidth={0.8} strokeDasharray="3 2" />)}
    {tableShape(t, { fill: table.clothColor, stroke: INK, strokeWidth: 1.4 })}
    {ch.tablecloth === "sequin" && tableShape(t, { fill: "url(#sequin)" })}
    {ch.tablecloth === "printed" && tableShape(t, { fill: "url(#cloth-print)" })}
  </g>;

  const runner = (t: Placed) => {
    if (ch.runner === NONE) return null;
    // Confetti is scattered on the cloth itself: no runner under it.
    const fill = ch.runner === "tulle" ? `${table.runnerColor}99` : ch.runner === "confetti" ? "none" : table.runnerColor;
    const over = ch.runner === "sequin" ? "url(#sequin)" : ch.runner === "greenery" ? "url(#leaves)" : ch.runner === "confetti" ? "url(#confetti)" : null;
    const cx = t.x + t.w / 2, cy = t.y + t.h / 2;
    if (t.kind === "long") return <g><rect x={t.x} y={cy - 9} width={t.w} height={18} fill={fill} />{over && <rect x={t.x} y={cy - 9} width={t.w} height={18} fill={over} />}</g>;
    if (t.kind === "square") return <g><rect x={cx - 9} y={t.y} width={18} height={t.h} fill={fill} />{over && <rect x={cx - 9} y={t.y} width={18} height={t.h} fill={over} />}</g>;
    return <g><circle cx={cx} cy={cy} r={30} fill={fill} />{over && <circle cx={cx} cy={cy} r={30} fill={over} />}</g>;
  };

  const centrepieces = (t: Placed, key: string) => {
    if (ch.centrepiece === NONE) return null;
    const cx = t.x + t.w / 2, cy = t.y + t.h / 2;
    const one = (x: number, y: number, k: number, i: number) => <g key={`${key}-${i}`} transform={`translate(${x} ${y}) scale(${k})`}>{glyph("centrepiece", ch.centrepiece, colours)}</g>;
    if (t.kind !== "long") return one(cx, cy, t.kind === "square" ? 0.75 : 1, 0);
    // A long table is 60 cm deep: small centrepieces go in the gaps between the places.
    const xs = Array.from(new Set(t.seats.filter((s) => s.facing > 0).map((s) => s.x))).sort((a, b) => a - b);
    const gaps = xs.length > 1 ? xs.slice(1).map((x, i) => (x + xs[i]) / 2) : [t.x + t.w * 0.18, t.x + t.w * 0.82];
    return <g key={key}>{gaps.map((gx, i) => one(gx, cy, 0.5, i))}</g>;
  };

  const setting = (s: Seat, t: Placed) => {
    const c = { ...colours, seat: seatNo++ };
    const inward = t.kind === "round" ? 16 : 13;
    const px = s.ex + Math.cos(s.facing) * inward, py = s.ey + Math.sin(s.facing) * inward;
    const at = (x: number, y: number, key: Parameters<typeof glyph>[0]) => ch[key] !== NONE && <g transform={`translate(${x} ${y})`}>{glyph(key, ch[key], c)}</g>;
    return (
      <g key={`set-${c.seat}`} transform={`translate(${px} ${py}) rotate(${deg(s.facing) - 90})`}>
        {at(-2, 0, "placemats")}
        {at(0, 0, "chargers")}
        {at(0, 0, "plates")}
        {at(-15, 0, "napkins")}
        {at(-15, 0, "cutlery")}
        {at(11.5, -5, "cups")}
        {at(0, 12.5, "nameCards")}
        {at(0, 0, "partyHats")}
      </g>
    );
  };

  return (
    <svg className={className} viewBox={`0 0 ${width.toFixed(0)} ${height.toFixed(0)}`} role="img" data-testid="table-sketch"
      aria-label={`Top view: ${tables.length} ${tables[0]?.kind ?? "long"} table${tables.length > 1 ? "s" : ""} for ${table.kids} children`}>
      <defs><GlyphDefs /></defs>
      <rect width={width} height={height} rx={18} fill="#FBF7F4" />
      {tables.map((t, i) => (
        <g key={`t-${i}`}>
          {t.seats.map((s, k) => (
            <g key={`c-${k}`} transform={`translate(${s.x} ${s.y}) rotate(${deg(s.facing) - 90})`} data-chair="">
              {glyph("chairs", ch.chairs, colours)}
              {ch.chairDecor !== NONE && <g transform="translate(0 -15)">{glyph("chairDecor", ch.chairDecor, { ...colours, seat: k })}</g>}
            </g>
          ))}
          {cloth(t)}
          {runner(t)}
          {t.seats.map((s) => setting(s, t))}
          {centrepieces(t, `cp-${i}`)}
        </g>
      ))}
    </svg>
  );
}
