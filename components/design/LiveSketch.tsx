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
  textSizeScale,
  messageLines,
  foilColourFor,
  SHIMMER_COLOR_HEX,
  type BuilderConfig,
  type BackdropItem,
} from "@/lib/config";

const VB = 1000;
const FLOOR = 870;

/**
 * 2026-10-24: the Single Round is drawn on the customer's own render of it
 * (Frozen, no lettering, snowflakes removed), cut into layers: the room with
 * the plinth painted out, a mask of the board (where its colour goes), the
 * balloons on their own, and the plinth. The board's lettering goes between
 * the room and the balloons; plinths, neon, number and standees on top.
 * Geometry is in fractions of the square image.
 */
const ROUND_BASE = {
  room: "/design/sketch/round-room.webp",
  balloons: "/design/sketch/round-balloons.webp",
  // Which balloon family each pixel belongs to (0 white/silver, 100 blue,
  // 200 lilac), worked out ahead of time and smoothed, so a balloon's
  // highlight is repainted with the balloon.
  families: "/design/sketch/round-families.png",
  boardMask: "/design/sketch/round-board-mask.png",
  cx: 0.5004, cy: 0.5154, r: 0.3236,
  // The photographed plinth (the XXL, 90 cm): left, top, width, height.
  plinth: { x: 0.4521, y: 0.5605, w: 0.1143, h: 0.3330 },
};
/** The plinth cut from the same photo, used for every plinth in every sketch. */
const PLINTH_SRC = "/design/sketch/plinth.webp";
const PLINTH_ASPECT = 0.343; // width / height of the sprite (the XXL)
const PLINTH_CM: Record<string, { h: number; d: number }> = { large: { h: 90, d: 40 }, medium: { h: 75, d: 36 }, small: { h: 60, d: 33 } };

type Rgb = [number, number, number];
const hexRgb = (h: string): Rgb => {
  const m = h.replace("#", "");
  const v = m.length === 3 ? m.split("").map((c) => c + c).join("") : m.padEnd(6, "0").slice(0, 6);
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
};
const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;
/** Mirror-metal lettering (silver, gold, rose gold): its tint, else null. */
const METAL_TINT: Record<string, [number, number, number]> = {
  silver: [1.0, 1.01, 1.04], gold: [1.0, 0.84, 0.5], rose_gold: [1.0, 0.8, 0.74],
};
const tintHex = (t: [number, number, number], l: number) => "#" + t.map((k) =>
  Math.max(0, Math.min(255, Math.round(l * 255 * (l > 0.5 ? k : 1 + (k - 1) * 0.5))))
    .toString(16).padStart(2, "0")).join("");
const isWhite = (h: string) => { const [r, g, b] = hexRgb(h || "#ffffff"); return r > 246 && g > 246 && b > 246; };

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
 * each family takes the closest chosen colour. `asShot` (the palette the photo
 * was taken with) shows the photo untouched — "purple kaybolmus" came from
 * repainting Frozen's own lilac a paler lilac.
 */
