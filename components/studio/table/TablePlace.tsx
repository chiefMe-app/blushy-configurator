// One place of the kids' table from straight above, stacked from photos of
// each piece (lib/studio/tablePlace.ts says what goes where). The white pieces
// are tinted in the browser and the words are set in the page's own fonts, so a
// change of colour or words shows at once, with no render (2026-10-29).
import { useEffect, useMemo, useState } from "react";
import type { TableSetup } from "@/lib/studio/tableSetup";
import { fitPlacematWords } from "@/lib/studio/placematWords";
import { PLACE_VIEW, placeLayout, type PlaceNode } from "@/lib/studio/tablePlace";

type Face = "elegant" | "script";
const FACE_VAR: Record<Face, string> = { elegant: "--bz-font-playfair", script: "--bz-font-signature" };
const FACE_FALLBACK: Record<Face, string> = { elegant: "'Playfair Display', Georgia, serif", script: "Italianno, cursive" };
// Before the fonts are measured: about how wide a letter is, for a size of 1.
const GUESS: Record<Face, number> = { elegant: 0.68, script: 0.36 };

/** The faces' CSS families (next/font's own names), and a line's width at size 1, measured once the fonts have loaded. */
function useMeasure() {
  const [, setLoaded] = useState(0);
  const families = useMemo(() => {
    if (typeof window === "undefined") return FACE_FALLBACK;
    const css = getComputedStyle(document.documentElement);
    return { elegant: css.getPropertyValue(FACE_VAR.elegant).trim() || FACE_FALLBACK.elegant, script: css.getPropertyValue(FACE_VAR.script).trim() || FACE_FALLBACK.script };
  }, []);
  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts) return;
    let live = true;
    void Promise.all((Object.keys(families) as Face[]).map((f) => document.fonts.load(`40px ${families[f]}`).catch(() => null))).then(() => { if (live) setLoaded((n) => n + 1); });
    return () => { live = false; };
  }, [families]);
  const ctx = useMemo(() => (typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d")), []);
  const width = (text: string, face: Face) => {
    if (!ctx) return text.length * GUESS[face];
    ctx.font = `100px ${families[face]}`;
    return ctx.measureText(text).width / 100;
  };
  return { families, width };
}

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
  const { families, width } = useMeasure();
  const filters = new Map<string, { tint?: string; lift: number }>();
  const use = (tint: string | undefined, lift: number) => {
    if (!tint && lift <= 0) return undefined;
    const id = filterId(tint, lift);
    filters.set(id, { tint, lift });
    return `url(#${id})`;
  };
  const text = (lines: string[], face: Face, size: number, colour: string, x: number, y0: number, anchor: "end" | "middle", gap: number) =>
    lines.map((l, i) => <text key={i} x={x} y={y0 + i * gap} fontSize={size} fill={colour} textAnchor={anchor} style={{ fontFamily: families[face] }}>{l}</text>);
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
        // Bottom-right of the placemat, right-aligned, one word a line, as big as the corner allows.
        const size = fitPlacematWords(n.lines, (line, s) => width(line, "elegant") * s), gap = size * 1.12;
        return <g key={n.id} data-part={n.id} data-size={size.toFixed(1)}>{text(n.lines, "elegant", size, n.colour, 20, 14 - (n.lines.length - 1) * gap, "end", gap)}</g>;
      }
      case "words": {
        const size = Math.min(n.h / (n.lines.length * 1.1), (n.w / Math.max(...n.lines.map((l) => width(l, n.face)))));
        return <g key={n.id} data-part={n.id}>{text(n.lines, n.face, size, n.colour, n.x, n.y - ((n.lines.length - 1) * size * 1.1) / 2 + size * 0.3, "middle", size * 1.1)}</g>;
      }
      case "bottle": {
        const [lx, ly, lw, lh] = n.label;
        const x0 = n.x - n.w / 2, y0 = n.y - n.h / 2;
        const box = { x: x0 + lx * n.w, y: y0 + ly * n.h, w: lw * n.w, h: lh * n.h };
        const lines = n.words?.toUpperCase().split(/\s+/) ?? [];
        const size = lines.length ? Math.min(box.h / (lines.length * 1.25), (box.w * 0.85) / Math.max(...lines.map((l) => width(l, "elegant")))) : 0;
        const all = { x: x0, y: y0, width: n.w, height: n.h, preserveAspectRatio: "none" as const };
        return <g key={n.id} filter={use(undefined, 1.8)} data-part={n.id}>
          <image href="/design/table/top/bottle.webp" {...all} />
          <mask id={`${n.id}-m`}><image href="/design/table/top/bottle-label.webp" {...all} /></mask>
          <g mask={`url(#${n.id}-m)`}>
            {n.art ? <image href={n.art} x={box.x} y={box.y} width={box.w} height={box.h} preserveAspectRatio="xMidYMid slice" /> : <rect x={box.x} y={box.y} width={box.w} height={box.h} fill={n.fill} />}
            {size > 0 && text(lines, "elegant", size, n.colour, n.x, box.y + box.h / 2 - ((lines.length - 1) * size * 1.12) / 2 + size * 0.35, "middle", size * 1.12)}
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
      <rect x={PLACE_VIEW.x} y={PLACE_VIEW.y} width={PLACE_VIEW.w} height={PLACE_VIEW.h} fill="#CFC6BC" />
      {body}
    </svg>
  );
}
