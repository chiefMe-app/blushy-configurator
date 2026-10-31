// The grown-ups' table drawn from above, to scale in centimetres (2026-10-31):
// one table with every place set — chair, charger, plate, napkin, cutlery,
// glass and name card — the runner and the centrepieces. The pieces are the
// kids' table's drawings (./glyphs), so a card shows what the table will.
import { NONE } from "@/lib/studio/tableCatalog";
import { adultCounts, adultOption, type AdultItemKey, type AdultTable } from "@/lib/studio/adultTable";
import { GlyphDefs, INK, glyph, type GlyphColours } from "./glyphs";

type Theme = { balloonColors: string[]; accent: string };

export const adultColours = (a: AdultTable, theme: Theme): GlyphColours => ({
  palette: theme.balloonColors, accent: theme.accent, cloth: a.clothColor, runner: a.runnerColor, napkin: a.napkinColor,
});

const has = (a: AdultTable, key: AdultItemKey) => a.choices[key] !== NONE && !!adultOption(key, a.choices[key]);
const LEAVES = "#6E9A6A";

/** The cloth or bare wood the table shows. */
const tableFill = (a: AdultTable) => (has(a, "tablecloth") ? a.clothColor : "#EADBC8");

/** A runner, along (or round) the middle. */
function Runner({ a, len, round }: { a: AdultTable; len: number; round?: boolean }) {
  if (!has(a, "runner")) return null;
  const green = a.choices.runner === "greenery";
  if (round) return green
    ? <circle r={34} fill="none" stroke={LEAVES} strokeWidth={10} strokeDasharray="7 4" />
    : <circle r={34} fill={a.runnerColor} stroke={INK} strokeWidth={0.6} opacity={0.9} />;
  return green
    ? <g>{Array.from({ length: Math.floor(len / 9) }, (_, i) => <ellipse key={i} cx={-len / 2 + 5 + i * 9} cy={(i % 2 ? 4 : -4)} rx={6} ry={2.6} fill={LEAVES} stroke={INK} strokeWidth={0.3} transform={`rotate(${i % 2 ? 25 : -25} ${-len / 2 + 5 + i * 9} ${i % 2 ? 4 : -4})`} />)}</g>
    : <rect x={-len / 2} y={-17} width={len} height={34} fill={a.runnerColor} stroke={INK} strokeWidth={0.6} />;
}

/** One place, the guest at +y, the middle of the table at −y. */
function Place({ a, c, seat }: { a: AdultTable; c: GlyphColours; seat: number }) {
  const g = (key: AdultItemKey, x: number, y: number, rot = 0) => has(a, key) && <g transform={`translate(${x} ${y}) rotate(${rot})`}>{glyph(key, a.choices[key], { ...c, seat })}</g>;
  return <g>
    {g("chairs", 0, 40)}
    {g("chairDecor", 0, 58)}
    {g("chargers", 0, 0)}
    {g("plates", 0, 0)}
    {g("napkins", -18, 0)}
    {g("cutlery", 18, 0)}
    {g("cups", 15, -15)}
    {g("nameCards", 0, -15)}
  </g>;
}