function useRecoloredBase(src: string | null, familiesSrc: string, palette: string[], asShot: boolean): string | null {
  const [url, setUrl] = useState<string | null>(src);
  const key = palette.join(",");
  useEffect(() => {
    if (!src) { setUrl(null); return; }
    if (asShot) { setUrl(src); return; }
    let alive = true;
    let made: string | null = null;
    loadBase(src, familiesSrc).then(({ img, fam, means }) => {
      if (!alive) return;
      const cols = palette.map(hexRgb);
      const dist = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      const target: (Rgb | null)[] = [null, null, null];
      const used = new Set<number>();
      // White and silver stay white and silver when a white, silver or grey
      // is chosen (matched by distance, the chrome would pull them to a pastel).
      const sat = (c: Rgb) => { const mx = Math.max(...c), mn = Math.min(...c); return mx ? (mx - mn) / mx : 0; };
      const neutralK = cols.map((c, k) => ({ c, k })).filter(({ c }) => sat(c) < 0.12).sort((a, b) => lum(...b.c) - lum(...a.c))[0];
      if (neutralK) { target[0] = neutralK.c; used.add(neutralK.k); }
      // The rest: greedy nearest match, each chosen colour used once while any are left.
      const pairs = means.flatMap((m, f) => cols.map((c, k) => ({ f, k, dd: dist(m.rgb, c) }))).sort((a, b) => a.dd - b.dd);
      for (const pr of pairs) {
        if (target[pr.f] || (used.has(pr.k) && used.size < cols.length)) continue;
        target[pr.f] = cols[pr.k]; used.add(pr.k);
      }
      const out = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
      const px = out.data;
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
  }, [src, familiesSrc, key, asShot]);
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

/**
 * The light-up marquee number, drawn as the renders' layout guide draws it
 * (marqueeBlockDigit): a deep white box letter with thick strokes, rounded
 * corners and a row of lit bulbs down every stroke.
 */
function MarqueeDigit({ glyph, x, y, w, h, uid }: { glyph: string; x: number; y: number; w: number; h: number; uid: string }) {
  type Pt = [number, number];
  const t = w * 0.36;
  const midT = h / 2 - t / 2;
  const rect = (rx: number, ry: number, rw: number, rh: number) => ({ x: rx, y: ry, w: rw, h: rh });
  const SEG: Record<string, { r: ReturnType<typeof rect>; line: [Pt, Pt] }> = {
    a: { r: rect(0, 0, w, t), line: [[t / 2, t / 2], [w - t / 2, t / 2]] },
    b: { r: rect(w - t, 0, t, h / 2 + t / 2), line: [[w - t / 2, t / 2], [w - t / 2, h / 2]] },
    c: { r: rect(w - t, midT, t, h - midT), line: [[w - t / 2, h / 2], [w - t / 2, h - t / 2]] },
    d: { r: rect(0, h - t, w, t), line: [[t / 2, h - t / 2], [w - t / 2, h - t / 2]] },
    e: { r: rect(0, midT, t, h - midT), line: [[t / 2, h / 2], [t / 2, h - t / 2]] },
    f: { r: rect(0, 0, t, h / 2 + t / 2), line: [[t / 2, t / 2], [t / 2, h / 2]] },
    g: { r: rect(0, midT, w, t), line: [[t / 2, h / 2], [w - t / 2, h / 2]] },
  };
  const DIGIT: Record<string, string> = {
    "0": "abcdef", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd",
    "6": "afgedc", "7": "abc", "8": "abcdefg", "9": "abcdfg",
  };
  let parts: { d: string; line: [Pt, Pt] }[];
  const rectD = (r: ReturnType<typeof rect>) => `M ${r.x} ${r.y} h ${r.w} v ${r.h} h ${-r.w} Z`;
  if (glyph === "1") {
    const bx = w * 0.40, t1 = w * 0.42;
    parts = [
      { d: rectD(rect(bx, 0, t1, h)), line: [[bx + t1 / 2, t / 2], [bx + t1 / 2, h - t / 2]] },
      { d: `M ${bx + t1 / 2} 0 L ${bx + t1 / 2} ${t * 1.15} L ${w * 0.06} ${h * 0.3} L ${w * 0.06} ${h * 0.3 - t * 1.05} Z`,
        line: [[bx, t * 0.55], [w * 0.06 + t * 0.45, h * 0.3 - t * 0.6]] },
    ];
  } else {
    parts = (DIGIT[glyph] ?? DIGIT["8"]).split("").map((k) => ({ d: rectD(SEG[k].r), line: SEG[k].line }));
  }
  const bulbs: Pt[] = [];
  const step = h * 0.14;
  for (const pt of parts) {
    const [[x0, y0], [x1, y1]] = pt.line;
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let i = 0; i <= n; i++) {
      const q: Pt = [x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n];
      if (!bulbs.some((b) => Math.hypot(b[0] - q[0], b[1] - q[1]) < t * 0.6)) bulbs.push(q);
    }
  }
  const dx = w * 0.075, dy = -w * 0.045, br = w * 0.075;
  return (
    <g transform={`translate(${x} ${y})`}>
      <defs>
        <clipPath id={`${uid}c`}><rect width={w} height={h} rx={w * 0.12} /></clipPath>
        <clipPath id={`${uid}s`}><rect x={dx} y={dy} width={w} height={h} rx={w * 0.12} /></clipPath>
      </defs>
      <g clipPath={`url(#${uid}s)`}>{parts.map((p, i) => <path key={i} d={p.d} transform={`translate(${dx} ${dy})`} fill="#cfcac2" />)}</g>
      <g clipPath={`url(#${uid}c)`}>
        {parts.map((p, i) => <path key={`o${i}`} d={p.d} fill="#a9a6a0" stroke="#a9a6a0" strokeWidth={3} strokeLinejoin="round" />)}
        {parts.map((p, i) => <path key={`f${i}`} d={p.d} fill="#f8f6f2" />)}
      </g>
      {bulbs.map(([bx, by], i) => <circle key={i} cx={bx} cy={by} r={br * 1.9} fill="url(#skBulb)" />)}
    </g>
  );
}

/** A foil number balloon on a small bunch of balloons, as the guide draws it (foilNumberBunch). */
function FoilDigit({ glyph, x, y, w, h, hex, palette, uid }: { glyph: string; x: number; y: number; w: number; h: number; hex: string; palette: string[]; uid: string }) {
  const [r, g, b] = hexRgb(hex);
  const mix = (t: number, to: number) => `rgb(${[r, g, b].map((v) => Math.round(v + (to - v) * t)).join(",")})`;
  // A low bunch of medium balloons at its feet in the garland's colours, the
  // number standing in front of it, whole — as the guide draws it.
  const R = w * 0.22, cx = x + w / 2, by = y + h;
  const digitH = h * 0.8, baseY = by - R * 1.75;
  const spots: [number, number, number][] = [[-1.55, -1, 1], [-0.52, -1.05, 1.05], [0.52, -1, 1], [1.55, -1.05, 1.05], [-1.05, -1.95, 0.8], [1.05, -1.9, 0.8]];
  const cols = palette.length ? palette : [hex, "#ffffff"];
  return (
    <g>
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0.35" y2="1">
          {[[0, mix(0.75, 255)], [0.3, mix(0.1, 0)], [0.48, mix(0.85, 255)], [0.66, mix(0.25, 0)], [1, mix(0.45, 255)]].map(([o, c]) => <stop key={o as number} offset={o as number} stopColor={c as string} />)}
        </linearGradient>
      </defs>
      {spots.map(([ox, oy, k], i) => (
        <g key={i}>
          <circle cx={cx + ox * R} cy={by + oy * R} r={R * k} fill={cols[(i * 2) % cols.length]} stroke="rgba(39,22,23,.12)" strokeWidth={1} />
          <circle cx={cx + ox * R} cy={by + oy * R} r={R * k} fill="url(#skShine)" />
        </g>
      ))}
      <text x={cx} y={baseY} textAnchor="middle" fontFamily="var(--bz-sans), Arial, sans-serif" fontWeight={800} fontSize={digitH / 0.72}
        transform={`translate(${cx} 0) scale(0.8 1) translate(${-cx} 0)`}
        fill={`url(#${uid})`} stroke={mix(0.35, 0)} strokeWidth={w * 0.1} strokeLinejoin="round" style={{ paintOrder: "stroke" }}>{glyph}</text>
    </g>
  );
}

const sameColours = (a: string[], b: string[]) =>
  a.length === b.length && a.every((c) => b.some((x) => x.toLowerCase() === c.toLowerCase()));

export default function LiveSketch({
  config,
  activeId,
  cutoutPreviews = [],
}: {
  config: BuilderConfig;
  /** The piece being styled — outlined in pink. */
  activeId?: string | null;
  /** Standee pictures (selected characters): the first left of the backdrop, the second right. */
  cutoutPreviews?: string[];
}) {
  const d = config.decor;
  const theme = themeById(config.theme);
  const accent = theme?.accent ?? "#ff0d66";
  const items = d.backdropItems;
  const hasNumber = !!d.numberLight?.enabled && !!(d.numberLight.value ?? "").trim();
  const standees = cutoutPreviews.slice(0, 2);
  // A lone round board is drawn on the photographed base.
  const roundBase = items.length === 1 && items[0].type === "round";
  const { pieces, scale } = useMemo(() => {
    if (!roundBase) return layoutPieces(items, { maxW: hasNumber || standees.length ? 640 : 760, maxH: 640 });
    const B = ROUND_BASE, R = B.r * VB;
    const piece: Piece = { item: items[0], idx: 0, x: B.cx * VB - R, w: 2 * R, h: 2 * R, top: B.cy * VB - R, curveLeft: false };
    return { pieces: [piece], scale: (2 * R) / Math.max(60, items[0].widthCm || 200) };
  }, [items, hasNumber, standees.length, roundBase]);
  // Where things stand: the floor line, and how far in front of it the front row sits.
  const floorY = roundBase ? (ROUND_BASE.plinth.y + ROUND_BASE.plinth.h) * VB : FLOOR;
  const palette = d.balloonColors.length ? d.balloonColors : (theme?.balloonColors ?? ["#f7c5d8"]);
  const balloonsOn = normalizeBalloonStyle(d.balloonStyle) !== "none";
  const asShot = config.theme === "frozen" && sameColours(palette, (themeById("frozen")?.balloonColors ?? []).slice(0, 5));
  const baseBalloons = useRecoloredBase(roundBase && balloonsOn ? ROUND_BASE.balloons : null, ROUND_BASE.families, palette, asShot);
  const garlandSize = 18 + scale * 8;
  // How far the garland reaches past the boards' outer edges.
  const garlandReach = !balloonsOn ? 12 : roundBase ? 0.17 * VB : garlandSize * 2.6;
  const groupL = pieces.length ? pieces[0].x : VB / 2;
  const groupR = pieces.length ? pieces[pieces.length - 1].x + pieces[pieces.length - 1].w : VB / 2;
  const groupMid = roundBase ? (ROUND_BASE.plinth.x + ROUND_BASE.plinth.w / 2) * VB : (groupL + groupR) / 2;

  // Plinths: the photographed one, sized by the ladder (XXL 90, XL 75, L 60 cm).
  // The biggest stands in the middle, the next on its left, the last on its right.
  const plinths = useMemo(() => {
    const sizes = d.plinthSizes.slice(0, 3);
    const dims = sizes.map((s) => {
      const c = PLINTH_CM[s] ?? PLINTH_CM.medium;
      const h = roundBase ? ROUND_BASE.plinth.h * VB * (c.h / 90) : c.h * scale;
      return { h, w: h * PLINTH_ASPECT * (c.d / 40) / (c.h / 90) };
    });
    const order = dims.map((dm, i) => ({ ...dm, i })).sort((a, b) => b.h - a.h);
    const out: { x: number; y: number; w: number; h: number }[] = [];
    if (order[0]) out.push({ x: groupMid - order[0].w / 2, y: floorY - order[0].h, w: order[0].w, h: order[0].h });
    if (order[1]) out.push({ x: out[0].x - order[1].w * 1.02, y: floorY - order[1].h, w: order[1].w, h: order[1].h });
    if (order[2]) out.push({ x: out[0].x + out[0].w * 1.02, y: floorY - order[2].h, w: order[2].w, h: order[2].h });
    return out;
  }, [d.plinthSizes, roundBase, scale, groupMid, floorY]);
  const plinthTop = plinths.length ? Math.min(...plinths.map((p) => p.y)) : Infinity;
  const plinthRight = plinths.length ? Math.max(...plinths.map((p) => p.x + p.w)) : groupMid;

  // Garland balloons (drawn setups): on the outer sides of the group, as the renders have them.
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

  // Florals on the base: tucked in along its garland (angles in degrees).
  const baseFlorals = roundBase && balloonsOn && d.garlandFlorals
    ? [218, 198, 178, 160, 143, 126, 108, 92, 76, -52, -68].map((a, i) => {
        const R = ROUND_BASE.r * VB * 1.04, t = (a * Math.PI) / 180, rr = R * (i % 2 ? 1.06 : 0.98);
        return { x: ROUND_BASE.cx * VB + Math.cos(t) * rr, y: ROUND_BASE.cy * VB - Math.sin(t) * rr, r: R * 0.1, a: -a + 90 };
      })
    : [];

  const neon = d.neonSign?.enabled && (d.neonSign.text ?? "").trim() ? d.neonSign : null;
  const neonPiece = neon ? (pieces.find((p) => p.idx === (neon.panelIndex ?? 0)) ?? pieces[0]) : undefined;

  const lines = (s: string) => {
    // "Happy Birthday" stays on one line with the name centred below it.
    const fixed = messageLines(s);
    if (fixed) return fixed;
    const words = s.trim().split(/\s+/);
    if (s.includes("\n")) return s.split("\n").map((l) => l.trim()).filter(Boolean);
    return words.length >= 2 ? [words.slice(0, Math.ceil(words.length / 2)).join(" "), words.slice(Math.ceil(words.length / 2)).join(" ")] : [s.trim()];
  };
  // The faces the render guide draws (lib/guideFontData.ts). `adv` is the
  // average character width in em, measured from each font (x1.06, the same
  // allowance the first script was tuned with), so the sketch fits the words
  // to the board as the guide does. 2026-10-25 (T0): Italianno replaces
  // Brittany Signature; Serif and Bold were Georgia and DM Sans, not the
  // Playfair Display and Archivo Black the renders print.
  const fontFor = (f: string) => f === "block"
    ? { family: "var(--bz-bold)", weight: 400, k: 0.13, adv: 0.65 }
    : f === "elegant" ? { family: "var(--bz-serif)", weight: 400, k: 0.14, adv: 0.55 }
    : { family: "var(--bz-signature)", weight: 400, k: 0.15, adv: 0.37 };

  /** Where a board's words go: its centre, clear of the garland and above the plinth. */
  const textSpot = (p: Piece, blockH: number) => {
    if (roundBase) {
      // The garland covers the board's left side: the words sit right of centre.
      const cx = ROUND_BASE.cx * VB + (balloonsOn ? ROUND_BASE.r * VB * 0.12 : 0);
      let cy = ROUND_BASE.cy * VB - ROUND_BASE.r * VB * 0.18;
      if (cy + blockH / 2 > plinthTop - 34) cy = plinthTop - 34 - blockH / 2;
      return { cx, cy, w: p.w * (balloonsOn ? 0.66 : 0.8) };
    }
    const cy = p.item.type === "round" ? FLOOR - p.w / 2 : p.top + p.h * 0.36;
    return { cx: p.x + p.w / 2, cy, w: p.w * 0.85 };
  };

  // Standees: the first stands left of the backdrop, the second right.
  // The light-up number: beside the plinths (or the middle of the decor without them).
  const numberH = 100 * scale;
  const numberDigits = String(d.numberLight?.value ?? "").replace(/[^0-9]/g, "").slice(0, 2);
  const digitW = numberH * 0.66, digitGap = digitW * 0.14;
  const numberW = digitW * numberDigits.length + digitGap * Math.max(0, numberDigits.length - 1);
  const numberX = Math.min(VB - numberW / 2 - 6, plinths.length ? plinthRight + numberW / 2 + 10 : roundBase ? 0.66 * VB : groupMid + numberW / 2);
  const standeeBoxes = standees.map((src, i) => {
    // Wide enough for a two-character picture, which a narrow box shrank.
    const h = 150 * scale, w = h * 0.95;
    let cx = i === 0
      ? Math.max(w * 0.42, roundBase ? 0.15 * VB : groupL - garlandReach * 0.55)
      : Math.min(VB - w * 0.42, roundBase ? 0.86 * VB : groupR + garlandReach * 0.55);
    // The right one steps aside so the number stays in view.
    if (i === 1 && hasNumber) cx = Math.max(cx, numberX + numberW / 2 + w * 0.3);
    return { src, x: cx - w / 2, y: floorY + (roundBase ? 0.05 * VB : 14) - h, w, h };
  });

  const wallTop = "#7d8085", wallLow = "#a4a6aa", floorTop = "#c3c4c7", floorLow = "#e2e3e5";

  return (
    <svg viewBox={`0 0 ${VB} ${VB}`} className="bz-sketch" role="img" aria-label="Live sketch of your choices">
      <defs>
        <linearGradient id="skWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={wallTop} /><stop offset="1" stopColor={wallLow} /></linearGradient>
        <linearGradient id="skFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={floorTop} /><stop offset="1" stopColor={floorLow} /></linearGradient>
        <radialGradient id="skShine" cx="0.32" cy="0.28" r="0.75"><stop offset="0" stopColor="#fff" stopOpacity=".85" /><stop offset=".35" stopColor="#fff" stopOpacity=".15" /><stop offset="1" stopColor="#000" stopOpacity=".12" /></radialGradient>
        <radialGradient id="skBulb"><stop offset="0" stopColor="#fffdf4" /><stop offset=".28" stopColor="#fff0c2" /><stop offset=".45" stopColor="#ffd978" stopOpacity=".85" /><stop offset=".7" stopColor="#ffc45c" stopOpacity=".28" /><stop offset="1" stopColor="#ffb040" stopOpacity="0" /></radialGradient>
        <filter id="skGlow" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="7" /></filter>
        <filter id="skShadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#000" floodOpacity=".18" /></filter>
        <filter id="skSoft" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="1.5" dy="2.5" stdDeviation="1.6" floodColor="#2a2a30" floodOpacity=".28" /></filter>
        <pattern id="skSequin" width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="8" cy="8" r="6.2" fill="rgba(255,255,255,.55)" /><circle cx="6" cy="6" r="2" fill="#fff" opacity=".7" />
        </pattern>
        {roundBase && <mask id="skBoardMask" maskUnits="userSpaceOnUse" x="0" y="0" width={VB} height={VB}><image href={ROUND_BASE.boardMask} width={VB} height={VB} /></mask>}
      </defs>

      {roundBase ? (
        <>
          {/* The room, the board and (beneath the balloon layer) the balloons, as photographed. */}
          <image href={ROUND_BASE.room} width={VB} height={VB} />
          {/* The board's colour, laid over its photographed light and shade. */}
          {!isWhite(items[0].color || d.backdropColor) && (
            <rect width={VB} height={VB} fill={items[0].color || d.backdropColor} mask="url(#skBoardMask)" style={{ mixBlendMode: "multiply" }} />
          )}
        </>
      ) : (
        <>
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
        </>
      )}

      {/* Theme graphic: a few small motifs on the board */}
      {pieces.filter((p) => p.item.graphic?.enabled && (roundBase || piecePath(p))).map((p) => {
        const rnd = seeded(p.idx * 97 + 3);
        return (
          <g key={`g${p.item.id}`} opacity={0.75} mask={roundBase ? "url(#skBoardMask)" : undefined}>
            {Array.from({ length: 6 }, (_, i) => {
              const cx = p.x + p.w * (0.3 + rnd() * 0.55), cy = p.top + p.h * (0.5 + rnd() * 0.4), s = p.w * 0.05;
              return <path key={i} d={`M ${cx} ${cy - s} L ${cx + s * 0.3} ${cy - s * 0.3} L ${cx + s} ${cy} L ${cx + s * 0.3} ${cy + s * 0.3} L ${cx} ${cy + s} L ${cx - s * 0.3} ${cy + s * 0.3} L ${cx - s} ${cy} L ${cx - s * 0.3} ${cy - s * 0.3} Z`} fill={accent} />;
            })}
          </g>
        );
      })}

      {/* Printed lettering — staggered and tilted like the renders' script */}
      {pieces.filter((p) => p.item.text?.enabled && (p.item.text.value ?? "").trim() && (roundBase || piecePath(p)) && p.item.type !== "open_arch_frame").map((p) => {
        const f = fontFor(p.item.text.fontStyle);
        const ls = lines(p.item.text.value);
        const longest = Math.max(4, ...ls.map((l) => l.length));
        const k = textSizeScale(p.item.text.size);
        const room = textSpot(p, 0);
        // As the layout guide does: fitted to the clear width, then the chosen share of that.
        const size = Math.min(p.w * 0.3, room.w / (longest * f.adv)) * k;
        // Script 1.25 -> 1.0 with Italianno (T0), as the guide's 1.34 -> 1.08.
        const gap = size * (p.item.text.fontStyle === "script" ? 1.0 : 1.12);
        const blockH = gap * (ls.length - 1) + size;
        const at = textSpot(p, blockH);
        const script = p.item.text.fontStyle === "script";
        const y0 = at.cy - ((ls.length - 1) * gap) / 2 + size * 0.32;
        // Silver, gold and rose gold are mirror acrylic: bright and dark bands, not flat grey.
        const metal = METAL_TINT[p.item.text.color];
        const gid = `skMetal${p.idx}`;
        return (
          <g key={`t${p.item.id}`} transform={script ? `rotate(-2 ${at.cx} ${at.cy})` : undefined} filter="url(#skSoft)">
            {metal && (
              <defs>
                <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={at.cx} y1={at.cy - blockH / 2} x2={at.cx + blockH * 0.25} y2={at.cy + blockH / 2}>
                  {[[0, 0.94], [0.3, 0.6], [0.47, 1], [0.6, 0.5], [0.78, 0.86], [1, 0.62]].map(([o, l]) => <stop key={o} offset={o} stopColor={tintHex(metal, l)} />)}
                </linearGradient>
              </defs>
            )}
            <text textAnchor="middle" fontFamily={f.family} fontWeight={f.weight} fontSize={size}
              fill={metal ? `url(#${gid})` : resolveTextColorHex(p.item.text.color, accent)}
              stroke={metal ? tintHex(metal, 0.42) : undefined} strokeWidth={metal ? Math.max(0.6, size * 0.012) : undefined}>
              {ls.map((l, i) => <tspan key={i} x={at.cx} y={y0 + i * gap}>{l}</tspan>)}
            </text>
          </g>
        );
      })}

      {/* The photographed garland on the round base, in the chosen colours */}
      {roundBase && baseBalloons && <image href={baseBalloons} width={VB} height={VB} />}
      {baseFlorals.map((f, i) => (
        <g key={`bf${i}`} transform={`rotate(${f.a} ${f.x} ${f.y})`}>
          <ellipse cx={f.x - f.r * 0.7} cy={f.y} rx={f.r} ry={f.r * 0.36} fill="#7fa77a" />
          <ellipse cx={f.x + f.r * 0.7} cy={f.y} rx={f.r * 0.9} ry={f.r * 0.32} fill="#93b98c" />
          {i % 3 === 0 && <circle cx={f.x} cy={f.y} r={f.r * 0.42} fill="#fff4f7" stroke="#f3b8cc" strokeWidth={2} />}
        </g>
      ))}

      {/* Balloon garland (drawn setups), florals tucked in */}
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
        // Fitted to the board's clear width like the lettering ("devasa duruyor" when it was not).
        const longest = Math.max(4, ...ls.map((l) => l.length));
        const size = Math.min(neonPiece.w * 0.14, textSpot(neonPiece, 0).w / (longest * 0.5)) * 0.85;
        const spot = textSpot(neonPiece, size * 1.05 * (ls.length - 1) + size);
        const cx = spot.cx;
        const cy = isRing ? FLOOR - neonPiece.w * 0.62 : roundBase ? spot.cy : neonPiece.top + neonPiece.h * 0.34;
        const txt = (glow: boolean) => (
          <text x={cx} y={cy - (ls.length - 1) * size * 0.5} textAnchor="middle" fontFamily="var(--bz-signature)" fontWeight={400}
            fontSize={size} fill={glow ? "#ffb36b" : "#fffaf0"} filter={glow ? "url(#skGlow)" : undefined} opacity={glow ? 0.9 : 1}
            stroke={glow ? "#ffb36b" : "#f0b36e"} strokeWidth={glow ? 6 : 1.2}>
            {ls.map((l, i) => <tspan key={i} x={cx} dy={i === 0 ? 0 : size * 1.05}>{l}</tspan>)}
          </text>
        );
        return <g>{txt(true)}{txt(false)}</g>;
      })()}

      {/* Plinths in front of the board */}
      {plinths.map((p, i) => (
        <image key={`p${i}`} href={PLINTH_SRC} x={p.x} y={p.y} width={p.w} height={p.h} preserveAspectRatio="none" />
      ))}

      {/* Light-up number on the floor, right of the plinths */}
      {hasNumber && pieces.length > 0 && numberDigits.length > 0 && (
        <g filter="url(#skSoft)">
          {numberDigits.split("").map((g, i) => d.numberLight?.style === "foil"
            // 80cm and slimmer than the marquee.
            ? <FoilDigit key={i} uid={`skFoil${i}`} glyph={g} w={digitW * 0.78} h={numberH * 0.8} hex={foilColourFor(d.numberLight, palette)} palette={palette}
                x={numberX - numberW / 2 + i * (digitW + digitGap) + digitW * 0.11} y={floorY + (roundBase ? 0.03 * VB : 4) - numberH * 0.8} />
            : <MarqueeDigit key={i} uid={`skMq${i}`} glyph={g} w={digitW} h={numberH}
                x={numberX - numberW / 2 + i * (digitW + digitGap)} y={floorY + (roundBase ? 0.03 * VB : 4) - numberH} />
          )}
        </g>
      )}

      {/* Standees on the floor: the first left of the backdrop, the second right */}
      {standeeBoxes.map((s, i) => (
        <image key={`s${i}`} href={s.src} x={s.x} y={s.y} width={s.w} height={s.h} preserveAspectRatio="xMidYMax meet" />
      ))}

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
