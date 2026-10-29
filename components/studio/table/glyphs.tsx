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
  /** The plain plates', cups' and napkin band's colours. */
  plate?: string;
  /** The small plain plate's own colour (2026-10-29). */
  smallPlate?: string;
  cup?: string;
  holder?: string;
  /** The kids' chair's colour (white, pink or light blue). */
  chair?: string;
  /** The plain placemats', plain bottle labels' colours and the plain plates' shape (2026-10-29). */
  placemat?: string;
  label?: string;
  plateShape?: string;
  /** Which seat (varies the colours round the table). */
  seat?: number;
}

const pick = (c: GlyphColours, k: number) => c.palette[((c.seat ?? 0) + k) % c.palette.length];

// The owner's kids' chairs (2026-10-28); gold chiavari is the grown-ups'.
export const CHAIR_COLOUR: Record<string, string> = { white_kids: "#FFFFFF", blue_kids: "#38BDF8", bow_kids: "#F9D3DF", gold_chiavari: GOLD };

/** The low table's floor cushion, from above. */
export const cushion = () => <rect x={-20} y={-20} width={40} height={40} rx={11} fill="#FFFFFF" stroke={INK} strokeWidth={1.2} />;

/** A paper plate cut with a wavy edge, radius r. */
export function scallop(r: number, bumps = 14) {
  return Array.from({ length: bumps * 2 }, (_, i) => {
    const a = (i * Math.PI) / bumps, rr = i % 2 ? r * 0.9 : r;
    return `${i ? "L" : "M"}${(Math.cos(a) * rr).toFixed(1)},${(Math.sin(a) * rr).toFixed(1)}`;
  }).join("") + "Z";
}