export default function AdultTableSketch({ a, theme, className }: { a: AdultTable; theme: Theme; className?: string }) {
  const c = adultColours(a, theme);
  const { perTable } = adultCounts(a);
  const seats = Math.min(perTable, a.guests);
  const centre = has(a, "centrepiece") ? glyph("centrepiece", a.choices.centrepiece, c) : null;
  if (a.choices.table === "round") {
    const R = 80, M = 80;
    return (
      <svg className={className} viewBox={`${-R - M} ${-R - M} ${2 * (R + M)} ${2 * (R + M)}`} role="img" aria-label="The grown-ups' table from above">
        <defs><GlyphDefs /></defs>
        <circle r={R} fill={tableFill(a)} stroke={INK} strokeWidth={1.4} />
        <Runner a={a} len={0} round />
        {Array.from({ length: seats }, (_, i) => {
          const t = (i / seats) * 2 * Math.PI - Math.PI / 2;
          return <g key={i} transform={`translate(${Math.cos(t) * (R - 17)} ${Math.sin(t) * (R - 17)}) rotate(${(t * 180) / Math.PI - 90})`}><Place a={a} c={c} seat={i} /></g>;
        })}
        {centre && <g transform="scale(1.2)">{centre}</g>}
      </svg>
    );
  }
  const side = Math.ceil(seats / 2), W = 90, L = side * 62 + 24, M = 74;
  const pieces = Math.max(1, Math.round(L / 140));
  const xs = (n: number) => Array.from({ length: n }, (_, i) => -((n - 1) * 62) / 2 + i * 62);
  return (
    <svg className={className} viewBox={`${-L / 2 - 20} ${-W / 2 - M} ${L + 40} ${W + 2 * M}`} role="img" aria-label="The grown-ups' table from above">
      <defs><GlyphDefs /></defs>
      <rect x={-L / 2} y={-W / 2} width={L} height={W} rx={3} fill={tableFill(a)} stroke={INK} strokeWidth={1.4} />
      <Runner a={a} len={L} />
      {xs(side).map((x, i) => <g key={`b${i}`} transform={`translate(${x} ${W / 2 - 17})`}><Place a={a} c={c} seat={i} /></g>)}
      {xs(seats - side).map((x, i) => <g key={`t${i}`} transform={`translate(${x} ${-W / 2 + 17}) rotate(180)`}><Place a={a} c={c} seat={i + side} /></g>)}
      {/* A centrepiece about every 1.4 m along the middle. */}
      {centre && Array.from({ length: pieces }, (_, i) => <g key={i} transform={`translate(${-L / 2 + (L * (i + 0.5)) / pieces} 0) scale(0.75)`}>{centre}</g>)}
    </svg>
  );
}

/** One option's picture on its card: the piece, or the table, cloth or runner. */
export function AdultGlyph({ itemKey, id, colours }: { itemKey: AdultItemKey; id: string; colours: GlyphColours }) {
  if (id === NONE) return <svg viewBox="-24 -24 48 48" aria-hidden="true"><circle r={14} fill="none" stroke="#d9c9cf" strokeWidth={2} strokeDasharray="4 3" /><path d="M-8,8L8,-8" stroke="#d9c9cf" strokeWidth={2} /></svg>;
  if (itemKey === "table") return <svg viewBox="-60 -40 120 80" aria-hidden="true">
    {id === "round" ? <circle r={30} fill="#fff" stroke={INK} strokeWidth={2} /> : <rect x={-50} y={-17} width={100} height={34} rx={3} fill="#fff" stroke={INK} strokeWidth={2} />}
  </svg>;
  if (itemKey === "tablecloth" || itemKey === "runner") return <svg viewBox="-30 -20 60 40" aria-hidden="true">
    <rect x={-24} y={-14} width={48} height={28} rx={3} fill={itemKey === "tablecloth" ? colours.cloth : "#fff"} stroke={INK} strokeWidth={1} />
    {itemKey === "runner" && (id === "greenery"
      ? Array.from({ length: 6 }, (_, i) => <ellipse key={i} cx={-20 + i * 8} cy={i % 2 ? 2 : -2} rx={5} ry={2.2} fill={LEAVES} transform={`rotate(${i % 2 ? 25 : -25} ${-20 + i * 8} ${i % 2 ? 2 : -2})`} />)
      : <rect x={-24} y={-5} width={48} height={10} fill={colours.runner} />)}
  </svg>;
  const scale: Partial<Record<AdultItemKey, number>> = { chairs: 0.9, centrepiece: 0.95, chargers: 1.4, plates: 1.9, napkins: 1.9, cutlery: 2, cups: 4, nameCards: 3, chairDecor: 1.8 };
  return <svg viewBox="-24 -24 48 48" aria-hidden="true"><defs><GlyphDefs /></defs><g transform={`scale(${scale[itemKey] ?? 1})`}>{glyph(itemKey, id, colours)}</g></svg>;
}
