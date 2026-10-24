"use client";

// 2026-10-23: a live sketch of the customer's choices — not a render. It is
// drawn from the configuration alone (boards, colours, lettering, balloons,
// florals, neon, number light, plinths and standees) and changes the moment
// a choice does, so each step can be seen as it is made. The same layout also
// draws the small clickable piece picker on the Style tab.

import { useEffect, useMemo, useState } from "react";
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

/**
 * 2026-10-24: a photographed base for the Single Round (the customer's own
 * picture): its garland, cut away from the board so the board, lettering and
 * neon can be drawn beneath and above it. The board circle's centre and
 * radius are fractions of the (square) image's width.
 */
const ROUND_BASE = {
  src: "/design/sketch/round-base-balloons.webp",
  // Which balloon family each pixel belongs to (0 white/silver, 100 blue,
  // 200 lilac), worked out ahead of time and smoothed, so a balloon's
  // highlight is repainted with the balloon.
  families: "/design/sketch/round-base-families.png",
  cx: 0.5147, cy: 0.5627, r: 0.3863,
};

type Rgb = [number, number, number];
const hexRgb = (h: string): Rgb => {
  const m = h.replace("#", "");
  const v = m.length === 3 ? m.split("").map((c) => c + c).join("") : m.padEnd(6, "0").slice(0, 6);
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
};
const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

type BaseData = { img: ImageData; fam: Uint8Array; means: { rgb: Rgb; l: number }[] };
const baseCache = new Map<string, Promise<BaseData>>();
const pixelsOf = (src: string, w?: number, h?: number) => new Promise<ImageData>((resolve, reject) => {
  const im = new Image();
  im.onload = () => {
    const c = document.createElement("canvas");
    c.width = w ?? im.naturalWidth; c.height = h ?? im.naturalHeight;
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(im, 0, 0, c.width, c.height);
    resolve(ctx.getImageData(0, 0, c.width, c.height));
  };
  im.onerror = reject;
  im.src = src;
});
function loadBase(src: string, familiesSrc: string): Promise<BaseData> {
  let p = baseCache.get(src);
  if (!p) {
    p = pixelsOf(src).then(async (img) => {
      const map = await pixelsOf(familiesSrc, img.width, img.height);
      const px = img.data;
      const fam = new Uint8Array(img.width * img.height);
      const sum = [0, 1, 2].map(() => [0, 0, 0, 0]);
      for (let k = 0, i = 0; i < px.length; k++, i += 4) {
        const f = Math.min(2, Math.round(map.data[i] / 100));
        fam[k] = f;
        if (px[i + 3] < 128) continue;
        sum[f][0] += px[i]; sum[f][1] += px[i + 1]; sum[f][2] += px[i + 2]; sum[f][3]++;
      }
      const means = sum.map(([r, g, b, n]) => {
        const rgb: Rgb = n ? [r / n, g / n, b / n] : [235, 235, 235];
        return { rgb, l: lum(...rgb) };
      });
      return { img, fam, means };
    });
    baseCache.set(src, p);
  }
  return p;
}

/**
 * The base's balloons repainted in the chosen colours, keeping their shading:
 * each family takes the closest chosen colour (a family already close to it is
 * left as photographed). Starts as the photo itself.
 */