/** One item's drawing, from above, centred on (0, 0). */
export function glyph(key: TableItemKey, id: string, c: GlyphColours): ReactNode {
  switch (key) {
    case "chairs":
      return <g>
        <rect x={-19} y={-17} width={38} height={34} rx={id === "bow_kids" ? 17 : 9} fill={(id === "blue_kids" && c.chair) || (CHAIR_COLOUR[id] ?? "#fff")} stroke={INK} strokeWidth={1.2} />
        {id === "gold_chiavari" && <path d="M-13,-11h26M-13,-4h26" stroke="#B8932B" strokeWidth={1.2} />}
        {id === "white_kids" && <path d="M-13,-12q13,-7 26,0M-19,-2h-3v14h3M19,-2h3v14h-3" fill="none" stroke={INK} strokeWidth={1} />}
        {id === "blue_kids" && <path d="M-12,-17v-3h24v3M-6,-20v3M0,-20v3M6,-20v3" fill="none" stroke={INK} strokeWidth={1} />}
        {id === "bow_kids" && <g fill="none" stroke={INK} strokeWidth={1}><ellipse cx={-7} cy={-21} rx={6} ry={4} /><ellipse cx={7} cy={-21} rx={6} ry={4} /></g>}
      </g>;
    case "chairDecor":
      if (id === "tulle_bow") return <g fill={pick(c, 1)} stroke={INK} strokeWidth={0.7}><path d="M0,0L-9,-5L-9,5Z" /><path d="M0,0L9,-5L9,5Z" /><circle r={2.2} /></g>;
      if (id === "balloon") return <g><path d="M0,0q3,6 0,12" fill="none" stroke={INK} strokeWidth={0.6} /><ellipse cx={0} cy={-6} rx={7} ry={8} fill={pick(c, 2)} stroke={INK} strokeWidth={0.8} /></g>;
      if (id === "name_flag") return <g><path d="M-8,-6L8,-6L0,6Z" fill={c.accent} stroke={INK} strokeWidth={0.7} /><path d="M-4,-3h8" stroke="#fff" strokeWidth={1} /></g>;
      return null;
    case "napkins": {
      const fill = id === "printed" ? `url(#napkin-print)` : c.napkin;
      if (id === "striped") return <g><rect x={-5} y={-9} width={10} height={18} rx={1.5} fill="#FCE7F3" stroke={INK} strokeWidth={0.6} /><rect x={-5} y={-9} width={10} height={18} rx={1.5} fill="url(#stripes)" /></g>;
      if (id === "foil") return <g><rect x={-5} y={-9} width={10} height={18} rx={1.5} fill="#DCEBF7" stroke={INK} strokeWidth={0.6} /><rect x={-5} y={-9} width={10} height={18} rx={1.5} fill="url(#sequin)" /></g>;
      if (id === "plain") return <path d="M-6,-8L6,0L-6,8Z" fill={c.napkin} stroke={INK} strokeWidth={0.6} />;
      return <g>
        <rect x={-5} y={-9} width={10} height={18} rx={1.5} fill={c.napkin} stroke={INK} strokeWidth={0.6} />
        {id === "printed" && <rect x={-5} y={-9} width={10} height={18} rx={1.5} fill={fill} />}
        {id === "folded" && <path d="M-5,0h10" stroke={INK} strokeWidth={0.5} opacity={0.5} />}
        {id === "bow" && <g fill={c.accent} stroke={INK} strokeWidth={0.4}><path d="M0,0L-5,-3L-5,3Z" /><path d="M0,0L5,-3L5,3Z" /><circle r={1.2} /></g>}
      </g>;
    }
    case "cutlery": {
      const wood = id === "wooden" || id === "dipped" || id === "glitter";
      const col = id === "gold" ? GOLD : wood ? "#D9B98C" : id === "silver" ? "#C9CED6" : pick(c, 3);
      // The kids' wooden cutlery: the handle ends dipped in pastel pink or silver glitter.
      const tip = id === "dipped" ? "#F9A8D4" : id === "glitter" ? "#C9CED6" : null;
      return <g stroke={INK} strokeWidth={0.4} fill={col}>
        <rect x={-3.5} y={-8} width={2} height={16} rx={1} /><rect x={1.5} y={-8} width={2} height={16} rx={1} />
        {tip && <g fill={tip}><rect x={-3.5} y={3} width={2} height={5} rx={1} /><rect x={1.5} y={3} width={2} height={5} rx={1} /></g>}
      </g>;
    }
    case "chargers":
      if (id === "gold") return <circle r={12.5} fill={GOLD} stroke={INK} strokeWidth={0.7} />;
      if (id === "rattan") return <g><circle r={12.5} fill="#D9B98C" stroke={INK} strokeWidth={0.7} /><circle r={12.5} fill="url(#rattan)" /></g>;
      if (id === "beaded") return <g><circle r={12.5} fill="#EEF5FA" fillOpacity={0.7} stroke="#9FB4C8" strokeWidth={0.7} />{Array.from({ length: 24 }, (_, i) => <circle key={i} cx={Math.cos((i * Math.PI) / 12) * 11.5} cy={Math.sin((i * Math.PI) / 12) * 11.5} r={0.9} fill="#C7D6E2" />)}</g>;
      return null;
    case "placemats":
      // The kids' A3 placemats (42 × 29.7 cm), in the theme's design.
      if (id === "plain") return <rect x={-21} y={-15} width={42} height={30} rx={1.5} fill={c.placemat ?? pick(c, 1)} stroke={INK} strokeWidth={0.6} />;
      if (id === "pattern" || id === "watercolour" || id === "sparkle") return <g>
        <rect x={-21} y={-15} width={42} height={30} rx={1.5} fill={pick(c, 1)} stroke={INK} strokeWidth={0.6} />
        {id === "pattern" && <rect x={-21} y={-15} width={42} height={30} rx={1.5} fill="url(#napkin-print)" />}
        {id === "watercolour" && <rect x={-16} y={-10} width={32} height={20} rx={8} fill="#FFFFFF" opacity={0.55} />}
        {id === "sparkle" && <rect x={-21} y={-15} width={42} height={30} rx={1.5} fill="url(#sequin)" />}
      </g>;
      if (id === "printed") return <g><rect x={-20} y={-11} width={36} height={22} rx={2} fill={pick(c, 1)} stroke={INK} strokeWidth={0.6} /><rect x={-20} y={-11} width={36} height={22} rx={2} fill="url(#napkin-print)" /></g>;
      if (id === "shaped") return <path d={star(0, 0, 16)} fill={pick(c, 1)} stroke={INK} strokeWidth={0.6} />;
      if (id === "name") return <g><rect x={-20} y={-11} width={36} height={22} rx={2} fill={pick(c, 1)} stroke={INK} strokeWidth={0.6} /><rect x={-17} y={-8} width={30} height={16} rx={1} fill="#fff" /></g>;
      return null;
    case "plates": {
      // The kids' table's paper plates; white & gold and pastel melamine are the grown-ups'.
      if (id === "plain") {
        const big = c.plate ?? pick(c, 0);
        const shape = (r: number, w: number, fill = big) => c.plateShape === "square" ? <rect x={-r * 0.92} y={-r * 0.92} width={r * 1.84} height={r * 1.84} rx={r * 0.2} fill={fill} stroke={INK} strokeWidth={w} />
          : c.plateShape === "scalloped" ? <path d={scallop(r, 16)} fill={fill} stroke={INK} strokeWidth={w} /> : <circle r={r} fill={fill} stroke={INK} strokeWidth={w} />;
        return <g>{shape(10, 0.8)}{shape(7.5, 0.6, c.smallPlate ?? big)}</g>;
      }
      if (id === "iridescent") return <path d={Array.from({ length: 8 }, (_, i) => { const a = Math.PI / 8 + (i * Math.PI) / 4; return `${i ? "L" : "M"}${(Math.cos(a) * 10).toFixed(1)},${(Math.sin(a) * 10).toFixed(1)}`; }).join("") + "Z"} fill="#EBDDF7" stroke="#A78BC9" strokeWidth={0.9} />;
      if (id === "holo_square") return <g><rect x={-9.5} y={-9.5} width={19} height={19} rx={2.5} fill="#E2E7ED" stroke="#8C99A6" strokeWidth={0.9} /><rect x={-6.5} y={-6.5} width={13} height={13} rx={1.5} fill="none" stroke="#B9C3CD" strokeWidth={0.5} /></g>;
      if (id === "silver") return <g><circle r={9.5} fill="#E5E8EC" stroke="#8C99A6" strokeWidth={0.9} /><circle r={7} fill="none" stroke="#B9C3CD" strokeWidth={0.6} strokeDasharray="1 0.8" /></g>;
      if (id === "scalloped") return <path d={scallop(9.5)} fill={PASTELS[(c.seat ?? 0) % PASTELS.length]} stroke={INK} strokeWidth={0.8} />;
      if (id === "shaped") return <path d={star(0, 0, 10.5)} fill={pick(c, 0)} stroke={INK} strokeWidth={0.8} />;
      if (id === "themed") return <g><circle r={9} fill={pick(c, 0)} stroke={INK} strokeWidth={0.9} /><circle r={9} fill="url(#napkin-print)" /><circle r={5.2} fill="#fff" stroke={INK} strokeWidth={0.5} opacity={0.85} /></g>;
      const fill = id === "white_gold" ? "#FFFFFF" : id === "pastel" ? PASTELS[(c.seat ?? 0) % PASTELS.length] : pick(c, 0);
      const rim = id === "white_gold" ? GOLD : INK;
      return <g><circle r={9} fill={fill} stroke={rim} strokeWidth={id === "white_gold" ? 1.8 : 0.9} /><circle r={5.2} fill="none" stroke={rim} strokeWidth={0.5} opacity={0.6} /></g>;
    }
    case "cups":
      if (id === "white_straw") return <g><circle r={3.4} fill="#FFFFFF" stroke={INK} strokeWidth={0.7} /><path d="M0,0L4,-5" stroke="#B9C3CD" strokeWidth={0.9} /></g>;
      if (id === "iridescent") return <g><circle r={3.4} fill="#E9DDF7" stroke="#8C99A6" strokeWidth={0.7} /><path d="M0,0L4,-5" stroke="#FFFFFF" strokeWidth={0.9} /></g>;
      if (id === "plain") return <circle r={3.4} fill={c.cup ?? pick(c, 2)} stroke={INK} strokeWidth={0.7} />;
      if (id === "pastel") return <circle r={3.4} fill={PASTELS[((c.seat ?? 0) + 2) % PASTELS.length]} stroke={INK} strokeWidth={0.7} />;
      if (id === "straw") return <g><circle r={3.4} fill={pick(c, 2)} stroke={INK} strokeWidth={0.7} /><path d="M0,0L4,-5" stroke="#fff" strokeWidth={1.4} /><path d="M0,0L4,-5" stroke={c.accent} strokeWidth={0.6} strokeDasharray="1 1" /></g>;
      if (id === "printed") return <g><circle r={3.4} fill={pick(c, 2)} stroke={INK} strokeWidth={0.7} /><circle r={3.4} fill="url(#napkin-print)" /></g>;
      if (id === "pouch") return <g><rect x={-2.6} y={-3.6} width={5.2} height={7.2} rx={1.2} fill={pick(c, 2)} stroke={INK} strokeWidth={0.6} /><path d="M0,-3.6L1.5,-6.5" stroke={c.accent} strokeWidth={0.8} /></g>;
      if (id === "gold_rim") return <circle r={3.4} fill="#F3F7FA" stroke={GOLD} strokeWidth={1.2} />;
      if (id === "lidded") return <g><circle r={3.4} fill={pick(c, 2)} stroke={INK} strokeWidth={0.7} /><circle r={2.2} fill="#fff" stroke={INK} strokeWidth={0.4} /><path d="M-1,0h2M0,-1v2" stroke={INK} strokeWidth={0.4} /></g>;
      return null;
    case "cutleryHolder":
      if (id === "pocket") return <g><rect x={-6} y={-2} width={12} height={11} rx={1} fill={pick(c, 1)} stroke={INK} strokeWidth={0.5} /><rect x={-6} y={-2} width={12} height={11} rx={1} fill="url(#napkin-print)" /><rect x={-4} y={2} width={8} height={4} rx={0.6} fill="#fff" /></g>;
      if (id === "band") return <rect x={-6} y={-1} width={12} height={4} rx={0.8} fill={c.holder ?? "#BAE6FD"} stroke={INK} strokeWidth={0.5} />;
      if (id === "tag") return <g><path d="M-6,0h12" stroke="#FFFFFF" strokeWidth={0.8} /><path d={scallop(3, 10)} fill="#FFFFFF" stroke={INK} strokeWidth={0.4} /><path d={star(0, 0, 1.8)} fill="#C9CED6" /></g>;
      return null;
    case "bottleLabel":
      return <g><circle r={3.2} fill={id === "plain" ? c.label ?? "#EAF4FB" : id === "sparkle" ? "#E9DDF7" : "#EAF4FB"} stroke="#8C99A6" strokeWidth={0.6} /><circle r={1.5} fill="#93C5FD" stroke={INK} strokeWidth={0.3} /></g>;
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
      // The theme cutouts, standing on their bases.
      if (id === "cutouts") return <g>{[[-12, 6], [0, 9], [12, 6]].map(([dx, h], i) => <g key={i}><rect x={dx - 4.5} y={-h} width={9} height={h + 2} rx={2} fill={pick(c, i)} stroke={INK} strokeWidth={0.7} /><ellipse cx={dx} cy={3} rx={5.5} ry={1.6} fill="#EEF5FA" stroke={INK} strokeWidth={0.5} /></g>)}</g>;
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
    <pattern id="stripes" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="1.5" height="3" fill="#FFFFFF" /></pattern>
    <PartyPatterns />
  </>;
}

/** The kids' table's printed cover and confetti: also used by the perspective drawing. */
export function PartyPatterns() {
  return <>
    <pattern id="cloth-print" width="14" height="14" patternUnits="userSpaceOnUse"><path d={star(4, 4, 2.6)} fill="#FFFFFF" opacity="0.9" /><circle cx="11" cy="10" r="1.3" fill="#FFFFFF" opacity="0.8" /></pattern>
    <pattern id="confetti" width="12" height="10" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.2" fill="#F472B6" /><circle cx="8" cy="3" r="1" fill="#60A5FA" /><rect x="5" y="6" width="2.4" height="1.2" fill="#FACC15" transform="rotate(30 6 6.5)" />
      <circle cx="10.5" cy="8" r="1.1" fill="#A78BFA" /><path d="M1,8q1.5,-2 3,0" fill="none" stroke="#C0C7D1" strokeWidth="0.7" />
    </pattern>
  </>;
}
