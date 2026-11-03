// The left-hand preview during the cake part of Decor (2026-11-03, the owner: "pasta standında, yakın plan"): the
// cake on a white stand, close up — a photo of the empty stand, the cake's white tiers stacked on its plate, each
// in its own colour (multiplied over the tier's own light and shade), the sugar figures and the topper with the
// name and age. Every figure and the topper is hers to drag anywhere on the cake, and a figure to copy, resize or
// take off (2026-11-03, the owner: "sürükle bırak … duplicate … her yere yapıştırabilsin"). Then that picture
// rendered into one photograph (usePieceRender, /api/cake-render).
import { useEffect, useRef, useState } from "react";
import { type BuilderConfig } from "@/lib/config";
import {
  CAKE_FIGURES, CAKE_FLAVOURS, CAKE_STAND, MAX_CAKE_DECOS, MAX_CAKE_FIGURES, TIER_WIDTHS, cakeStack, cakeStyle, figureKind, figurePicture, itemAt, placeItem,
  rainbowOf, roomFor, tierAt, tierColours, topperColour, topperShows, type Cake,
} from "@/lib/studio/cake";
import { asPrinted, fontCss, tableFont } from "@/lib/studio/tableFonts";
import { SWEET_PLACES, SWEET_SPOTS, sweetPicture, type CakeSweet } from "@/lib/studio/cakeSweets";
import FitText from "@/components/studio/FitText";
import { usePhoneJump } from "@/components/builder/usePhoneJump";
import type { PieceRender } from "@/components/builder/usePieceRender";
import RenderAgain from "@/components/builder/RenderAgain";

const WHITE = "#FFFFFF";
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Where everything goes, in the stand photo's pixels: the tiers bottom first, the figures, the topper's words. */
export function cakeLayout(k: Pick<Cake, "tiers" | "style" | "figures" | "topper">) {
  const { plate } = CAKE_STAND;
  const st = cakeStack(k);
  const figures = k.figures.map((it) => ({ ...placeItem(it, st), src: figurePicture(it.id).src }));
  const t = k.topper;
  const front = t.at === "front";
  const face = tableFont(t.font);
  // On top: the words over what stands on the top (unless she moved it), on two sticks down into the cake.
  // On the front: across the tier there, pressed onto it.
  const mid = st.base - (t.y ?? 0.5) * (st.base - st.top);
  const tier = tierAt(st, mid);
  const tw = (front ? Math.min(200, tier.w * 0.62) : Math.min(240, Math.max(150, st.topW * 1.15))) * (t.s ?? 1);
  const age = tw * 0.46, name = tw * 0.24 * (face.hand ? face.scale : 1);
  // The age's line at the bottom, the name's over it; a script's tall letters reach higher (from the age's line).
  const nameUp = t.age ? age * 0.82 : 0;
  const textUp = t.name.trim() ? nameUp + name * (face.hand ? 0.95 : 0.8) : age * 0.75;
  const card = t.card ? Math.max(10, tw * 0.09) : 0;
  const boxH = textUp + age * 0.12 + card * 2;
  const onTop = figures.filter((_, i) => k.figures[i].on === "top");
  const lift = t.up ?? (onTop.length ? Math.max(...onTop.map((f) => st.top - f.y)) + 8 : tw * 0.22) + card;
  const bottom = front ? mid + boxH / 2 - card - age * 0.12 : st.top - lift;
  const x = plate.x + (t.x ?? 0) * (front ? tier.w : st.topW);
  const words = { x, bottom, w: tw, name, age, nameY: bottom - nameUp, plane: st.top, stickX: plate.x + (t.x ?? 0) * st.topW * 0.9, front };
  const shows = topperShows(k);
  // Its box (the card's, when it is on one), to take hold of it; how far its foot is under the age's line.
  const pad = card ? card * 1.2 : 0;
  const topperBox = shows ? { x: x - tw / 2 - pad, y: bottom - textUp - card, w: tw + pad * 2, h: boxH, foot: card + age * 0.12 } : null;
  const contentTop = Math.min(shows && !front ? topperBox!.y : st.top, ...figures.map((f) => f.y), st.tiers[st.tiers.length - 1].y);
  return { st, tiers: st.tiers, figures, words, topperBox, contentTop, pic: st.pic };
}