function useRecoloredBase(src: string | null, familiesSrc: string, palette: string[]): string | null {
  const [url, setUrl] = useState<string | null>(src);
  const key = palette.join(",");
  useEffect(() => {
    if (!src) { setUrl(null); return; }
    let alive = true;
    let made: string | null = null;
    loadBase(src, familiesSrc).then(({ img, fam, means }) => {
      if (!alive) return;
      const cols = palette.map(hexRgb);
      const dist = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      // Greedy nearest match, each chosen colour used once while any are left.
      const target: (Rgb | null)[] = [null, null, null];
      const used = new Set<number>();
      // White and silver stay white and silver when a white, silver or grey
      // is chosen (matched by distance, the chrome would pull them to a pastel).
      const sat = (c: Rgb) => { const mx = Math.max(...c), mn = Math.min(...c); return mx ? (mx - mn) / mx : 0; };
      const neutralK = cols.map((c, k) => ({ c, k })).filter(({ c }) => sat(c) < 0.12).sort((a, b) => lum(...b.c) - lum(...a.c))[0];
      if (neutralK) { target[0] = neutralK.c; used.add(neutralK.k); }
      const pairs = means.flatMap((m, f) => cols.map((c, k) => ({ f, k, dd: dist(m.rgb, c) }))).sort((a, b) => a.dd - b.dd);
      for (const pr of pairs) {
        if (target[pr.f] || (used.has(pr.k) && used.size < cols.length)) continue;
        target[pr.f] = cols[pr.k]; used.add(pr.k);
      }
      const out = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
      const px = out.data;
      // A family already on its colour stays as photographed.
      const keep = target.map((t, f) => !t || dist(t, means[f].rgb) < 24 || (f === 0 && sat(t) < 0.12 && lum(...t) > 170));
      for (let k = 0, i = 0; i < px.length; k++, i += 4) {
        if (px[i + 3] === 0) continue;
        const f = fam[k];
        if (keep[f]) continue;
        const t = target[f]!, lb = means[f].l, l = lum(px[i], px[i + 1], px[i + 2]);
        for (let c = 0; c < 3; c++) {
          px[i + c] = l <= lb ? t[c] * (l / lb) : t[c] + (255 - t[c]) * ((l - lb) / (255 - lb));
        }
      }
      const cv = document.createElement("canvas");
      cv.width = out.width; cv.height = out.height;
      cv.getContext("2d")!.putImageData(out, 0, 0);
      cv.toBlob((b) => {
        if (!alive || !b) return;
        made = URL.createObjectURL(b);
        setUrl(made);
      }, "image/png");
    }).catch(() => { if (alive) setUrl(src); });
    return () => { alive = false; if (made) URL.revokeObjectURL(made); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, familiesSrc, key]);
  return url;
}

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
  const hasNumber = !!d.numberLight?.enabled && !!(d.numberLight.value ?? "").trim();
  // A lone round board is drawn on the photographed base.
  const roundBase = items.length === 1 && items[0].type === "round";
  const baseS = hasNumber || cutoutPreviews.length ? 740 : 820;
  const { pieces, scale } = useMemo(() => {
    if (!roundBase) return layoutPieces(items, { maxW: hasNumber || cutoutPreviews.length ? 640 : 760, maxH: 640 });
    const R = ROUND_BASE.r * baseS;
    const piece: Piece = { item: items[0], idx: 0, x: VB / 2 - R, w: 2 * R, h: 2 * R, top: FLOOR - 2 * R, curveLeft: false };
    return { pieces: [piece], scale: (2 * R) / Math.max(60, items[0].widthCm || 200) };
  }, [items, hasNumber, cutoutPreviews.length, roundBase, baseS]);
  const palette = d.balloonColors.length ? d.balloonColors : (theme?.balloonColors ?? ["#f7c5d8"]);
  const balloonsOn = normalizeBalloonStyle(d.balloonStyle) !== "none";
  const baseUrl = useRecoloredBase(roundBase && balloonsOn ? ROUND_BASE.src : null, ROUND_BASE.families, palette);
  const baseBox = { x: VB / 2 - ROUND_BASE.cx * baseS, y: FLOOR - (ROUND_BASE.cy + ROUND_BASE.r) * baseS, s: baseS };
  const garlandSize = 18 + scale * 8;
  // How far the garland reaches past the boards' outer edges.
  const garlandReach = !balloonsOn ? 12 : roundBase ? (1 - ROUND_BASE.cx - ROUND_BASE.r) * baseS : garlandSize * 2.6;
  // On the base the garland covers the board's left side: words sit right of centre.
  const textShift = roundBase && balloonsOn ? pieces[0].w * 0.06 : 0;

  // Garland balloons: on the outer sides of the group, as the renders have them.
  const balloons = useMemo(() => {
    if (!balloonsOn || pieces.length === 0 || roundBase) return [] as { x: number; y: number; r: number; c: string }[];
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
  }, [balloonsOn, pieces, palette, garlandSize, items.length, d.balloonRingStyle, roundBase]);
  // Plinths are left out of the sketch: they stood in front of the lettering.

  // Florals on the base: tucked in along its garland (angles in degrees).
  const baseFlorals = roundBase && balloonsOn && d.garlandFlorals
    ? [218, 198, 178, 160, 143, 126, 108, 92, 76, -52, -68].map((a, i) => {
        const R = pieces[0].w / 2, t = (a * Math.PI) / 180, rr = R * (i % 2 ? 1.08 : 1.0);
        return { x: VB / 2 + Math.cos(t) * rr, y: FLOOR - R - Math.sin(t) * rr, r: R * 0.11, a: -a + 90 };
      })
    : [];

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
        const size = Math.min(p.w * f.k * (textShift ? 0.9 : 1), (p.w * (textShift ? 0.7 : 0.85)) / Math.max(4, Math.max(...ls.map((l) => l.length)) * 0.5));
        const cy = p.item.type === "round" ? FLOOR - p.w / 2 : p.top + p.h * 0.36;
        const tx = p.x + p.w / 2 + textShift;
        return (
          <text key={`t${p.item.id}`} x={tx} y={cy - ((ls.length - 1) * size * 0.55)} textAnchor="middle"
            fontFamily={f.family} fontWeight={f.weight} fontSize={size} fill={resolveTextColorHex(p.item.text.color, accent)}
            style={{ paintOrder: "stroke" }} stroke="rgba(39,22,23,.12)" strokeWidth={1}>
            {ls.map((l, i) => <tspan key={i} x={tx} dy={i === 0 ? 0 : size * 1.1}>{l}</tspan>)}
          </text>
        );
      })}

      {/* The photographed garland on the round base, in the chosen colours */}
      {roundBase && baseUrl && <image href={baseUrl} x={baseBox.x} y={baseBox.y} width={baseBox.s} height={baseBox.s} />}
      {baseFlorals.map((f, i) => (
        <g key={`bf${i}`} transform={`rotate(${f.a} ${f.x} ${f.y})`}>
          <ellipse cx={f.x - f.r * 0.7} cy={f.y} rx={f.r} ry={f.r * 0.36} fill="#7fa77a" />
          <ellipse cx={f.x + f.r * 0.7} cy={f.y} rx={f.r * 0.9} ry={f.r * 0.32} fill="#93b98c" />
          {i % 3 === 0 && <circle cx={f.x} cy={f.y} r={f.r * 0.42} fill="#fff4f7" stroke="#f3b8cc" strokeWidth={2} />}
        </g>
      ))}

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
        const cx = neonPiece.x + neonPiece.w / 2 + textShift;
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
