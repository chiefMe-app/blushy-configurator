// The welcome board drawn as it will stand (2026-10-31): to scale in
// centimetres, its face the theme's art (turned upright), painted corners or a
// plain colour, the customer's words in their lettering, on its easel. Free and live.
// 2026-10-31 (owner): a round board; balloons or flowers on it; painted corners
// like her Frozen example; and the words never run into each other ("yazı
// overlap olmasın hiç bir zaman") — each line is measured once drawn and
// stacked with a gap, made smaller if it is too wide.
// Later that day (owner: "render görüntülerini kullanarak preview görsellerini
// oluşturmak", then, with a render as the example, "görüntü bunun gibi gerçekçi
// olmalı, yazı sadece user tarafından değişebilir"): a real photo of the board's
// shape on its easel or wall, rendered once with its face blank, the customer's
// print and words laid onto that face live; a real garland in the theme's colours
// beside it (balloon pieces tinted to the party's colours where a theme has none
// yet), and real roses. Every photo made once (scripts/welcome/) — no render.
import { useId, useLayoutEffect, useRef, useState } from "react";
import PIECES from "@/lib/studio/welcomePieces.json";
import { tableFont, fontCss, asPrinted } from "@/lib/studio/tableFonts";
import { boardArt, boardFace, boardWordsColour, type WelcomeBoard } from "@/lib/studio/welcomeBoard";

const rgb = (hex: string) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const isLight = (hex: string) => { const [r, g, b] = rgb(hex); return (0.3 * r + 0.59 * g + 0.11 * b) / 255 > 0.75; };
const toHex = (c: number[]) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
/** a mixed with b, t of b. */
const mix = (a: string, b: string, t: number) => { const x = rgb(a), y = rgb(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };

function hsl(hex: string) {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}
function fromHsl(h: number, s: number, l: number) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return toHex([r, g, b].map((v) => (v + m) * 255));
}

/** The painted corners' inks: the theme's distinct hues, as watercolour (mid-light, not grey). */
export function paintInks(colours: string[]): string[] {
  const hues: number[] = [];
  const inks: string[] = [];
  for (const c of colours) {
    const { h, s } = hsl(c);
    if (s < 0.18 || hues.some((x) => Math.min(Math.abs(x - h), 360 - Math.abs(x - h)) < 22)) continue;
    hues.push(h);
    inks.push(fromHsl(h, Math.max(s, 0.5), 0.58));
    if (inks.length === 3) break;
  }
  if (!inks.length) inks.push("#9AA7B8");
  while (inks.length < 3) inks.push(mix(inks[0], "#FFFFFF", 0.35 * inks.length));
  return inks;
}