/** The same scatter every time for the same tier: a small seeded random. */
function random(seed: number) {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type TierBox = { x: number; y: number; w: number; h: number; top: number; bottom: number };

/** A tier in rainbow buttercream: patches of its colours over the first, smoothed or softly blended, under the tier's light. */
function RainbowTier({ id, t, r, seed }: { id: string; t: TierBox; r: NonNullable<ReturnType<typeof rainbowOf>>; seed: number }) {
  const rnd = random(seed * 31 + r.hexes.length);
  // Over the whole tier, a patch in every part of it (a jittered grid), neighbours in different colours.
  const cols = 4, rows = 3;
  const patches = Array.from({ length: cols * rows }, (_, j) => {
    const c = j % cols, w = Math.floor(j / cols);
    return {
      cx: t.x + ((c + 0.2 + rnd() * 0.6) / cols) * t.w, cy: t.y + ((w + 0.2 + rnd() * 0.6) / rows) * t.h,
      rx: (t.w / cols) * (0.62 + rnd() * 0.3), ry: (t.h / rows) * (0.55 + rnd() * 0.3), fill: r.hexes[(c * 2 + w * 3 + 1) % r.hexes.length],
    };
  });
  return (
    <g mask={`url(#${id})`} style={{ mixBlendMode: "multiply" }} data-part="cake-colour" data-rainbow={r.id}>
      {r.blend && <defs><filter id={`${id}-soft`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={t.w * 0.035} /></filter></defs>}
      <rect x={t.x} y={t.y} width={t.w} height={t.h} fill={r.hexes[0]} />
      <g filter={r.blend ? `url(#${id}-soft)` : undefined}>
        {patches.map((p, j) => <ellipse key={j} {...p} transform={`rotate(${(rnd() - 0.5) * 50} ${p.cx} ${p.cy})`} />)}
      </g>
    </g>
  );
}

const SPRINKLE_COLOURS = ["#F43F5E", "#FB923C", "#FACC15", "#22C55E", "#3B82F6", "#A855F7", "#FFFFFF", "#F9A8D4"];
/** Sprinkles on a tier: scattered, a thick band at its foot, or little hearts; on its side, and on the top for the top tier. */
function Sprinkles({ id, t, kind, seed, top, size, many = 1 }: { id: string; t: TierBox; kind: NonNullable<Cake["sprinkles"]>; seed: number; top: boolean; size?: number; many?: number }) {
  const rnd = random(seed * 17 + kind.length);
  const side = t.bottom - t.top;
  // From the top surface (for the top tier) down to the foot; a band keeps to its lowest quarter.
  const from = kind === "base" ? t.bottom - side * 0.28 : top ? t.y + 4 : t.top + 6;
  const n = Math.round(((t.w * (t.bottom - from)) / (kind === "base" ? 34 : 260)) * many);
  const bits = Array.from({ length: n }, () => {
    // A band thick at the foot, thinning upwards.
    const v = kind === "base" ? Math.pow(rnd(), 0.55) : rnd();
    return { x: t.x + t.w * (0.02 + rnd() * 0.96), y: from + v * (t.bottom + side * 0.04 - from), a: rnd() * 180, c: SPRINKLE_COLOURS[Math.floor(rnd() * SPRINKLE_COLOURS.length)], star: kind === "base" && rnd() < 0.12 };
  });
  const u = size ?? t.w / 280;
  const heart = (x: number, y: number, s: number) => `M ${x} ${y + s * 0.35} C ${x - s} ${y - s * 0.4} ${x - s * 0.45} ${y - s} ${x} ${y - s * 0.45} C ${x + s * 0.45} ${y - s} ${x + s} ${y - s * 0.4} ${x} ${y + s * 0.35} Z`;
  return (
    <g mask={`url(#${id})`} data-part="cake-sprinkles" data-kind={kind}>
      {bits.map((b, j) => kind === "hearts"
        ? <path key={j} d={heart(b.x, b.y, 4.2 * u)} fill={b.c === "#FFFFFF" ? "#F9A8D4" : b.c} transform={`rotate(${b.a / 4 - 22} ${b.x} ${b.y})`} />
        : b.star ? <path key={j} d={`M ${b.x} ${b.y - 4 * u} L ${b.x + 1.2 * u} ${b.y - 1.2 * u} L ${b.x + 4 * u} ${b.y - 1 * u} L ${b.x + 1.8 * u} ${b.y + 1 * u} L ${b.x + 2.5 * u} ${b.y + 4 * u} L ${b.x} ${b.y + 2.2 * u} L ${b.x - 2.5 * u} ${b.y + 4 * u} L ${b.x - 1.8 * u} ${b.y + 1 * u} L ${b.x - 4 * u} ${b.y - 1 * u} L ${b.x - 1.2 * u} ${b.y - 1.2 * u} Z`} fill="#FFFFFF" />
        : <rect key={j} x={b.x - 3.6 * u} y={b.y - 1.15 * u} width={7.2 * u} height={2.3 * u} rx={1.15 * u} fill={b.c} transform={`rotate(${b.a} ${b.x} ${b.y})`} />)}
    </g>
  );
}

/**
 * A sweet on the table beside the stand (2026-11-03, the owner: "cupcake, cookie, cake pops … ve donut"): its photo,
 * its icing in her colour (multiplied through the icing's mask), sprinkles on the icing, a little figure on each
 * cupcake, a print on each cookie.
 */
function SweetPiece({ s, k, uid }: { s: CakeSweet; k: Cake; uid: string }) {
  const pic = sweetPicture(s.id), at = SWEET_PLACES[s.id];
  const h = at.tall, w = (pic.w / pic.h) * h, x = at.x - w / 2, y = at.foot - h;
  const id = `${uid}-${s.id}`;
  const spots = (SWEET_SPOTS[s.id] ?? []).map((p) => ({ x: x + p.x * w, y: y + p.y * h, w: p.w * w }));
  const face = tableFont(k.topper.font);
  const print = s.print && s.print !== "age" ? figurePicture(s.print) : null;
  return (
    <g data-part="cake-sweet" data-sweet={s.id}>
      <defs><mask id={id} style={{ maskType: "alpha" }}><image href={pic.icing} x={x} y={y} width={w} height={h} /></mask></defs>
      <image href={pic.src} x={x} y={y} width={w} height={h} />
      {s.colour.toUpperCase() !== WHITE && <rect mask={`url(#${id})`} style={{ mixBlendMode: "multiply" }} x={x} y={y} width={w} height={h} fill={s.colour} />}
      {s.sprinkles && <Sprinkles id={id} t={{ x, y, w, h, top: y, bottom: y + h }} kind="scatter" seed={s.id.length} top size={w / 300} many={2.2} />}
      {s.print && spots.map((p, i) => s.print === "age"
        ? <text key={i} x={p.x} y={p.y + p.w * 0.16} fontSize={p.w * 0.5} textAnchor="middle" fill={topperColour(k.topper.colour).hex} transform={`translate(0 ${p.y * 0.38}) scale(1 0.62)`}
          style={{ fontFamily: `${fontCss(face)}, Georgia, serif`, fontWeight: face.weight }} data-part="cake-sweet-print">{k.topper.age || "1"}</text>
        : print && (() => {
          // Lying flat on the cookie: as wide, less tall.
          const pw = p.w * 0.62, ph = ((pw * print.h) / print.w) * 0.62;
          return <image key={i} href={print.src} x={p.x - pw / 2} y={p.y - ph / 2} width={pw} height={ph} preserveAspectRatio="none" data-part="cake-sweet-print" />;
        })())}
      {s.topper && spots.map((p, i) => {
        const f = figurePicture(s.topper!), th = p.w * 0.95, tw = (th * f.w) / f.h;
        return <image key={i} href={f.src} x={p.x - tw / 2} y={p.y - th + p.w * 0.25} width={tw} height={th} data-part="cake-sweet-topper" />;
      })}
    </g>
  );
}

/** The card the name is printed on, its border in the topper's colour: drawn twice, the border under the white. */
function TopperCardShape({ kind, box, border, fill }: { kind: NonNullable<Cake["topper"]["card"]>; box: { x: number; y: number; w: number; h: number }; border: string; fill: string }) {
  const { x, y, w, h } = box;
  const shapes = (paint: string, grow: number) => {
    const p = { fill: paint, stroke: paint, strokeWidth: grow * 2 };
    if (kind === "circle") return <circle cx={x + w / 2} cy={y + h / 2} r={Math.max(w, h) / 2} {...p} />;
    if (kind === "plaque") return <rect x={x} y={y} width={w} height={h} rx={h * 0.22} {...p} />;
    // A cloud: a soft body and its bumps.
    return <g>
      <rect x={x} y={y + h * 0.18} width={w} height={h * 0.82} rx={h * 0.38} {...p} />
      {[[0.24, 0.2, 0.3], [0.5, 0.1, 0.38], [0.76, 0.22, 0.28]].map(([fx, fy, fr]) => <circle key={fx} cx={x + w * fx} cy={y + h * fy + h * fr * 0.6} r={h * fr} {...p} />)}
    </g>;
  };
  const bw = Math.max(3, h * 0.04);
  return <g data-part="cake-topper-card">{shapes(border, bw)}{shapes(fill, 0)}</g>;
}

/** What she has hold of: a figure (its place in the list) or the topper. */
export type CakePick = number | "topper";

/** The cake on its own, drawn in the stand photo's pixels (wrap it in a viewBox). */
export function CakePiece({ k, uid, grab }: { k: Cake; uid: string; grab?: (e: React.PointerEvent, what: CakePick) => void }) {
  const L = cakeLayout(k);
  const colours = tierColours(k);
  const tc = topperColour(k.topper.colour);
  const face = tableFont(k.topper.font);
  const family = `${fontCss(face)}, Georgia, serif`;
  const name = asPrinted(k.topper.name.trim(), face);
  const { words } = L;
  const ageY = words.bottom, nameY = words.nameY;
  const paint = `url(#${uid}-gold)`;
  const held = grab ? ({ cursor: "grab", touchAction: "none" } as React.CSSProperties) : undefined;
  return (
    <g data-part="cake">
      <defs>
        <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor={tc.light} /><stop offset="0.55" stopColor={tc.hex} /><stop offset="1" stopColor={tc.light} />
        </linearGradient>
      </defs>
      {L.tiers.map((t, i) => {
        const id = `${uid}-t${i}`;
        return (
          <g key={i} data-part="cake-tier">
            <defs><mask id={id} style={{ maskType: "alpha" }}><image href={L.pic.src} x={t.x} y={t.y} width={t.w} height={t.h} preserveAspectRatio="none" /></mask></defs>
            <image href={L.pic.src} x={t.x} y={t.y} width={t.w} height={t.h} preserveAspectRatio="none" />
            {/* Its colour under the tier's own light and shade: one, or a rainbow's patches. */}
            {rainbowOf(colours[i]) ? <RainbowTier id={id} t={t} r={rainbowOf(colours[i])!} seed={i} />
              : colours[i].toUpperCase() !== WHITE && (
                <rect mask={`url(#${id})`} style={{ mixBlendMode: "multiply" }} x={t.x} y={t.y} width={t.w} height={t.h} fill={colours[i]} data-part="cake-colour" />
              )}
            {k.sprinkles && <Sprinkles id={id} t={t} kind={k.sprinkles} seed={i} top={i === L.tiers.length - 1} />}
          </g>
        );
      })}
      {L.topperBox && (
        <g data-part="cake-topper" data-at={words.front ? "front" : "top"} style={held} onPointerDown={grab ? (e) => grab(e, "topper") : undefined}>
          {!words.front && [-0.17, 0.17].map((dx) => (
            <path key={dx} d={`M ${words.x + dx * words.w} ${ageY - words.age * 0.1} L ${words.stickX + dx * words.w * 0.9} ${words.plane + 6}`}
              stroke={k.topper.card ? "#F4F1EA" : paint} strokeWidth={4} strokeLinecap="round" />
          ))}
          {k.topper.card && <TopperCardShape kind={k.topper.card} box={L.topperBox} border={tc.hex} fill={k.topper.colour === "white" ? "#F7B6D2" : WHITE} />}
          {/* Something to take hold of between the letters. */}
          {grab && <rect x={L.topperBox.x} y={L.topperBox.y} width={L.topperBox.w} height={L.topperBox.h} fill="transparent" />}
          {name && <FitText x={words.x} y={nameY} fontSize={words.name} maxWidth={words.w} textAnchor="middle" fill={paint}
            stroke={tc.hex} strokeWidth={words.name * 0.03} paintOrder="stroke" style={{ fontFamily: family, fontWeight: face.weight }}>{name}</FitText>}
          {k.topper.age && <FitText x={words.x} y={ageY} fontSize={words.age} maxWidth={words.w * 0.8} textAnchor="middle" fill={paint}
            stroke={tc.hex} strokeWidth={words.age * 0.02} paintOrder="stroke" style={{ fontFamily: family, fontWeight: face.weight }}>{k.topper.age}</FitText>}
        </g>
      )}
      {L.figures.map((f, i) => (
        <g key={i}>
          {f.stick && <path d={`M ${f.stick.x} ${f.stick.y1} L ${f.stick.x} ${f.stick.y2}`} stroke="#F4F1EA" strokeWidth={4} strokeLinecap="round" />}
          <image data-part="cake-figure" data-on={k.figures[i].on} data-kind={figureKind(k.figures[i].id)} href={f.src} x={f.x} y={f.y} width={f.w} height={f.h}
            style={held} onPointerDown={grab ? (e) => grab(e, i) : undefined} />
        </g>
      ))}
    </g>
  );
}

/** A small picture of a cake alone (the option cards): its own box, a soft shadow under it. */
export function CakeThumb({ k, uid }: { k: Cake; uid: string }) {
  const L = cakeLayout(k);
  const { plate } = CAKE_STAND;
  const half = Math.max(TIER_WIDTHS[k.tiers][0] / 2 + 10, 120);
  const top = L.contentTop - 10, bottom = plate.y + 40;
  const h = bottom - top, w = Math.max(half * 2, h * (4 / 3));
  return (
    <svg viewBox={`${plate.x - w / 2} ${top} ${w} ${h}`} aria-hidden="true">
      <ellipse cx={plate.x} cy={plate.y + 18} rx={TIER_WIDTHS[k.tiers][0] * 0.55} ry={14} fill="#000" opacity={0.08} />
      <CakePiece k={k} uid={uid} />
    </svg>
  );
}

/**
 * The view of the stand around a cake: close up, as tall as the cake and its topper need. The topper's room is kept
 * as for a topper put by itself on top, a little bigger — so sizing or moving it leaves the cake as it is (2026-11-03,
 * the owner: "topperı bigger smaller yapınca bütün pasta büyüyüp küçülüyor"); it stays inside that room.
 */
export function viewOf(k: Cake) {
  const { w: W } = CAKE_STAND;
  const sweets = !!k.sweets?.length;
  // With sweets on the table: the whole table, to its front edge.
  const bottom = sweets ? 1262 : CAKE_STAND.bottom;
  const room = cakeLayout({ ...k, topper: { ...k.topper, at: undefined, x: undefined, up: undefined, y: undefined, s: 1.25 } }).contentTop;
  const top = Math.max(0, Math.min(room - 50, cakeLayout(k).contentTop - 20, sweets ? bottom - W / 0.8 : Infinity));
  const h = bottom - top;
  const w = Math.min(W, h * 0.8);
  return { x: Math.max(0, Math.min(W - w, CAKE_STAND.plate.x - w / 2)), y: top, w, h };
}

/** The middle of what she holds. */
function middleOf(k: Cake, what: CakePick) {
  const L = cakeLayout(k);
  const b = what === "topper" ? L.topperBox! : L.figures[what];
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

/** How high the topper may stand: its box inside the view. */
function maxUp(k: Cake, view: { y: number }) {
  const L = cakeLayout({ ...k, topper: { ...k.topper, at: undefined, y: undefined } });
  const box = L.topperBox!;
  // Its top is (box.h − foot) over the age's line.
  return L.st.top - (view.y + 8 + box.h - box.foot);
}

/** The cake with what she holds moved so its middle is at (cx, cy): the topper on the top, or on the front when it is brought down onto the cake. */
function moved(k: Cake, what: CakePick, cx: number, cy: number, view: { y: number }): Cake {
  const st = cakeStack(k);
  if (what !== "topper") return { ...k, figures: k.figures.map((it, i) => (i === what ? itemAt(it, st, cx, cy) : it)) };
  const { at: _at, y: _y, up: _up, x: _x, ...rest } = k.topper;
  if (cy > st.top + st.depth) {
    const y = clamp((st.base - cy) / (st.base - st.top), 0.08, 0.92);
    const tier = tierAt(st, st.base - y * (st.base - st.top));
    return { ...k, topper: { ...rest, at: "front", y, x: clamp((cx - CAKE_STAND.plate.x) / tier.w, -0.3, 0.3) } };
  }
  const L = cakeLayout({ ...k, topper: rest });
  const box = L.topperBox!;
  // Its words' line, the box's middle moved there.
  const bottom = cy + box.h / 2 - box.foot;
  return { ...k, topper: { ...rest, x: clamp((cx - CAKE_STAND.plate.x) / st.topW, -0.4, 0.4), up: clamp(st.top - bottom, 0, Math.max(0, maxUp(k, view))) } };
}

/**
 * The stand, close up, with the cake on it. With `edit`, the figures and the topper are taken hold of and moved:
 * the cake changes when she lets go (while she drags, only the picture follows her, its view held still).
 */
export function CakeArt({ k, className, edit }: {
  k: Cake; className?: string;
  edit?: { picked: CakePick | null; onPick: (p: CakePick | null) => void; onChange: (k: Cake) => void };
}) {
  const { w: W, h: H } = CAKE_STAND;
  const svg = useRef<SVGSVGElement>(null);
  type Drag = { what: CakePick; from: { x: number; y: number }; at: { x: number; y: number }; mid: { x: number; y: number }; view: ReturnType<typeof viewOf>; id: number };
  const [drag, setDrag] = useState<Drag | null>(null);
  const point = (e: React.PointerEvent) => {
    const m = svg.current?.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };
  const shown = drag ? moved(k, drag.what, drag.mid.x + drag.at.x - drag.from.x, drag.mid.y + drag.at.y - drag.from.y, drag.view) : k;
  const view = drag?.view ?? viewOf(k);
  const grab = edit ? (e: React.PointerEvent, what: CakePick) => {
    e.stopPropagation();
    e.preventDefault();
    // Held while she drags, even off the picture (a pointer the browser no longer knows is let be).
    try { svg.current?.setPointerCapture(e.pointerId); } catch { /* followed while over the picture */ }
    const p = point(e);
    setDrag({ what, from: p, at: p, mid: middleOf(k, what), view: viewOf(k), id: e.pointerId });
    edit.onPick(what);
  } : undefined;
  const letGo = (e: React.PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const far = Math.hypot(drag.at.x - drag.from.x, drag.at.y - drag.from.y);
    setDrag(null);
    if (far > 3) edit?.onChange(shown);
  };
  const L = edit && edit.picked !== null ? cakeLayout(shown) : null;
  const frame = L ? (edit!.picked === "topper" ? L.topperBox : L.figures[edit!.picked as number]) : null;
  return (
    <svg ref={svg} className={className} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} role="img" aria-label="Your cake on its stand" data-testid="cake-art"
      style={drag ? { touchAction: "none" } : undefined}
      onPointerDown={edit ? () => edit.onPick(null) : undefined}
      onPointerMove={drag ? (e) => { if (e.pointerId === drag.id) setDrag({ ...drag, at: point(e) }); } : undefined}
      onPointerUp={letGo} onPointerCancel={letGo}>
      <image href={CAKE_STAND.src} x={0} y={0} width={W} height={H} />
      {(k.sweets ?? []).map((sw) => <SweetPiece key={sw.id} s={sw} k={k} uid="ck-sw" />)}
      <CakePiece k={shown} uid="ck-stand" grab={grab} />
      {frame && <rect data-no-capture="" data-testid="cake-picked" x={frame.x - 6} y={frame.y - 6} width={frame.w + 12} height={frame.h + 12} rx={10}
        fill="none" stroke="#FF0D66" strokeWidth={3} strokeDasharray="10 7" pointerEvents="none" />}
    </svg>
  );
}

/** The tools for what she picked on the cake: a figure to copy, size, bring forward or take off; the topper to size or put back. */
function PickedTools({ k, picked, setCake, onPick }: { k: Cake; picked: CakePick; setCake: (k: Cake) => void; onPick: (p: CakePick | null) => void }) {
  if (picked === "topper") {
    const s = k.topper.s ?? 1;
    const setTopper = (patch: Partial<Cake["topper"]>) => setCake({ ...k, topper: { ...k.topper, ...patch } });
    // Bigger while it fits: on top, inside the picture's room over the cake; on the front, on its tier.
    const bigger = { ...k, topper: { ...k.topper, s: clamp(s * 1.12, 0.6, 1.6) } };
    const L = cakeLayout(bigger), view = viewOf(k);
    const fits = k.topper.at === "front" ? L.topperBox!.w <= tierAt(L.st, L.topperBox!.y + L.topperBox!.h / 2).w * 0.95 : L.topperBox!.y >= view.y + 8;
    return (
      <div className="bz-ck-tools" role="toolbar" aria-label="The topper" data-testid="cake-tools">
        <b>Topper</b>
        <button type="button" onClick={() => setCake(bigger)} disabled={s >= 1.6 || !fits}>Bigger</button>
        <button type="button" onClick={() => setTopper({ s: clamp(s / 1.12, 0.6, 1.6) })} disabled={s <= 0.6}>Smaller</button>
        <button type="button" onClick={() => setTopper({ at: undefined, x: undefined, up: undefined, y: undefined, s: undefined })}>Put back</button>
        <button type="button" className="off" onClick={() => { setTopper({ on: false }); onPick(null); }}>Remove</button>
        <button type="button" className="done" aria-label="Done" onClick={() => onPick(null)}>✓</button>
      </div>
    );
  }
  const it = k.figures[picked];
  if (!it) return null;
  const name = CAKE_FIGURES.find((f) => f.id === it.id)?.name;
  const set = (figures: Cake["figures"], next: CakePick | null = picked) => { setCake({ ...k, figures }); onPick(next); };
  const full = roomFor(k.figures, it.id) <= 0;
  const most = figureKind(it.id) === "deco" ? MAX_CAKE_DECOS : MAX_CAKE_FIGURES;
  const copy = () => {
    // Beside it, the same size and on the same part of the cake.
    const st = cakeStack(k);
    const at = placeItem(it, st);
    const shift = at.w * 0.7 * (it.x > 0.15 ? -1 : 1);
    const twin = itemAt(it, st, at.x + at.w / 2 + shift, at.y + at.h / 2);
    set([...k.figures.slice(0, picked + 1), twin, ...k.figures.slice(picked + 1)], picked + 1);
  };
  const resize = (f: number) => set(k.figures.map((x, i) => (i === picked ? { ...x, s: Math.round(clamp(x.s * f, 0.3, 2.5) * 100) / 100 } : x)));
  const move = (to: number) => {
    const rest = k.figures.filter((_, i) => i !== picked);
    const at = clamp(to, 0, rest.length);
    set([...rest.slice(0, at), it, ...rest.slice(at)], at);
  };
  return (
    <div className="bz-ck-tools" role="toolbar" aria-label={name} data-testid="cake-tools">
      <b>{name}</b>
      <button type="button" onClick={copy} disabled={full} title={full ? `Up to ${most} of these` : undefined}>Copy</button>
      <button type="button" onClick={() => resize(1.15)} disabled={it.s >= 2.5}>Bigger</button>
      <button type="button" onClick={() => resize(1 / 1.15)} disabled={it.s <= 0.3}>Smaller</button>
      <button type="button" onClick={() => move(picked + 1)} disabled={picked >= k.figures.length - 1}>Forward</button>
      <button type="button" onClick={() => move(picked - 1)} disabled={picked <= 0}>Back</button>
      <button type="button" className="off" onClick={() => set(k.figures.filter((_, i) => i !== picked), null)}>Remove</button>
      <button type="button" className="done" aria-label="Done" onClick={() => onPick(null)}>✓</button>
    </div>
  );
}

export default function CakePreview({ config, setCake, render, onGenerate }: { config: BuilderConfig; setCake: (k: Cake) => void; render: PieceRender; onGenerate: () => void }) {
  const k = config.cake;
  // On a phone, a choice brings the preview into sight — not a figure moved in it.
  const changeKey = k?.enabled ? JSON.stringify({ ...k, figures: k.figures.map((f) => f.id), topper: { ...k.topper, at: undefined, x: undefined, up: undefined, y: undefined, s: undefined }, done: undefined, render: undefined }) : "";
  const { backTo, back } = usePhoneJump(changeKey, "cake-preview-card");
  const [live, setLive] = useState(false);
  const [picked, setPicked] = useState<CakePick | null>(null);
  useEffect(() => { if (render.url) setLive(false); }, [render.url]);
  // Nothing held that is not there any more.
  const pick = k && picked !== null && (picked === "topper" ? topperShows(k) : picked < k.figures.length) ? picked : null;
  const showRender = !!render.url && !live;
  return (
    <div className="bz-tb-preview" data-testid="cake-preview" id="cake-preview-card">
      <div className="head">
        <span className="title">✦ Your cake</span>
        {render.url && (
          <div className="views" role="tablist" aria-label="Cake view">
            <button type="button" role="tab" aria-selected={!showRender} className={!showRender ? "on" : ""} onClick={() => setLive(true)}>Live</button>
            <button type="button" role="tab" aria-selected={showRender} className={showRender ? "on" : ""} onClick={() => setLive(false)}>Render</button>
          </div>
        )}
      </div>
      {k?.enabled ? <>
        {showRender ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="bz-tb-photo" data-testid="cake-render" src={render.url!} alt="Your cake, rendered" />
        ) : <>
          <div className={render.loading ? "bz-wb-wait on" : "bz-wb-wait"}>
            <CakeArt k={k} className="bz-ck-art" edit={render.loading ? undefined : { picked: pick, onPick: setPicked, onChange: setCake }} />
            {render.loading && (
              <div className="veil" role="status" data-testid="cake-render-wait">
                <span className="dots" aria-hidden="true"><i /><i /><i /></span>
                <b>Rendering your cake</b>
                <span>From this preview — about 15 seconds.</span>
              </div>
            )}
          </div>
          {pick !== null && !render.loading && <PickedTools k={k} picked={pick} setCake={setCake} onPick={setPicked} />}
        </>}
        <p className="note">{showRender ? "Your render — this picture, made into one photograph."
          : <>{["", "One tier", "Two tiers", "Three tiers"][k.tiers]}, {cakeStyle(k.style).name.toLowerCase()} · {CAKE_FLAVOURS.find((f) => f.id === k.flavour)?.name} inside.
            {(k.figures.length > 0 || topperShows(k)) && <> Drag the figures and the topper anywhere on the cake — tap one to copy, resize or remove it.</>}</>}</p>
        {backTo !== null && <button type="button" className="bz-tb-back" data-testid="cake-back-to-choices" onClick={back}>↑ Back to your choices</button>}
        {!render.ready && !render.loading && (
          <div className="bz-tb-render" data-testid="cake-render-box">
            <button type="button" className="bz-next" onClick={onGenerate}>{render.stale ? "Regenerate render ✨" : "Generate render ✨"}</button>
            <p className="hint">{render.stale ? "You changed the cake since your render." : "This preview made into one photo-real picture."} Needs a free account.</p>
            {render.error && <p className="error" role="alert">{render.error}</p>}
          </div>
        )}
        <RenderAgain render={render} onGenerate={onGenerate} testId="cake-render-again" />
      </> : <div className="empty">Add a cake to see it here.</div>}
    </div>
  );
}
