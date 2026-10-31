// One place of the kids' table from straight above, stacked from photos of
// each piece (lib/studio/tablePlace.ts says what goes where). The white pieces
// are tinted in the browser and the words are set in the page's own fonts, so a
// change of colour or words shows at once, with no render (2026-10-29).
import { useEffect, useMemo, useState } from "react";
import type { TableSetup } from "@/lib/studio/tableSetup";
import { fitPlacematWords, placematWordsBottom, placematWordsGap } from "@/lib/studio/placematWords";
import { placeLayout, placeView, type PlaceMode, type PlaceNode } from "@/lib/studio/tablePlace";
import { FOILS } from "@/lib/studio/tableCatalog";
import { fontCss, tableFont } from "@/lib/studio/tableFonts";

/** A face: "script" (the name tags', the page's own Italianno), or a lettering font of lib/studio/tableFonts. */
type Face = string;
const SCRIPT_VAR = "--bz-font-signature";

/** The lettering fonts' stylesheet, added to the page once. */
const FONTS_CSS = "/fonts/typography/fonts.css";
let fontsCss: Promise<void> | null = null;
export function loadFontsCss(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (!fontsCss) {
    fontsCss = new Promise((done) => {
      if (document.querySelector(`link[href="${FONTS_CSS}"]`)) { done(); return; }
      const link = Object.assign(document.createElement("link"), { rel: "stylesheet", href: FONTS_CSS });
      link.onload = link.onerror = () => done();
      document.head.appendChild(link);
    });
  }
  return fontsCss;
}

