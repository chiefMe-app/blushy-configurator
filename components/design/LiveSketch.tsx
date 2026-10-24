"use client";

// 2026-10-23: a live sketch of the customer's choices — not a render. It is
// drawn from the configuration alone (boards, colours, lettering, balloons,
// florals, neon, number light, plinths and standees) and changes the moment
// a choice does, so each step can be seen as it is made. The same layout also
// draws the small clickable piece picker on the Style tab.

import { useMemo } from "react";
import {
  themeById,
  resolveTextColorHex,
  normalizeBalloonStyle,
  SHIMMER_COLOR_HEX,
  type BuilderConfig,
  type BackdropItem,
} from "@/lib/config";

const VB = 1000;
const FLOOR = 870;

type Piece = {
  item: BackdropItem;
  idx: number;
  x: number;      // left edge
  w: number;
  h: number;
  top: number;    // y of the top
  curveLeft: boolean; // half arch: which top corner is rounded
};

/** Pieces laid out left to right at a shared scale, the group centred. */
function layoutPieces(items: BackdropItem[], room: { maxW: number; maxH: number }): { pieces: Piece[]; scale: number } {
  if (items.length === 0) return { pieces: [], scale: 1 };
  const gapCm = 14;
  const totalWcm = items.reduce((s, it) => s + Math.max(40, it.widthCm || 100), 0) + gapCm * (items.length - 1);
  const maxHcm = Math.max(...items.map((it) => Math.max(60, it.heightCm || 200)));
  const scale = Math.min(room.maxW / totalWcm, room.maxH / maxHcm);
  let x = (VB - totalWcm * scale) / 2;
  const mid = VB / 2;
  const pieces = items.map((item, idx) => {
    const w = Math.max(40, item.widthCm || 100) * scale;
    const h = Math.max(60, item.heightCm || 200) * scale;
    const p: Piece = { item, idx, x, w, h, top: FLOOR - h, curveLeft: x + w / 2 < mid };
    x += w + gapCm * scale;
    return p;
  });
  return { pieces, scale };
}

/** The board's outline as an SVG path (filled boards), or null for the ring. */
function piecePath(p: Piece): string | null {
  const { x, w, top } = p;
  const r = w / 2;
  switch (p.item.type) {
    case "round": {
      const cy = FLOOR - r;
      return `M ${x} ${cy} a ${r} ${r} 0 1 0 ${w} 0 a ${r} ${r} 0 1 0 ${-w} 0 Z`;
    }
    case "rect": case "banner": case "shimmer_wall":
      return `M ${x} ${FLOOR} V ${top} H ${x + w} V ${FLOOR} Z`;
    case "half_arch": {
      const rr = Math.min(w, FLOOR - top);
      return p.curveLeft
        ? `M ${x} ${FLOOR} V ${top + rr} A ${rr} ${rr} 0 0 1 ${x + rr} ${top} H ${x + w} V ${FLOOR} Z`
        : `M ${x} ${FLOOR} V ${top} H ${x + w - rr} A ${rr} ${rr} 0 0 1 ${x + w} ${top + rr} V ${FLOOR} Z`;
    }
    case "balloon_ring":
      return null;
    default: // arch and open frame
      return `M ${x} ${FLOOR} V ${top + r} A ${r} ${r} 0 0 1 ${x + w} ${top + r} V ${FLOOR} Z`;
  }
}

