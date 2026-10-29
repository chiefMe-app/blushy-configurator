// The kids' table seen from above, to scale (1 unit = 1 cm): every table,
// chair and place setting as chosen (lib/studio/tableCatalog.ts), drawn with
// the same pictures as the option cards (./glyphs). Not a render.
import { NONE, onFloor } from "@/lib/studio/tableCatalog";
import type { TableSetup } from "@/lib/studio/tableSetup";
import { arrangeTables, outlinePath, type Placed, type Seat } from "@/lib/studio/tableShapes";
import { GlyphDefs, INK, cushion, glyph, type GlyphColours } from "./glyphs";

export { arrangeTables };

const deg = (rad: number) => (rad * 180) / Math.PI;

export default function TableSketch({ table, palette, accent, className }: { table: TableSetup; palette: string[]; accent: string; className?: string }) {
  const ch = table.choices;
  const { tables, width, height } = arrangeTables(table);
  const colours: GlyphColours = { palette: palette.length ? palette : ["#FBCFE8"], accent, cloth: table.clothColor, runner: table.runnerColor, napkin: table.napkinColor,
    plate: table.plateColor, cup: table.cupColor, holder: table.holderColor, chair: table.chairColor };
  let seatNo = 0;

  const floor = onFloor(ch);
  const tableShape = (t: Placed, props: Record<string, unknown>) => <path d={outlinePath(t.outline)} {...props} />;

  const cloth = (t: Placed) => <g>
    {/* A ruffle: the edge drawn wide, dashed, under the top. */}
    {ch.tablecloth === "ruffle" && <g><path d={outlinePath(t.outline)} fill="none" stroke={INK} strokeWidth={11.6} strokeDasharray="3 2" strokeLinejoin="round" /><path d={outlinePath(t.outline)} fill="none" stroke={table.clothColor} strokeWidth={10} strokeLinejoin="round" /></g>}
    {tableShape(t, { fill: table.clothColor, stroke: INK, strokeWidth: 1.4 })}
    {ch.tablecloth === "sequin" && tableShape(t, { fill: "url(#sequin)" })}
    {ch.tablecloth === "printed" && tableShape(t, { fill: "url(#cloth-print)" })}
  </g>;

  const runner = (t: Placed) => {
    if (ch.runner === NONE) return null;
    // Confetti is scattered on the cloth itself: no runner under it.
    const fill = ch.runner === "tulle" ? `${table.runnerColor}99` : ch.runner === "confetti" ? "none" : table.runnerColor;
    const over = ch.runner === "sequin" ? "url(#sequin)" : ch.runner === "greenery" ? "url(#leaves)" : ch.runner === "confetti" ? "url(#confetti)" : null;
    const d = outlinePath(t.runner);
    return <g><path d={d} fill={fill} />{over && <path d={d} fill={over} />}</g>;
  };

  const centrepieces = (t: Placed, key: string) => {
    if (ch.centrepiece === NONE) return null;
    // A long table is narrow: small centrepieces in the gaps between the places.
    const k = t.centres.length > 1 ? 0.5 : t.kind === "round" ? 1.2 : 0.9;
    return <g key={key}>{t.centres.map(([x, y], i) => <g key={i} transform={`translate(${x} ${y}) scale(${k})`}>{glyph("centrepiece", ch.centrepiece, colours)}</g>)}</g>;
  };

  const setting = (s: Seat, t: Placed) => {
    const c = { ...colours, seat: seatNo++ };
    // An A3 placemat is 30 cm deep: the setting starts at the edge.
    const inward = 16;
    const px = s.ex + Math.cos(s.facing) * inward, py = s.ey + Math.sin(s.facing) * inward;
    const at = (x: number, y: number, key: Parameters<typeof glyph>[0]) => ch[key] !== NONE && <g transform={`translate(${x} ${y})`}>{glyph(key, ch[key], c)}</g>;
    // Turned so the child sits at the bottom and looks up the page: x is the
    // child's right, -y away from the child (towards the middle of the table).
    // 2026-10-29: the places were drawn the other way round (the napkin on the
    // child's right, the cup by the child), unlike the owner's layout and the render.
    return (
      <g key={`set-${c.seat}`} transform={`translate(${px} ${py}) rotate(${deg(s.facing) + 90})`}>
        {at(0, 0, "placemats")}
        {at(0, 0, "chargers")}
        {at(0, 0, "plates")}
        {at(-16, 0, "napkins")}
        {at(-16, 0, "cutlery")}
        {at(-16, 0, "cutleryHolder")}
        {at(16, -11, "cups")}
        {at(23, -11, "bottleLabel")}
        {at(0, 12.5, "nameCards")}
        {at(-17, -11, "partyHats")}
      </g>
    );
  };

  return (
    <svg className={className} viewBox={`0 0 ${width.toFixed(0)} ${height.toFixed(0)}`} role="img" data-testid="table-sketch"
      aria-label={`Top view: ${tables.length} ${(tables[0]?.kind ?? "standard").replace("_", " ")} table${tables.length > 1 ? "s" : ""} for ${table.kids} children`}>
      <defs><GlyphDefs /></defs>
      <rect width={width} height={height} rx={18} fill="#FBF7F4" />
      {tables.map((t, i) => (
        <g key={`t-${i}`}>
          {t.seats.map((s, k) => (
            <g key={`c-${k}`} transform={`translate(${s.x} ${s.y}) rotate(${deg(s.facing) - 90})`} data-chair="">
              {floor ? cushion() : glyph("chairs", ch.chairs, colours)}
              {!floor && ch.chairDecor !== NONE && <g transform="translate(0 -15)">{glyph("chairDecor", ch.chairDecor, { ...colours, seat: k })}</g>}
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