/** A small repeatable random (the same drawing every time). */
function rng(seed: number) {
  let a = seed;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const f1 = (n: number) => n.toFixed(2);

/** A six-armed snowflake: branches on each arm, a kite at its tip. */
function flake(cx: number, cy: number, r: number, rot: number) {
  let d = "";
  for (let i = 0; i < 6; i++) {
    const a = ((rot + i * 60) * Math.PI) / 180;
    const at = (t: number, off = 0) => [cx + Math.cos(a) * r * t - Math.sin(a) * r * off, cy + Math.sin(a) * r * t + Math.cos(a) * r * off];
    const [ex, ey] = at(0.8);
    d += `M${f1(cx)},${f1(cy)}L${f1(ex)},${f1(ey)}`;
    for (const [t, len] of [[0.36, 0.28], [0.6, 0.2]]) {
      const [px, py] = at(t);
      for (const s of [1, -1]) {
        const b = a + (s * Math.PI) / 4;
        d += `M${f1(px)},${f1(py)}L${f1(px + Math.cos(b) * r * len)},${f1(py + Math.sin(b) * r * len)}`;
      }
    }
    const k = [at(0.78), at(0.9, 0.07), at(1.02), at(0.9, -0.07)];
    d += `M${k.map(([x, y]) => `${f1(x)},${f1(y)}`).join("L")}Z`;
  }
  return d;
}

/** A sprig from (x, y), angle a (degrees), len long: pine needles or small leaves along it. */
function sprig(x: number, y: number, a: number, len: number, leaf: boolean) {
  const r = (a * Math.PI) / 180;
  const at = (t: number) => [x + Math.cos(r) * len * t, y + Math.sin(r) * len * t];
  const [ex, ey] = at(1);
  let stem = `M${f1(x)},${f1(y)}L${f1(ex)},${f1(ey)}`;
  let leaves = "";
  for (let t = 0.18; t < 0.98; t += leaf ? 0.2 : 0.1) {
    const [px, py] = at(t);
    const l = len * (leaf ? 0.22 : 0.16) * (1.1 - t * 0.6);
    for (const s of [1, -1]) {
      const b = r + s * (leaf ? 0.75 : 0.6);
      const [qx, qy] = [px + Math.cos(b) * l, py + Math.sin(b) * l];
      if (leaf) {
        // A small pointed leaf: two curves from the stem to its tip.
        const n = [-Math.sin(b) * l * 0.32, Math.cos(b) * l * 0.32];
        const m = [(px + qx) / 2, (py + qy) / 2];
        leaves += `M${f1(px)},${f1(py)}Q${f1(m[0] + n[0])},${f1(m[1] + n[1])} ${f1(qx)},${f1(qy)}Q${f1(m[0] - n[0])},${f1(m[1] - n[1])} ${f1(px)},${f1(py)}Z`;
      } else stem += `M${f1(px)},${f1(py)}L${f1(qx)},${f1(qy)}`;
    }
  }
  return { stem, leaves };
}

/** Where a board's corners are, inside its shape: top-left, top-right, bottom-left, bottom-right. */
export function boardCorners(shape: string, w: number, h: number, top: number): [number, number][] {
  if (shape === "round") {
    const c = top + h / 2, d = w * 0.37;
    return [[w / 2 - d, c - d], [w / 2 + d, c - d], [w / 2 - d, c + d], [w / 2 + d, c + d]];
  }
  const y0 = shape === "arch" ? top + w * 0.17 : top + h * 0.03;
  const x0 = shape === "arch" ? w * 0.14 : w * 0.04;
  return [[x0, y0], [w - x0, y0], [w * 0.04, top + h * 0.97], [w * 0.96, top + h * 0.97]];
}

type Mark = [number, number, number, number, string, number];

/** Painted corners (2026-10-31, the owner's Frozen example): watercolour shapes in two corners, fainter ones in the others, a few specks — on white. */
export function PaintedCorners({ w, h, top = 0, shape = "rectangle", inks, motif, uid }: { w: number; h: number; top?: number; shape?: string; inks: string[]; motif: "flake" | "leaf"; uid: string }) {
  // A round board has less room in its corners: the shapes smaller there.
  const u = (w / 70) * (shape === "round" ? 0.62 : 1);
  const rand = rng(11);
  const [c1, c2, c3] = inks;
  const [tl, tr, bl, br] = boardCorners(shape, w, h, top);
  const leaf = motif === "leaf";
  // Shapes round each corner, d the way into the board: [x, y, size, turn, ink, strength].
  const at = ([x, y]: [number, number], dx: number, dy: number, d: [number, number]): [number, number] => [x + dx * u * d[0], y + dy * u * d[1]];
  const IN: Record<string, [number, number]> = { tl: [1, 1], tr: [-1, 1], bl: [1, -1], br: [-1, -1] };
  const flakes: Mark[] = [
    [...at(tl, 0, 0, IN.tl), 21 * u, 8, c1, 0.8], [...at(tl, 20, -4, IN.tl), 10 * u, 20, c2, 0.6], [...at(tl, 9, 17, IN.tl), 5 * u, 2, c2, 0.55],
    [...at(tr, 0, 0, IN.tr), 15 * u, 30, c3, 0.4], [...at(tr, 17, 7, IN.tr), 4.5 * u, 12, c2, 0.5],
    [...at(bl, 0, 0, IN.bl), 10 * u, 15, c3, 0.35],
    [...at(br, 0, 0, IN.br), 19 * u, 4, c1, 0.6], [...at(br, 21, 7, IN.br), 6 * u, 25, c2, 0.55], [...at(br, 7, 20, IN.br), 4 * u, 7, c3, 0.5],
  ];
  const sprigs: Mark[] = [
    [...at(tl, -4, 15, IN.tl), -12, 26 * u, c1, 0.65], [...at(tl, 14, -6, IN.tl), 58, 20 * u, c2, 0.55],
    [...at(tr, 2, 12, IN.tr), 168, 16 * u, c3, 0.4],
    [...at(bl, -2, -10, IN.bl), -25, 16 * u, c3, 0.45],
    [...at(br, 4, -16, IN.br), 192, 24 * u, c1, 0.6], [...at(br, 18, 4, IN.br), -118, 18 * u, c2, 0.55], [...at(br, 30, 2, IN.br), -150, 13 * u, c3, 0.5],
  ];
  const specks = Array.from({ length: 80 }, () => {
    const [x, y] = rand() < 0.5 ? tr : bl;
    const a = rand() * Math.PI * 2, d = rand() * 22 * u;
    return [Math.max(0, Math.min(w, x + Math.cos(a) * d)), y + Math.sin(a) * d, (0.1 + rand() * 0.22) * u, rand()] as const;
  });
  return (
    <g data-part="painted-corners">
      <defs>
        <filter id={`${uid}-wc`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency={0.32 / u} numOctaves={2} seed={4} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={0.8 * u} xChannelSelector="R" yChannelSelector="G" result="d" />
          <feGaussianBlur in="d" stdDeviation={0.1 * u} />
        </filter>
        <filter id={`${uid}-bleed`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation={1.3 * u} /></filter>
      </defs>
      {/* A soft wash in the two main corners, and the shapes' bleed — one filter pass each (a filter on every shape was slow to draw). */}
      <g filter={`url(#${uid}-bleed)`}>
        <ellipse cx={tl[0]} cy={tl[1]} rx={w * 0.26} ry={w * 0.2} fill={c1} opacity={0.14} />
        <ellipse cx={br[0]} cy={br[1]} rx={w * 0.26} ry={w * 0.18} fill={c2} opacity={0.14} />
        {!leaf && flakes.map(([x, y, r, rot, c, o], i) => <path key={`fb${i}`} d={flake(x, y, r, rot)} stroke={c} strokeWidth={r * 0.1} fill={c} strokeLinecap="round" opacity={o * 0.35} />)}
      </g>
      <g filter={`url(#${uid}-wc)`}>
        {sprigs.map(([x, y, a, len, c, o], i) => {
          const s = sprig(x, y, a, len, leaf);
          return <g key={`s${i}`} opacity={o}>
            <path d={s.stem} stroke={c} strokeWidth={0.5 * u} strokeLinecap="round" fill="none" />
            {s.leaves && <path d={s.leaves} fill={c} />}
          </g>;
        })}
        {flakes.map(([x, y, r, rot, c, o], i) => leaf
          // Without snowflakes: soft painted berries where they would be.
          ? <g key={`f${i}`} opacity={o * 0.8}>{[0, 1, 2].map((k) => <circle key={k} cx={x + Math.cos(rot + k * 2.1) * r * 0.22} cy={y + Math.sin(rot + k * 2.1) * r * 0.22} r={r * 0.16} fill={c} />)}</g>
          : <path key={`f${i}`} d={flake(x, y, r, rot)} stroke={c} strokeWidth={r * 0.055} fill={c} strokeLinecap="round" strokeLinejoin="round" opacity={o} />)}
      </g>
      {specks.map(([x, y, r, t], i) => <circle key={`d${i}`} cx={x} cy={y} r={r} fill={t < 0.6 ? "#9AA0AE" : inks[i % 3]} opacity={0.35 + t * 0.3} />)}
    </g>
  );
}

const piece = (name: keyof typeof PIECES) => `/design/welcome/pieces/${name}.webp`;

/** How a balloon colour is shown: the white latex photo tinted to it, or the chrome one (silver as it is, gold tinted). */
function balloonLook(hex: string): { src: string; tint?: string } {
  const { h, s, l } = hsl(hex);
  if (s < 0.12 && l > 0.45 && l < 0.92) return { src: piece("balloon-chrome") };
  if (h >= 35 && h <= 60 && s > 0.35 && l < 0.62) return { src: piece("balloon-chrome"), tint: mix(hex, "#FFFFFF", 0.2) };
  return { src: piece("balloon-latex"), tint: l >= 0.92 && s < 0.3 ? undefined : hex };
}

/** A white piece multiplied by its colour, its brightest light kept white (a balloon's shine). */
function Tint({ id, colour }: { id: string; colour: string }) {
  return (
    <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
      <feFlood floodColor={colour} result="c" />
      <feComposite in="c" in2="SourceGraphic" operator="arithmetic" k1={1} k2={0} k3={0} k4={0} result="t" />
      <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 3.6 7.08 1.32 0 -11.28" result="hi" />
      <feComposite in="hi" in2="t" operator="over" result="lit" />
      <feComposite in="lit" in2="SourceAlpha" operator="in" />
    </filter>
  );
}

type Ball = { cx: number; cy: number; r: number; c: number; turn: number };

/** A balloon garland up the board's right side, from the floor to near its top: 11" balloons, some 18", 5" ones tucked in front. */
function Garland({ x, y0, y1, u, colours, uid, roses }: { x: number; y0: number; y1: number; u: number; colours: string[]; uid: string; roses?: boolean }) {
  const rand = rng(5);
  const back: Ball[] = [], main: Ball[] = [], small: Ball[] = [];
  const n = Math.max(6, Math.round((y0 - y1) / 9));
  const pick = () => Math.floor(rand() * colours.length);
  const turn = () => (rand() - 0.5) * 24;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const cy = y0 - 12 * u - (y0 - 12 * u - y1) * t;
    const cx = x + Math.sin(t * 7.5) * 3.5 * u + (rand() - 0.5) * 2.5 * u;
    const r = (t < 0.5 && rand() < 0.22 ? 20 : 12.5 + rand() * 1.5) * u * (t > 0.9 ? 0.85 : 1);
    // Behind it, one to each side: the garland's width.
    for (const side of [-1, 1]) back.push({ cx: cx + side * (7 + rand() * 4) * u, cy: cy - (2 + rand() * 4) * u, r: r * (0.78 + rand() * 0.12), c: pick(), turn: turn() });
    main.push({ cx, cy, r, c: pick(), turn: turn() });
    for (let k = 0; k < 1 + Math.round(rand()); k++) {
      const a = rand() * Math.PI * 2;
      small.push({ cx: cx + Math.cos(a) * r * 0.95, cy: cy + Math.sin(a) * r * 0.95, r: (5.5 + rand()) * u, c: pick(), turn: turn() });
    }
  }
  const looks = colours.map(balloonLook);
  const aspect = PIECES["balloon-latex"].w / PIECES["balloon-latex"].h;
  const ball = (b: Ball, i: number, kind: string) => {
    const look = looks[b.c];
    const hgt = b.r * 2.1, wid = hgt * aspect;
    return (
      // eslint-disable-next-line jsx-a11y/alt-text
      <image key={`${kind}${i}`} href={look.src} x={b.cx - wid / 2} y={b.cy - hgt / 2} width={wid} height={hgt} preserveAspectRatio="none"
        transform={`rotate(${f1(b.turn)} ${f1(b.cx)} ${f1(b.cy)})`} filter={look.tint ? `url(#${uid}-t${b.c})` : undefined} />
    );
  };
  const trio = PIECES["roses-trio"];
  return (
    <g data-part="balloons">
      <defs>{looks.map((l, i) => l.tint && <Tint key={i} id={`${uid}-t${i}`} colour={l.tint} />)}</defs>
      <ellipse cx={x} cy={y0} rx={24 * u} ry={3.2 * u} fill="#3b2a22" opacity={0.22} filter={`url(#${uid}-soft)`} />
      <g opacity={0.92}>{back.map((b, i) => ball(b, i, "k"))}</g>
      {main.map((b, i) => ball(b, i, "b"))}
      {roses && [2, Math.floor(n / 2) + 1, n - 1].map((i, k) => main[i] && (
        // eslint-disable-next-line jsx-a11y/alt-text
        <image key={`fr${k}`} data-part="garland-roses" href={piece("roses-trio")} x={main[i].cx - main[i].r * 1.25} y={main[i].cy + main[i].r * 0.05} width={13 * u} height={(13 * u * trio.h) / trio.w} />
      ))}
      {small.map((b, i) => ball(b, i, "s"))}
    </g>
  );
}

/** The rose spray on a corner: its fullest roses at the corner (x, y), trailing off along the edge at `turn` degrees; mirrored for a right-hand corner. */
function Roses({ x, y, width, turn, mirror }: { x: number; y: number; width: number; turn: number; mirror?: boolean }) {
  const p = PIECES["roses-spray"];
  const hgt = (width * p.h) / p.w;
  // The spray's fullest point, in the picture: about a fifth of the way along, halfway down.
  const fx = width * 0.2, fy = hgt * 0.5;
  return (
    <g data-part="flowers" transform={`translate(${f1(x)} ${f1(y)}) rotate(${turn})${mirror ? " scale(-1 1)" : ""}`}>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <image href={piece("roses-spray")} x={-fx} y={-fy} width={width} height={hgt} />
    </g>
  );
}

/** A line's size measured at its nominal font size: width, and how far it reaches above and below its baseline. */
interface Metric { w: number; asc: number; desc: number }

/**
 * The words stacked top to bottom with a gap, centred in the space the board
 * leaves for them: a line too wide is made smaller to fit; all of them, if
 * together they are too tall. Pure (the measuring is in the component).
 */
export function stackWords(ms: (Metric | null)[], nominal: number[], space: { y0: number; y1: number; maxW: number }, gap: number) {
  const k = ms.map((m) => (m ? Math.min(1, space.maxW / Math.max(m.w, 0.001)) : 1));
  const shown = ms.filter(Boolean).length;
  const tall = ms.reduce((t, m, i) => t + (m ? (m.asc + m.desc) * k[i] : 0), 0) + gap * Math.max(0, shown - 1);
  const s = Math.min(1, (space.y1 - space.y0) / Math.max(tall, 0.001));
  let y = space.y0 + ((space.y1 - space.y0) - tall * s) * 0.45;
  const base = ms.map((m, i) => {
    if (!m) return 0;
    const b = y + m.asc * k[i] * s;
    y += (m.asc + m.desc) * k[i] * s + gap * s;
    return b;
  });
  return { size: nominal.map((n, i) => n * k[i] * s), base };
}

export default function WelcomeBoardArt({ board, theme, balloons, className, placeholders = true }: {
  board: WelcomeBoard;
  theme: { id: string; accent: string; balloonColors?: string[]; backdropColors?: string[] };
  /** The party's balloon colours (the backdrop's), for a garland on the board. */
  balloons?: string[];
  className?: string;
  /** Show example words where the customer has none yet (the builder), or leave them out (a saved design). */
  placeholders?: boolean;
}) {
  const uid = `wb${useId().replace(/[^a-z0-9]/gi, "")}`;
  const { w, h } = boardFace(board);
  const u = w / 70;
  const easel = board.stand === "easel";
  const top = 6, cx = w / 2, cy = top + h / 2;
  const art = boardArt(board, theme.id);
  const ink = boardWordsColour(board, theme);
  const halo = isLight(ink) ? { stroke: "rgba(60,40,50,0.35)", strokeWidth: 0.25, paintOrder: "stroke" as const } : {};
  const font = tableFont(board.font);
  const name = board.name.trim() || (placeholders ? "Arya's" : "");
  const line = board.line.trim() || (placeholders ? "Birthday party" : "");
  const faded = (real: string) => (real.trim() ? 1 : 0.4);
  const garland = board.garnish === "balloons" || board.garnish === "both";
  const flowers = board.garnish === "flowers" || board.garnish === "both";
  const palette = [theme.accent, ...(theme.balloonColors ?? []), ...(theme.backdropColors ?? [])];
  const balloonColours = (balloons?.length ? balloons : theme.balloonColors ?? [theme.accent]).slice(0, 5);

  const shape = board.shape === "arch"
    ? `M0,${top + h}L0,${top + w / 2}A${w / 2},${w / 2} 0 0 1 ${w},${top + w / 2}L${w},${top + h}Z`
    : board.shape === "round"
      ? `M0,${cy}A${w / 2},${w / 2} 0 1 1 ${w},${cy}A${w / 2},${w / 2} 0 1 1 0,${cy}Z`
      : `M0,${top}H${w}V${top + h}H0Z`;
  // Where the words may go: inside the shape, clear of the corners (and of a garland).
  const space = board.shape === "round"
    ? { y0: top + h * 0.27, y1: top + h * 0.75, maxW: w * 0.66 }
    : board.shape === "arch"
      ? { y0: top + w * 0.4, y1: top + h * 0.84, maxW: w * 0.8 }
      : { y0: top + h * 0.2, y1: top + h * 0.82, maxW: w * 0.8 };
  if (garland) space.maxW -= w * 0.06;
  // The roses: where their fullest point sits on each corner, and the way they trail along the edge.
  const corner = board.shape === "rectangle"
    ? { tl: [3 * u, top + 3 * u, 8], br: [w - 3 * u, top + h - 4 * u, -8] }
    : board.shape === "arch"
      ? { tl: [cx - w * 0.33, top + w * 0.16, -42], br: [w - 3 * u, top + h - 4 * u, -8] }
      : { tl: [cx - w * 0.36, cy - w * 0.33, -45], br: [cx + w * 0.38, cy + w * 0.34, -45] };

  // The words: nominal sizes, an estimate until they are measured on screen.
  const texts = [board.heading.trim().toUpperCase(), name ? asPrinted(name, font) : "", line.toUpperCase()];
  const nominal = [w * 0.075, w * 0.2 * font.scale, w * 0.07];
  const estimate = (i: number): Metric | null => {
    if (!texts[i]) return null;
    const n = nominal[i];
    return i === 1
      ? { w: texts[i].length * n * (font.hand ? 0.5 : 0.7), asc: n * 1.0, desc: n * 0.45 }
      : { w: texts[i].length * n * 0.82, asc: n * 0.78, desc: n * 0.08 };
  };
  const [measured, setMeasured] = useState<{ key: string; ms: (Metric | null)[] } | null>(null);
  const key = `${texts.join("|")}|${board.font}|${w}`;
  const ms = measured?.key === key ? measured.ms : texts.map((_, i) => estimate(i));
  const fit = stackWords(ms, nominal, space, w * 0.035);
  const refs = [useRef<SVGTextElement>(null), useRef<SVGTextElement>(null), useRef<SVGTextElement>(null)];
  useLayoutEffect(() => {
    const measure = () => {
      const next = refs.map((r, i) => {
        const el = r.current;
        if (!el || !texts[i]) return null;
        try {
          const bb = el.getBBox();
          const k = Number(el.getAttribute("font-size")) / nominal[i];
          const baseline = Number(el.getAttribute("y"));
          if (!bb.width || !k) return estimate(i);
          return { w: bb.width / k, asc: (baseline - bb.y) / k, desc: (bb.y + bb.height - baseline) / k };
        } catch { return estimate(i); }
      });
      setMeasured((prev) => {
        const same = prev?.key === key && prev.ms.every((m, i) => (m && next[i] ? Math.abs(m.w - next[i]!.w) + Math.abs(m.asc - next[i]!.asc) + Math.abs(m.desc - next[i]!.desc) < 0.05 : m === next[i]));
        return same ? prev : { key, ms: next };
      });
    };
    measure();
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    let live = true;
    fonts?.ready.then(() => live && measure());
    fonts?.addEventListener?.("loadingdone", measure);
    // Drawn while hidden (the builder keeps it mounted), nothing measures: again once it shows.
    const svg = refs.find((r) => r.current)?.current?.ownerSVGElement;
    const seen = svg && typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => measure()) : undefined;
    if (svg) seen?.observe(svg);
    return () => { live = false; fonts?.removeEventListener?.("loadingdone", measure); seen?.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, board.shape]);

  // A board without a stand hangs on the wall, above the floor.
  // The real photo of this shape on its stand, placed so its blank board is exactly the board's face.
  const scene = PIECES[`scene-${board.shape}-${easel ? "easel" : "none"}`];
  const [fx0, fy0, fx1, fy1] = scene.face;
  const photoW = w / (fx1 - fx0), photoH = h / (fy1 - fy0);
  const photoX = -fx0 * photoW, photoY = top - fy0 * photoH;
  const floor = photoY + scene.floor * photoH;
  // The theme's own real garland: up the board's right side from the floor, curving over its top corner.
  const real = (PIECES as Record<string, { w: number; h: number }>)[`garland-${theme.id}`];
  const gH = floor + 2 - (top + h * (board.shape === "rectangle" ? 0.02 : 0.08)), gW = real ? (gH * real.w) / real.h : 0;
  const gX = w + 9 * u - gW * 0.74;
  const right = garland ? (real ? Math.max(w + 22, gX + gW + 3) : w + 54 * u) : w + 22;
  const bottom = Math.min(floor + 8, photoY + photoH);
  const shine = board.material === "acrylic";
  return (
    <svg className={className} viewBox={`-22 0 ${f1(right + 22)} ${f1(bottom)}`} role="img" aria-label="Your welcome board" data-shape={board.shape} data-garnish={board.garnish}>
      <defs>
        <clipPath id={`${uid}-clip`}><path d={shape} /></clipPath>
        <filter id={`${uid}-soft`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={1.6} /></filter>
        <linearGradient id={`${uid}-gloss`} x1="0" y1="0" x2="1" y2="0.6">
          <stop offset="0.18" stopColor="#FFFFFF" stopOpacity={0} />
          <stop offset="0.26" stopColor="#FFFFFF" stopOpacity={0.38} />
          <stop offset="0.34" stopColor="#FFFFFF" stopOpacity={0} />
          <stop offset="0.4" stopColor="#FFFFFF" stopOpacity={0.18} />
          <stop offset="0.45" stopColor="#FFFFFF" stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <image data-part="scene" href={piece(`scene-${board.shape}-${easel ? "easel" : "none"}`)} x={f1(photoX)} y={f1(photoY)} width={f1(photoW)} height={f1(photoH)} preserveAspectRatio="none" />
      {/* A wide card shows past the photo's sides: its own empty wall and floor there, mirrored at each edge. */}
      {[photoX, photoX + photoW].map((edge, i) => (
        <g key={i} clipPath={`url(#${uid}-side${i})`}>
          <clipPath id={`${uid}-side${i}`}><rect x={f1(i ? edge : edge - photoW * 0.25)} y={f1(photoY)} width={f1(photoW * 0.25)} height={f1(photoH)} /></clipPath>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <image href={piece(`scene-${board.shape}-${easel ? "easel" : "none"}`)} x={f1(photoX)} y={f1(photoY)} width={f1(photoW)} height={f1(photoH)} preserveAspectRatio="none" transform={`matrix(-1 0 0 1 ${f1(2 * edge)} 0)`} />
        </g>
      ))}
      {/* The print, laid onto the photo's blank board: multiplied, so the photo's own light and shade show through it. */}
      <g clipPath={`url(#${uid}-clip)`} style={{ mixBlendMode: "multiply" }} data-part="print">
        <rect x={0} y={top} width={w} height={h} fill={art || board.design === "corners" ? "#FFFFFF" : board.colour} />
        {art && (
          // eslint-disable-next-line jsx-a11y/alt-text
          <image data-part="art" href={art} x={cx - h / 2} y={cy - w / 2} width={h} height={w} preserveAspectRatio="xMidYMid slice" transform={`rotate(90 ${cx} ${cy})`} />
        )}
        {board.design === "corners" && <PaintedCorners w={w} h={h} top={top} shape={board.shape} inks={paintInks(palette)} motif={theme.id === "frozen" ? "flake" : "leaf"} uid={uid} />}
      </g>
      <g fill={ink} textAnchor="middle" {...halo} style={isLight(ink) ? undefined : { mixBlendMode: "multiply" }}>
        {texts[0] && <text ref={refs[0]} x={cx} y={f1(fit.base[0])} fontSize={f1(fit.size[0])} letterSpacing={f1(fit.size[0] * 0.16)} data-word="heading" style={{ fontFamily: "var(--bz-sans), 'DM Sans', sans-serif", fontWeight: 700 }}>{texts[0]}</text>}
        {texts[1] && <text ref={refs[1]} x={cx} y={f1(fit.base[1])} fontSize={f1(fit.size[1])} opacity={faded(board.name)} data-word="name" style={{ fontFamily: `${fontCss(font)}, Georgia, serif`, fontWeight: font.weight }}>{texts[1]}</text>}
        {texts[2] && <text ref={refs[2]} x={cx} y={f1(fit.base[2])} fontSize={f1(fit.size[2])} letterSpacing={f1(fit.size[2] * 0.11)} opacity={faded(board.line)} data-word="line" style={{ fontFamily: "var(--bz-sans), 'DM Sans', sans-serif", fontWeight: 600 }}>{texts[2]}</text>}
      </g>
      {shine && <path d={shape} fill={`url(#${uid}-gloss)`} pointerEvents="none" />}
      {flowers && <>
        <Roses x={corner.tl[0]} y={corner.tl[1]} width={w * 0.46} turn={corner.tl[2]} />
        {!garland && <Roses x={corner.br[0]} y={corner.br[1]} width={w * 0.4} turn={corner.br[2]} mirror />}
      </>}
      {garland && real && (
        <g data-part="balloons">
          <ellipse cx={gX + gW * 0.74} cy={floor} rx={gW * 0.42} ry={2.6} fill="#3b2a22" opacity={0.22} filter={`url(#${uid}-soft)`} />
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <image data-part="garland" href={piece(`garland-${theme.id}` as keyof typeof PIECES)} x={f1(gX)} y={f1(floor + 2 - gH)} width={f1(gW)} height={f1(gH)} />
        </g>
      )}
      {garland && !real && <Garland x={w + 14 * u} y0={floor} y1={top + h * (board.shape === "rectangle" ? 0.16 : board.shape === "arch" ? 0.32 : 0.22)} u={u} colours={balloonColours} uid={uid} roses={flowers} />}
    </svg>
  );
}