function seeded(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Points along a piece's outer edge where its garland sits, from the foot up. */
function garlandTrack(p: Piece, side: "left" | "right" | "both"): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const { x, w, top } = p;
  const r = w / 2;
  const cx = x + r;
  // Angles in units of pi, walked from a to b.
  const arc = (ox: number, oy: number, rad: number, a: number, b: number) => {
    const n = Math.max(4, Math.round(Math.abs(b - a) * rad / 9));
    for (let i = 0; i <= n; i++) {
      const t = Math.PI * (a + (b - a) * (i / n));
      pts.push({ x: ox + Math.cos(t) * rad, y: oy - Math.sin(t) * rad });
    }
  };
  if (p.item.type === "round" || p.item.type === "balloon_ring") {
    const cy = FLOOR - r;
    if (side === "right") arc(cx, cy, r, -0.4, 0.62);
    else if (side === "left") arc(cx, cy, r, 1.4, 0.38);
    else arc(cx, cy, r, 1.4, -0.4);
    return pts;
  }
  if (p.item.type === "half_arch") {
    // The curved corner faces outward; the garland follows it.
    const rr = Math.min(w, FLOOR - top);
    const sx = p.curveLeft ? x : x + w;
    for (let y = FLOOR; y >= top + rr; y -= 18) pts.push({ x: sx, y });
    if (p.curveLeft) arc(x + rr, top + rr, rr, 1, 0.5); else arc(x + w - rr, top + rr, rr, 0, 0.5);
    return pts;
  }
  const flat = p.item.type === "rect" || p.item.type === "banner" || p.item.type === "shimmer_wall";
  const springY = flat ? top : top + r;
  const up = (sx: number) => { for (let y = FLOOR; y >= springY; y -= 18) pts.push({ x: sx, y }); };
  const along = (from: number, to: number) => { for (let i = 0; i <= 10; i++) pts.push({ x: x + w * (from + (to - from) * (i / 10)), y: top }); };
  if (side === "left" || side === "both") {
    up(x);
    if (flat) along(0, side === "both" ? 1 : 0.5); else arc(cx, springY, r, 1, side === "both" ? 0 : 0.45);
    if (side === "both") up(x + w);
  } else {
    up(x + w);
    if (flat) along(1, 0.5); else arc(cx, springY, r, 0, 0.55);
  }
  return pts;
}

