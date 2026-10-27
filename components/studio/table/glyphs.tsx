// Drawn placeholders for the kids' table items, seen from above, in
// centimetres around (0, 0). The same drawing is used on the option cards
// (scaled up) and in the to-scale top view, so a card always shows what the
// table will. Real photos replace the cards' drawings when the owner adds them
// (lib/studio/tableCatalog.ts `photo`).
import type { ReactNode } from "react";
import type { TableItemKey } from "@/lib/studio/tableCatalog";

export const INK = "#5a4950";
export const GOLD = "#D4AF37";
export const PASTELS = ["#FBCFE8", "#BAE6FD", "#DDD6FE", "#BBF7D0", "#FEF08A"];

export interface GlyphColours {
  /** The theme's palette (balloon colours) and accent. */
  palette: string[];
  accent: string;
  cloth: string;
  runner: string;
  napkin: string;
  /** Which seat (varies the colours round the table). */
  seat?: number;
}

const pick = (c: GlyphColours, k: number) => c.palette[((c.seat ?? 0) + k) % c.palette.length];

export const CHAIR_COLOUR: Record<string, string> = { white_kids: "#FFFFFF", gold_chiavari: GOLD, clear_ghost: "#E6EEF5" };

/** One item's drawing, from above, centred on (0, 0). */
export function glyph(key: TableItemKey, id: string, c: GlyphColours): ReactNode {
  switch (key) {
    case "chairs":
      return <g>
        <rect x={-19} y={-17} width={38} height={34} rx={9} fill={CHAIR_COLOUR[id] ?? "#fff"} fillOpacity={id === "clear_ghost" ? 0.55 : 1} stroke={INK} strokeWidth={1.2} />
        {id === "gold_chiavari" && <path d="M-13,-11h26M-13,-4h26" stroke="#B8932B" strokeWidth={1.2} />}
        {id === "clear_ghost" && <path d="M-13,-12q13,-6 26,0" fill="none" stroke="#9FB4C8" strokeWidth={1.2} />}
      </g>;
    case "chairDecor":
      if (id === "tulle_bow") return <g fill={pick(c, 1)} stroke={INK} strokeWidth={0.7}><path d="M0,0L-9,-5L-9,5Z" /><path d="M0,0L9,-5L9,5Z" /><circle r={2.2} /></g>;
      if (id === "balloon") return <g><path d="M0,0q3,6 0,12" fill="none" stroke={INK} strokeWidth={0.6} /><ellipse cx={0} cy={-6} rx={7} ry={8} fill={pick(c, 2)} stroke={INK} strokeWidth={0.8} /></g>;
      if (id === "name_flag") return <g><path d="M-8,-6L8,-6L0,6Z" fill={c.accent} stroke={INK} strokeWidth={0.7} /><path d="M-4,-3h8" stroke="#fff" strokeWidth={1} /></g>;
      return null;
    case "napkins": {
      const fill = id === "printed" ? `url(#napkin-print)` : c.napkin;
      return <g>
        <rect x={-5} y={-9} width={10} height={18} rx={1.5} fill={c.napkin} stroke={INK} strokeWidth={0.6} />
        {id === "printed" && <rect x={-5} y={-9} width={10} height={18} rx={1.5} fill={fill} />}
        {id === "folded" && <path d="M-5,0h10" stroke={INK} strokeWidth={0.5} opacity={0.5} />}
        {id === "bow" && <g fill={c.accent} stroke={INK} strokeWidth={0.4}><path d="M0,0L-5,-3L-5,3Z" /><path d="M0,0L5,-3L5,3Z" /><circle r={1.2} /></g>}
      </g>;
    }
    case "cutlery": {
      const col = id === "gold" ? GOLD : id === "wooden" ? "#C9A06B" : pick(c, 3);
      return <g stroke={INK} strokeWidth={0.4} fill={col}>
        <rect x={-3.5} y={-8} width={2} height={16} rx={1} /><rect x={1.5} y={-8} width={2} height={16} rx={1} />
      </g>;
    }
    case "chargers":
      if (id === "gold") return <circle r={12.5} fill={GOLD} stroke={INK} strokeWidth={0.7} />;
      if (id === "rattan") return <g><circle r={12.5} fill="#D9B98C" stroke={INK} strokeWidth={0.7} /><circle r={12.5} fill="url(#rattan)" /></g>;
      if (id === "beaded") return <g><circle r={12.5} fill="#EEF5FA" fillOpacity={0.7} stroke="#9FB4C8" strokeWidth={0.7} />{Array.from({ length: 24 }, (_, i) => <circle key={i} cx={Math.cos((i * Math.PI) / 12) * 11.5} cy={Math.sin((i * Math.PI) / 12) * 11.5} r={0.9} fill="#C7D6E2" />)}</g>;
      return null;
    case "plates": {
      const fill = id === "white_gold" ? "#FFFFFF" : id === "pastel" ? PASTELS[(c.seat ?? 0) % PASTELS.length] : pick(c, 0);
      const rim = id === "white_gold" ? GOLD : INK;
      return <g><circle r={9} fill={fill} stroke={rim} strokeWidth={id === "white_gold" ? 1.8 : 0.9} /><circle r={5.2} fill="none" stroke={rim} strokeWidth={0.5} opacity={0.6} /></g>;
    }
    case "cups":
      if (id === "straw") return <g><circle r={3.4} fill={pick(c, 2)} stroke={INK} strokeWidth={0.7} /><path d="M0,0L4,-5" stroke="#fff" strokeWidth={1.4} /><path d="M0,0L4,-5" stroke={c.accent} strokeWidth={0.6} strokeDasharray="1 1" /></g>;
      if (id === "gold_rim") return <circle r={3.4} fill="#F3F7FA" stroke={GOLD} strokeWidth={1.2} />;
      if (id === "lidded") return <g><circle r={3.4} fill={pick(c, 2)} stroke={INK} strokeWidth={0.7} /><circle r={2.2} fill="#fff" stroke={INK} strokeWidth={0.4} /><path d="M-1,0h2M0,-1v2" stroke={INK} strokeWidth={0.4} /></g>;
      return null;
    case "nameCards":
      if (id === "tent") return <g><rect x={-6} y={-2} width={12} height={4} rx={0.8} fill="#fff" stroke={INK} strokeWidth={0.6} /><path d="M-6,0h12" stroke={INK} strokeWidth={0.3} /></g>;
      if (id === "tag") return <g><circle r={2.6} fill="#fff" stroke={INK} strokeWidth={0.6} /><path d="M2.6,0h3" stroke={c.accent} strokeWidth={0.6} /></g>;
      if (id === "acrylic") return <rect x={-6} y={-1.6} width={12} height={3.2} rx={0.6} fill="#EEF5FA" fillOpacity={0.8} stroke="#9FB4C8" strokeWidth={0.6} />;
      return null;
    case "partyHats":
      if (id === "cone") return <g><circle r={4} fill={pick(c, 3)} stroke={INK} strokeWidth={0.6} /><circle r={1.2} fill="#fff" /></g>;
      if (id === "crown") return <path d="M-4.5,2.5L-4.5,-2L-2,0.5L0,-3.5L2,0.5L4.5,-2L4.5,2.5Z" fill={GOLD} stroke={INK} strokeWidth={0.6} />;
      if (id === "headband") return <g><path d="M-4.5,1.5q4.5,-6 9,0" fill="none" stroke={c.accent} strokeWidth={1.4} /><circle cx={-3.2} cy={-2} r={1.6} fill={pick(c, 1)} stroke={INK} strokeWidth={0.4} /><circle cx={3.2} cy={-2} r={1.6} fill={pick(c, 1)} stroke={INK} strokeWidth={0.4} /></g>;
      return null;
    case "centrepiece":
      if (id === "balloons") return <g>{[[0, 0, 11], [-10, -7, 8], [10, -6, 8], [-7, 9, 7], [9, 8, 7]].map(([dx, dy, r], i) =>
        <circle key={i} cx={dx} cy={dy} r={r} fill={c.palette[i % c.palette.length]} stroke={INK} strokeWidth={0.8} />)}</g>;
      if (id === "florals") return <g>{[[-9, -3], [8, -5], [0, 8]].map(([dx, dy], f) => (
        <g key={f} transform={`translate(${dx} ${dy})`}>
          {Array.from({ length: 5 }, (_, p) => <ellipse key={p} cx={0} cy={-5} rx={3.2} ry={5} fill={["#F9A8D4", "#FFFFFF", "#FDE68A"][f]} stroke={INK} strokeWidth={0.5} transform={`rotate(${p * 72})`} />)}
          <circle r={2.4} fill="#E8A33D" />
        </g>))}<path d="M-18,4q6,-6 12,0M6,-12q6,4 12,0" fill="none" stroke="#5E8C5A" strokeWidth={2} strokeLinecap="round" /></g>;
      if (id === "toppers") return <g>{[[0, 0, 10], [-14, 4, 6], [14, 4, 6]].map(([dx, dy, r], i) => <path key={i} d={star(dx, dy, r)} fill={c.accent} stroke={INK} strokeWidth={0.8} />)}</g>;
      return null;
    default:
      return null;
  }
}

export function star(x: number, y: number, r: number) {
  return Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    return `${i ? "L" : "M"}${(x + Math.cos(a) * rr).toFixed(1)},${(y + Math.sin(a) * rr).toFixed(1)}`;
  }).join("") + "Z";
}

/** Patterns the drawings use: put once in the SVG's <defs>. */
export function GlyphDefs() {
  return <>
    <pattern id="sequin" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.4" fill="#FFFFFF" opacity="0.65" /></pattern>
    <pattern id="leaves" width="14" height="10" patternUnits="userSpaceOnUse"><ellipse cx="7" cy="5" rx="5" ry="2.2" fill="#5E8C5A" opacity="0.8" transform="rotate(-25 7 5)" /></pattern>
    <pattern id="napkin-print" width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="0.7" fill="#FFFFFF" opacity="0.9" /></pattern>
    <pattern id="rattan" width="3" height="3" patternUnits="userSpaceOnUse"><path d="M0,3L3,0" stroke="#A9865A" strokeWidth="0.6" /></pattern>
  </>;
}