/** The faces' CSS (family and weight), and a line's width at size 1, measured once the fonts have loaded. */
function useMeasure(faces: Face[]) {
  const [, setLoaded] = useState(0);
  const script = useMemo(() => (typeof window === "undefined" ? "" : getComputedStyle(document.documentElement).getPropertyValue(SCRIPT_VAR).trim()) || "Italianno, cursive", []);
  const family = (face: Face) => (face === "script" ? script : `${fontCss(tableFont(face))}, Georgia, serif`);
  const weight = (face: Face) => (face === "script" ? 400 : tableFont(face).weight);
  const key = Array.from(new Set(faces)).sort().join(",");
  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts) return;
    let live = true;
    void loadFontsCss()
      .then(() => Promise.all(key.split(",").filter(Boolean).map((f) => document.fonts.load(`${weight(f)} 40px ${family(f)}`).catch(() => null))))
      .then(() => { if (live) setLoaded((n) => n + 1); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const ctx = useMemo(() => (typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d")), []);
  const width = (text: string, face: Face) => {
    // Before the fonts are measured: about how wide a letter is, for a size of 1.
    if (!ctx) return text.length * (face === "script" ? 0.36 : 0.62);
    ctx.font = `${weight(face)} 100px ${family(face)}`;
    return ctx.measureText(text).width / 100;
  };
  return { family, weight, width };
}

/** The faces a view letters in. */
const facesOf = (nodes: PlaceNode[]): Face[] => nodes.flatMap((n) => (n.k === "group" ? facesOf(n.nodes) : n.k === "matWords" || n.k === "bottle" ? [n.font] : n.k === "words" ? [n.face] : []));

/** Every tint and shadow the view uses, as filters: a white piece multiplied by its colour, then its shadow. */
const filterId = (tint: string | undefined, lift: number) => `tp-${(tint ?? "none").replace("#", "")}-${Math.round(lift * 10)}`;
function Filter({ tint, lift }: { tint?: string; lift: number }) {
  return (
    <filter id={filterId(tint, lift)} x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
      {tint && <feFlood floodColor={tint} result="c" />}
      {tint && <feComposite in="c" in2="SourceGraphic" operator="arithmetic" k1={1} k2={0} k3={0} k4={0} result="t" />}
      {lift > 0 && <feDropShadow in={tint ? "t" : "SourceGraphic"} dx={lift * 0.25} dy={lift * 0.4} stdDeviation={0.07 + lift * 0.3} floodColor="#2b1d24" floodOpacity={0.18 + Math.min(0.14, lift * 0.02)} />}
    </filter>
  );
}

/**
 * A white yarn pompom (2026-10-31, the owner: "pompomu gerçek pompom ve beyaz
 * olsun"): a soft shaded ball of fine strands, its edge frayed.
 */
function Pompom({ id, cx, cy, r }: { id: string; cx: number; cy: number; r: number }) {
  // The same strands every time (no Math.random: the server and the page must agree).
  const strands = Array.from({ length: 90 }, (_, i) => {
    const a = i * 2.39996, d = r * Math.sqrt(((i * 37) % 90) / 90), len = r * (0.25 + ((i * 53) % 10) / 30);
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
    return { x1: x, y1: y, x2: x + Math.cos(a + 0.5) * len, y2: y + Math.sin(a + 0.5) * len, shade: i % 3 };
  });
  return (
    <g data-part={id}>
      <defs>
        <radialGradient id={`${id}-g`} cx="0.38" cy="0.35" r="0.7"><stop offset="0" stopColor="#FFFFFF" /><stop offset="0.65" stopColor="#F6F3F5" /><stop offset="1" stopColor="#DCD6DB" /></radialGradient>
        <filter id={`${id}-f`} x="-40%" y="-40%" width="180%" height="180%">
          <feTurbulence type="fractalNoise" baseFrequency={6 / r} numOctaves={2} seed={7} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={r * 0.22} xChannelSelector="R" yChannelSelector="G" result="d" />
          <feDropShadow in="d" dx={0.12} dy={0.2} stdDeviation={0.12} floodColor="#2b1d24" floodOpacity={0.22} />
        </filter>
      </defs>
      <g filter={`url(#${id}-f)`}>
        <circle cx={cx} cy={cy} r={r} fill={`url(#${id}-g)`} />
        {strands.map((s, i) => <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={["#FFFFFF", "#EEEAED", "#E2DCE1"][s.shade]} strokeWidth={r * 0.07} strokeLinecap="round" />)}
      </g>
    </g>
  );
}

/** `fill`: covers its box, cropping the sides (a card in My designs, 2026-10-30). */
export default function TablePlace({ table, theme, className, fill, mode = "one" }: { table: TableSetup; theme: { id: string; balloonColors: string[]; accent: string }; className?: string; fill?: boolean; mode?: PlaceMode }) {
  const nodes = useMemo(() => placeLayout(table, theme, mode), [table, theme, mode]);
  const view = useMemo(() => placeView(table, mode), [table, mode]);
  const top = nodes.find((n): n is Extract<PlaceNode, { k: "top" }> => n.k === "top");
  const { family, weight, width } = useMeasure(facesOf(nodes));
  const filters = new Map<string, { tint?: string; lift: number }>();
  const use = (tint: string | undefined, lift: number) => {
    if (!tint && lift <= 0) return undefined;
    const id = filterId(tint, lift);
    filters.set(id, { tint, lift });
    return `url(#${id})`;
  };
  const text = (lines: string[], face: Face, size: number, colour: string, x: number, y0: number, anchor: "end" | "middle", gap: number) =>
    lines.map((l, i) => <text key={i} x={x} y={y0 + i * gap} fontSize={size} fill={colour} textAnchor={anchor} style={{ fontFamily: family(face), fontWeight: weight(face) }}>{l}</text>);
  const draw = (n: PlaceNode): React.ReactNode => {
    switch (n.k) {
      case "top":
        // The table top fills the picture (2026-10-29: no chairs, no floor): drawn under everything, below.
        return null;
      case "img": {
        const box = { x: n.x - n.w / 2, y: n.y - n.h / 2, width: n.w, height: n.h, preserveAspectRatio: "none" as const };
        const turn = n.rot ? `rotate(${n.rot} ${n.x} ${n.y})` : undefined;
        if (n.foil) {
          // A foil: its shimmer inside the piece's shape, under the piece's own light and shade.
          return <g key={n.id} transform={turn} filter={use(undefined, n.lift)} data-part={n.id} data-foil={n.foil}>
            <mask id={`${n.id}-m`}><image href={n.src} {...box} /></mask>
            <rect x={box.x} y={box.y} width={box.width} height={box.height} fill={`url(#tp-foil-${n.foil})`} mask={`url(#${n.id}-m)`} />
            <image href={n.src} {...box} style={{ mixBlendMode: "multiply" }} />
          </g>;
        }
        if (n.print) {
          // A printed piece: the design inside its shape, under the piece's own light and shade.
          return <g key={n.id} transform={turn} filter={use(undefined, n.lift)} data-part={n.id}>
            <mask id={`${n.id}-m`}><image href={n.src} {...box} /></mask>
            <image href={n.print} {...box} preserveAspectRatio="xMidYMid slice" mask={`url(#${n.id}-m)`} />
            <image href={n.src} {...box} style={{ mixBlendMode: "multiply" }} />
          </g>;
        }
        if (n.keep) {
          // The tinted hat, and a real white pompom over its tip, a little bigger than the photo's (2026-10-31).
          const k = n.keep;
          return <g key={n.id} transform={turn} data-part={n.id} data-tint={n.tint}>
            <image href={n.src} {...box} filter={use(n.tint, n.lift)} />
            <Pompom id={`${n.id}-pompom`} cx={box.x + k.cx * n.w} cy={box.y + k.cy * n.w} r={k.r * n.w * 1.35} />
          </g>;
        }
        return <image key={n.id} href={n.src} {...box} transform={turn} filter={use(n.tint, n.lift)} data-part={n.id} data-tint={n.tint} />;
      }
      case "sheet":
        return <g key={n.id} filter={use(undefined, n.lift)} data-part={n.id}>
          {n.art ? <image href={n.art} x={n.x - n.w / 2} y={n.y - n.h / 2} width={n.w} height={n.h} preserveAspectRatio="xMidYMid slice" />
            : <rect x={n.x - n.w / 2} y={n.y - n.h / 2} width={n.w} height={n.h} fill={n.fill} />}
        </g>;
      case "band":
        return <g key={n.id} filter={use(undefined, 0.15)} data-part={n.id}>
          <rect x={n.x - n.w / 2} y={n.y - n.h / 2} width={n.w} height={n.h} fill={n.fill} />
          <rect x={n.x - n.w / 2} y={n.y - n.h / 2} width={n.w} height={n.h} fill="url(#tp-band)" />
        </g>;
      case "matWords": {
        // Bottom-right of the placemat, right-aligned, one word a line, small (./placematWords).
        const face = tableFont(n.font);
        const size = fitPlacematWords(n.lines, (line, s) => width(line, n.font) * s, face), gap = placematWordsGap(size, face.scale);
        return <g key={n.id} data-part={n.id} data-size={size.toFixed(1)} data-font={n.font}>{text(n.lines, n.font, size, n.colour, 20, placematWordsBottom(size, face) - (n.lines.length - 1) * gap, "end", gap)}</g>;
      }
      case "words": {
        const size = Math.min(n.h / (n.lines.length * 1.1), (n.w / Math.max(...n.lines.map((l) => width(l, n.face)))));
        return <g key={n.id} data-part={n.id}>{text(n.lines, n.face, size, n.colour, n.x, n.y - ((n.lines.length - 1) * size * 1.1) / 2 + size * 0.3, "middle", size * 1.1)}</g>;
      }
      case "bottle": {
        const [lx, ly, lw, lh] = n.label;
        const x0 = n.x - n.w / 2, y0 = n.y - n.h / 2;
        const box = { x: x0 + lx * n.w, y: y0 + ly * n.h, w: lw * n.w, h: lh * n.h };
        // One line, left to right round the bottle, at the size it is printed on the 20.5 × 5 cm label:
        // only the front of it shows (2026-10-29: "olması gerektiği büyüklükte olsun, bütün yazıyı görmek zorunda değiliz").
        const lines = n.words ? [n.words] : [];
        const scale = tableFont(n.font).scale;
        const size = lines.length ? Math.min(1.5, box.h * 0.4) * scale : 0;
        const all = { x: x0, y: y0, width: n.w, height: n.h, preserveAspectRatio: "none" as const };
        return <g key={n.id} filter={use(undefined, 1.8)} data-part={n.id} data-font={n.font}>
          <image href="/design/table/top/bottle.webp" {...all} />
          <mask id={`${n.id}-m`}><image href="/design/table/top/bottle-label.webp" {...all} /></mask>
          <g mask={`url(#${n.id}-m)`}>
            {n.art ? <image href={n.art} x={box.x} y={box.y} width={box.w} height={box.h} preserveAspectRatio="xMidYMid slice" /> : <rect x={box.x} y={box.y} width={box.w} height={box.h} fill={n.fill} />}
            {size > 0 && text(lines, n.font, size, n.colour, n.x, box.y + box.h / 2 - ((lines.length - 1) * (size / scale) * 1.12) / 2 + (size / scale) * 0.35, "middle", (size / scale) * 1.12)}
          </g>
          <image href="/design/table/top/bottle-label.webp" {...all} style={{ mixBlendMode: "multiply" }} />
        </g>;
      }
      case "group":
        return <g key={n.id} transform={`translate(${n.x.toFixed(2)} ${n.y.toFixed(2)}) rotate(${n.rot.toFixed(2)})`} data-place={n.focus ? "focus" : undefined}>{n.nodes.map(draw)}</g>;
    }
  };
  const body = nodes.map(draw);
  return (
    <svg className={className} viewBox={`${view.x.toFixed(2)} ${view.y.toFixed(2)} ${view.w.toFixed(2)} ${view.h.toFixed(2)}`} role="img" data-testid="table-place"
      {...(fill ? { preserveAspectRatio: "xMidYMid slice" } : {})}
      aria-label={mode === "one" ? "One place at your kids' table, from above" : "Six places at your kids' table, from above"} data-mode={mode}>
      <defs>
        <linearGradient id="tp-band" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity={0.35} /><stop offset="0.5" stopColor="#fff" stopOpacity={0} /><stop offset="1" stopColor="#000" stopOpacity={0.12} /></linearGradient>
        {Array.from(filters, ([id, f]) => <Filter key={id} {...f} />)}
        {FOILS.map((f) => (
          <linearGradient key={f.id} id={`tp-foil-${f.id}`} x1="0" y1="0" x2="1" y2="1">
            {f.stops.map((c, i) => <stop key={i} offset={i / (f.stops.length - 1)} stopColor={c} />)}
          </linearGradient>
        ))}
      </defs>
      {/* Only the table top, edge to edge, like a flat lay (2026-10-29): its bare top or its cloth. */}
      <rect x={view.x} y={view.y} width={view.w} height={view.h} fill={top?.fill ?? "#F7F5F2"} data-part="table-top" />
      {body}
    </svg>
  );
}