export default function LiveSketch({
  config,
  activeId,
  cutoutPreviews = [],
}: {
  config: BuilderConfig;
  /** The piece being styled — outlined in pink. */
  activeId?: string | null;
  /** Standee pictures (selected characters), drawn standing on the floor. */
  cutoutPreviews?: string[];
}) {
  const d = config.decor;
  const theme = themeById(config.theme);
  const accent = theme?.accent ?? "#ff0d66";
  const items = d.backdropItems;
  const plinthCount = Math.min(3, d.plinthSizes.length);
  const hasNumber = !!d.numberLight?.enabled && !!(d.numberLight.value ?? "").trim();
  const { pieces, scale } = useMemo(
    () => layoutPieces(items, { maxW: hasNumber || cutoutPreviews.length ? 640 : 760, maxH: 640 }),
    [items, hasNumber, cutoutPreviews.length],
  );
  const palette = d.balloonColors.length ? d.balloonColors : (theme?.balloonColors ?? ["#f7c5d8"]);
  const balloonsOn = normalizeBalloonStyle(d.balloonStyle) !== "none";
  const garlandSize = 18 + scale * 8;
  // How far the garland reaches past the boards' outer edges.
  const garlandReach = balloonsOn ? garlandSize * 2.6 : 12;

  // Garland balloons: on the outer sides of the group, as the renders have them.
  const balloons = useMemo(() => {
    if (!balloonsOn || pieces.length === 0) return [] as { x: number; y: number; r: number; c: string }[];
    const rnd = seeded(items.length * 131 + palette.length * 17 + 7);
    const out: { x: number; y: number; r: number; c: string }[] = [];
    const add = (track: { x: number; y: number }[], size: number) => {
      track.forEach((pt, i) => {
        const n = 2 + (i % 2);
        for (let k = 0; k < n; k++) {
          const r = size * (0.55 + rnd() * 0.75);
          out.push({ x: pt.x + (rnd() - 0.5) * size * 1.6, y: pt.y + (rnd() - 0.5) * size * 1.4, r, c: palette[Math.floor(rnd() * palette.length)] });
        }
      });
      // A pile at the foot.
      const foot = track[0];
      if (foot) for (let k = 0; k < 6; k++) {
        const r = size * (0.8 + rnd() * 0.7);
        out.push({ x: foot.x + (rnd() - 0.5) * size * 3.2, y: FLOOR - r * 0.9 - rnd() * size, r, c: palette[Math.floor(rnd() * palette.length)] });
      }
    };
    const size = garlandSize;
    if (pieces.length === 1) {
      const p = pieces[0];
      if (p.item.type === "balloon_ring" && d.balloonRingStyle === "none") return out;
      add(garlandTrack(p, p.item.type === "balloon_ring" && d.balloonRingStyle !== "half" ? "both" : "right"), size);
    } else {
      add(garlandTrack(pieces[0], "left"), size);
      add(garlandTrack(pieces[pieces.length - 1], "right"), size);
    }
    return out.sort((a, b) => a.y - b.y);
  }, [balloonsOn, pieces, palette, garlandSize, items.length, d.balloonRingStyle]);

  // Plinths: XXL 90, XL 75, L 60 cm tall, in front of the boards.
  const plinthH: Record<string, number> = { large: 90, medium: 75, small: 60 };
  const plinthD: Record<string, number> = { large: 40, medium: 36, small: 33 };
  const groupMid = pieces.length ? (pieces[0].x + pieces[pieces.length - 1].x + pieces[pieces.length - 1].w) / 2 : VB / 2;

  const neon = d.neonSign?.enabled && (d.neonSign.text ?? "").trim() ? d.neonSign : null;
  const neonPiece = neon ? (pieces.find((p) => p.idx === (neon.panelIndex ?? 0)) ?? pieces[0]) : undefined;

  const lines = (s: string) => {
    const words = s.trim().split(/\s+/);
    if (s.includes("\n")) return s.split("\n").map((l) => l.trim()).filter(Boolean);
    return words.length >= 2 ? [words.slice(0, Math.ceil(words.length / 2)).join(" "), words.slice(Math.ceil(words.length / 2)).join(" ")] : [s.trim()];
  };
  const fontFor = (f: string) => f === "block"
    ? { family: "var(--bz-sans), Arial, sans-serif", weight: 800, k: 0.13 }
    : f === "elegant" ? { family: "Georgia, 'Times New Roman', serif", weight: 400, k: 0.14 }
    : { family: "var(--bz-logo), 'Segoe Script', cursive", weight: 600, k: 0.19 };

  return (
    <svg viewBox={`0 0 ${VB} ${VB}`} className="bz-sketch" role="img" aria-label="Live sketch of your choices">
      <defs>
        <linearGradient id="skWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f1ece8" /><stop offset="1" stopColor="#e7e1dc" /></linearGradient>
        <linearGradient id="skFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ddd6cf" /><stop offset="1" stopColor="#eae4de" /></linearGradient>
        <radialGradient id="skShine" cx="0.32" cy="0.28" r="0.75"><stop offset="0" stopColor="#fff" stopOpacity=".85" /><stop offset=".35" stopColor="#fff" stopOpacity=".15" /><stop offset="1" stopColor="#000" stopOpacity=".12" /></radialGradient>
        <filter id="skGlow" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="7" /></filter>
        <filter id="skShadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#000" floodOpacity=".12" /></filter>
        <pattern id="skSequin" width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="8" cy="8" r="6.2" fill="rgba(255,255,255,.55)" /><circle cx="6" cy="6" r="2" fill="#fff" opacity=".7" />
        </pattern>
      </defs>
      <rect width={VB} height={FLOOR} fill="url(#skWall)" />
      <rect y={FLOOR} width={VB} height={VB - FLOOR} fill="url(#skFloor)" />

      {/* Boards */}
      {pieces.map((p) => {
        const path = piecePath(p);
        const color = p.item.type === "shimmer_wall"
          ? (SHIMMER_COLOR_HEX[d.shimmerColor ?? "silver"] ?? "#d1d5db")
          : (p.item.color || d.backdropColor || "#ffffff");
        if (p.item.type === "balloon_ring") {
          const r = p.w / 2;
          return <circle key={p.item.id} cx={p.x + r} cy={FLOOR - r} r={r - 6} fill="none" stroke="#efe6d2" strokeWidth={12} filter="url(#skShadow)" />;
        }
        if (p.item.type === "open_arch_frame") {
          return <path key={p.item.id} d={path!} fill="none" stroke={color} strokeWidth={Math.max(18, p.w * 0.16)} strokeLinejoin="round" filter="url(#skShadow)" />;
        }
        return (
          <g key={p.item.id}>
            <path d={path!} fill={color} stroke="rgba(39,22,23,.18)" strokeWidth={2} filter="url(#skShadow)" />
            {p.item.type === "shimmer_wall" && <path d={path!} fill="url(#skSequin)" />}
          </g>
        );
      })}

      {/* Theme graphic: a few small motifs on the board */}
      {pieces.filter((p) => p.item.graphic?.enabled && piecePath(p)).map((p) => {
        const rnd = seeded(p.idx * 97 + 3);
        return (
          <g key={`g${p.item.id}`} opacity={0.75}>
            {Array.from({ length: 6 }, (_, i) => {
              const cx = p.x + p.w * (0.2 + rnd() * 0.6), cy = p.top + p.h * (0.45 + rnd() * 0.45), s = p.w * 0.05;
              return <path key={i} d={`M ${cx} ${cy - s} L ${cx + s * 0.3} ${cy - s * 0.3} L ${cx + s} ${cy} L ${cx + s * 0.3} ${cy + s * 0.3} L ${cx} ${cy + s} L ${cx - s * 0.3} ${cy + s * 0.3} L ${cx - s} ${cy} L ${cx - s * 0.3} ${cy - s * 0.3} Z`} fill={accent} />;
            })}
          </g>
        );
      })}

      {/* Printed lettering */}
      {pieces.filter((p) => p.item.text?.enabled && (p.item.text.value ?? "").trim() && piecePath(p) && p.item.type !== "open_arch_frame").map((p) => {
        const f = fontFor(p.item.text.fontStyle);
        const ls = lines(p.item.text.value);
        const size = Math.min(p.w * f.k, (p.w * 0.85) / Math.max(4, Math.max(...ls.map((l) => l.length)) * 0.5));
        const cy = p.item.type === "round" ? FLOOR - p.w / 2 : p.top + p.h * 0.36;
        return (
          <text key={`t${p.item.id}`} x={p.x + p.w / 2} y={cy - ((ls.length - 1) * size * 0.55)} textAnchor="middle"
            fontFamily={f.family} fontWeight={f.weight} fontSize={size} fill={resolveTextColorHex(p.item.text.color, accent)}
            style={{ paintOrder: "stroke" }} stroke="rgba(39,22,23,.12)" strokeWidth={1}>
            {ls.map((l, i) => <tspan key={i} x={p.x + p.w / 2} dy={i === 0 ? 0 : size * 1.1}>{l}</tspan>)}
          </text>
        );
      })}

      {/* Balloon garland (and florals tucked in) */}
      {balloons.map((b, i) => (
        <g key={`b${i}`}>
          <circle cx={b.x} cy={b.y} r={b.r} fill={b.c} stroke="rgba(39,22,23,.10)" strokeWidth={1} />
          <circle cx={b.x} cy={b.y} r={b.r} fill="url(#skShine)" />
        </g>
      ))}
      {d.garlandFlorals && balloonsOn && balloons.filter((_, i) => i % 7 === 3).map((b, i) => (
        <g key={`f${i}`}>
          <ellipse cx={b.x + b.r * 0.6} cy={b.y - b.r * 0.2} rx={b.r * 0.55} ry={b.r * 0.22} fill="#7fa77a" transform={`rotate(-30 ${b.x + b.r * 0.6} ${b.y - b.r * 0.2})`} />
          <circle cx={b.x - b.r * 0.4} cy={b.y + b.r * 0.4} r={b.r * 0.3} fill="#fff4f7" stroke="#f3b8cc" strokeWidth={2} />
        </g>
      ))}

      {/* Neon sign — over the garland, so it always shows */}
      {neon && neonPiece && (() => {
        const ls = lines(neon.text);
        const isRing = neonPiece.item.type === "balloon_ring";
        const size = Math.min(neonPiece.w * 0.16, 64);
        const cx = neonPiece.x + neonPiece.w / 2;
        const cy = isRing ? FLOOR - neonPiece.w * 0.62 : neonPiece.top + neonPiece.h * 0.34;
        const txt = (glow: boolean) => (
          <text x={cx} y={cy - (ls.length - 1) * size * 0.5} textAnchor="middle" fontFamily="var(--bz-logo), cursive" fontWeight={700}
            fontSize={size} fill={glow ? "#ffb36b" : "#fffaf0"} filter={glow ? "url(#skGlow)" : undefined} opacity={glow ? 0.9 : 1}
            stroke={glow ? "#ffb36b" : "#f0b36e"} strokeWidth={glow ? 6 : 1.2}>
            {ls.map((l, i) => <tspan key={i} x={cx} dy={i === 0 ? 0 : size * 1.05}>{l}</tspan>)}
          </text>
        );
        return <g>{txt(true)}{txt(false)}</g>;
      })()}

      {/* Plinths in front */}
      {d.plinthSizes.slice(0, plinthCount).map((sz, i) => {
        const h = (plinthH[sz] ?? 75) * scale, w = (plinthD[sz] ?? 36) * scale;
        const offsets = plinthCount === 1 ? [0] : plinthCount === 2 ? [-0.6, 0.6] : [-1.15, 0, 1.15];
        const cx = groupMid + offsets[i] * w;
        return (
          <g key={`p${i}`}>
            <rect x={cx - w / 2} y={FLOOR - h + 8} width={w} height={h} rx={4} fill="#fbfaf8" stroke="rgba(39,22,23,.18)" strokeWidth={2} />
            <ellipse cx={cx} cy={FLOOR - h + 8} rx={w / 2} ry={w * 0.12} fill="#ffffff" stroke="rgba(39,22,23,.18)" strokeWidth={2} />
          </g>
        );
      })}

      {/* Light-up number on the floor, beside the decor */}
      {hasNumber && pieces.length > 0 && (() => {
        const last = pieces[pieces.length - 1];
        const h = 90 * scale;
        const x = Math.min(VB - h * 0.45, last.x + last.w + garlandReach + h * 0.3);
        return (
          <text x={x} y={FLOOR + 4} textAnchor="middle" fontFamily="var(--bz-sans), Arial, sans-serif" fontWeight={900} fontSize={h * 1.15}
            fill="#f6d68f" stroke="#c99a46" strokeWidth={3} strokeDasharray="2 10" strokeLinecap="round">{d.numberLight!.value}</text>
        );
      })()}

      {/* Standees on the floor at the front left */}
      {cutoutPreviews.slice(0, 3).map((src, i) => {
        const h = 150 * scale, w = h * 0.62;
        const x = Math.max(8, (pieces[0]?.x ?? 200) - garlandReach - w * 0.9 + i * w * 0.6);
        return <image key={`s${i}`} href={src} x={x} y={FLOOR - h + 14} width={w} height={h} preserveAspectRatio="xMidYMax meet" />;
      })}

      {/* The piece being styled */}
      {activeId && pieces.length > 1 && pieces.filter((p) => p.item.id === activeId).map((p) => {
        const path = piecePath(p) ?? `M ${p.x} ${FLOOR} V ${p.top} H ${p.x + p.w} V ${FLOOR} Z`;
        return <path key="active" d={path} fill="none" stroke="#ff0d66" strokeWidth={6} strokeDasharray="16 10" strokeLinejoin="round" />;
      })}
    </svg>
  );
}

