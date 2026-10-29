// One place of the kids' table from straight above, stacked from photos of
// each piece (lib/studio/tablePlace.ts says what goes where). The white pieces
// are tinted in the browser and the words are set in the page's own fonts, so a
// change of colour or words shows at once, with no render (2026-10-29).
import { useEffect, useMemo, useState } from "react";
import type { TableSetup } from "@/lib/studio/tableSetup";
import { fitPlacematWords, placematWordsBottom, placematWordsGap } from "@/lib/studio/placematWords";
import { PLACE_VIEW, placeLayout, type PlaceNode } from "@/lib/studio/tablePlace";
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

export default function TablePlace({ table, theme, className }: { table: TableSetup; theme: { id: string; balloonColors: string[]; accent: string }; className?: string }) {
  const nodes = useMemo(() => placeLayout(table, theme), [table, theme]);
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
        return <polygon key="top" points={n.pts.map((p) => p.join(",")).join(" ")} fill={n.fill} filter={use(undefined, 1.2)} data-part="table-top" />;
      case "img": {
        const box = { x: n.x - n.w / 2, y: n.y - n.h / 2, width: n.w, height: n.h, preserveAspectRatio: "none" as const };
        const turn = n.rot ? `rotate(${n.rot} ${n.x} ${n.y})` : undefined;
        if (n.print) {
          // A printed piece: the design inside its shape, under the piece's own light and shade.
          return <g key={n.id} transform={turn} filter={use(undefined, n.lift)} data-part={n.id}>
            <mask id={`${n.id}-m`}><image href={n.src} {...box} /></mask>
            <image href={n.print} {...box} preserveAspectRatio="xMidYMid slice" mask={`url(#${n.id}-m)`} />
            <image href={n.src} {...box} style={{ mixBlendMode: "multiply" }} />
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
        // One line, left to right round the bottle, like the flat label (2026-10-29: "dikdörtgendeki gibi soldan sağa").
        const lines = n.words ? [n.words] : [];
        const scale = tableFont(n.font).scale;
        const size = lines.length ? Math.min((box.h * scale) / (lines.length * 1.25), (box.w * 0.74) / Math.max(...lines.map((l) => width(l, n.font)))) : 0;
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
    <svg className={className} viewBox={`${PLACE_VIEW.x} ${PLACE_VIEW.y} ${PLACE_VIEW.w} ${PLACE_VIEW.h}`} role="img" data-testid="table-place"
      aria-label="One place at your kids' table, from above">
      <defs>
        <linearGradient id="tp-band" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity={0.35} /><stop offset="0.5" stopColor="#fff" stopOpacity={0} /><stop offset="1" stopColor="#000" stopOpacity={0.12} /></linearGradient>
        {Array.from(filters, ([id, f]) => <Filter key={id} {...f} />)}
      </defs>
      {/* The ground: a lawn in the garden (2026-10-29, the owner: "maybe we can do grass the floor"), a pale floor indoors. */}
      {(table.scene ?? "garden") === "garden"
        ? <image href="/design/table/top/floor-grass.webp" x={PLACE_VIEW.x} y={PLACE_VIEW.y} width={PLACE_VIEW.w} height={PLACE_VIEW.h} preserveAspectRatio="xMidYMid slice" data-part="floor-grass" />
        : <rect x={PLACE_VIEW.x} y={PLACE_VIEW.y} width={PLACE_VIEW.w} height={PLACE_VIEW.h} fill="#CFC6BC" data-part="floor" />}
      {body}
    </svg>
  );
}