/** The small clickable diagram of the setup's pieces (Style tab). */
export function PieceDiagram({
  items, activeId, onPick, labels,
}: {
  items: BackdropItem[];
  activeId: string;
  onPick: (id: string) => void;
  labels: string[];
}) {
  const { pieces } = layoutPieces(items, { maxW: 880, maxH: 700 });
  return (
    <svg viewBox={`0 120 ${VB} 880`} className="bz-piece-diagram" role="group" aria-label="Pick the piece to design">
      {pieces.map((p) => {
        const on = p.item.id === activeId;
        const path = piecePath(p);
        const cx = p.x + p.w / 2;
        const r = p.w / 2;
        return (
          <g key={p.item.id} role="button" tabIndex={0} aria-pressed={on} aria-label={labels[p.idx]}
            onClick={() => onPick(p.item.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(p.item.id); } }}
            style={{ cursor: "pointer", outline: "none" }}>
            {p.item.type === "balloon_ring"
              ? <circle cx={cx} cy={FLOOR - r} r={r - 14} fill="none" stroke={on ? "#ff0d66" : "#ffc6da"} strokeWidth={28} />
              : p.item.type === "open_arch_frame"
                ? <path d={path!} fill="none" stroke={on ? "#ff0d66" : "#ffc6da"} strokeWidth={Math.max(30, p.w * 0.2)} strokeLinejoin="round" />
                : <path d={path!} fill={on ? "#ff0d66" : "#ffd6e5"} stroke={on ? "#c2004b" : "#ffb3cd"} strokeWidth={6} />}
            {on && <text x={cx} y={FLOOR - Math.min(p.h, 300) * 0.45} textAnchor="middle" fontSize={64} fill="#fff" fontWeight={900}>✓</text>}
            {/* "Main", "Second", "Left"…: the first word of the piece's name. */}
            <text x={cx} y={FLOOR + 92} textAnchor="middle" fontSize={78} fontWeight={800}
              fill={on ? "#ff0d66" : "#b98aa0"} style={{ fontFamily: "var(--bz-sans)" }}>{(labels[p.idx] ?? "").split(" ")[0]}</text>
          </g>
        );
      })}
    </svg>
  );
}
