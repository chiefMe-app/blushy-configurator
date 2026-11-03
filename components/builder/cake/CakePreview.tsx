// The left-hand preview during the cake part of Decor (2026-11-03, the owner: "pasta standında, yakın plan"): the
// cake on a white stand, close up — a photo of the empty stand, the cake's white tiers stacked on its plate, each
// in its own colour (multiplied over the tier's own light and shade), the sugar figures and the topper with the
// name and age. Every figure and the topper is hers to drag anywhere on the cake, and a figure to copy, resize or
// take off (2026-11-03, the owner: "sürükle bırak … duplicate … her yere yapıştırabilsin"). Then that picture
// rendered into one photograph (usePieceRender, /api/cake-render).
import { useEffect, useRef, useState } from "react";
import { type BuilderConfig } from "@/lib/config";
import {
  CAKE_FIGURES, CAKE_FLAVOURS, CAKE_STAND, MAX_CAKE_FIGURES, TIER_WIDTHS, cakeStack, cakeStyle, figurePicture, itemAt, placeItem,
  tierColours, topperColour, topperShows, type Cake,
} from "@/lib/studio/cake";
import { asPrinted, fontCss, tableFont } from "@/lib/studio/tableFonts";
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
  // The topper's words over what stands on the top (unless she moved it), on two sticks down into the cake.
  const tw = Math.min(240, Math.max(150, st.topW * 1.15)) * (k.topper.s ?? 1);
  const onTop = figures.filter((_, i) => k.figures[i].on === "top");
  const lift = k.topper.up ?? (onTop.length ? Math.max(...onTop.map((f) => st.top - f.y)) + 8 : tw * 0.22);
  const face = tableFont(k.topper.font);
  const age = tw * 0.46, name = tw * 0.24 * (face.hand ? face.scale : 1);
  const bottom = st.top - lift;
  // The age's line at the bottom, the name's over it; a script's tall letters reach higher.
  const nameY = k.topper.age ? bottom - age * 0.82 : bottom;
  const x = plate.x + (k.topper.x ?? 0) * st.topW;
  const words = { x, bottom, w: tw, name, age, nameY, plane: st.top, stickX: plate.x + (k.topper.x ?? 0) * st.topW * 0.9 };
  const shows = topperShows(k);
  const textTop = k.topper.name.trim() ? nameY - name * (face.hand ? 0.95 : 0.8) : bottom - age * 0.75;
  // Its box, to take hold of it.
  const topperBox = shows ? { x: x - tw / 2, y: textTop, w: tw, h: bottom - textTop + age * 0.12 } : null;
  const contentTop = Math.min(shows ? textTop : st.top, ...figures.map((f) => f.y), st.tiers[st.tiers.length - 1].y);
  return { st, tiers: st.tiers, figures, words, topperBox, contentTop, pic: st.pic };
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
            {/* Its colour under the tier's own light and shade. */}
            {colours[i].toUpperCase() !== WHITE && (
              <rect mask={`url(#${id})`} style={{ mixBlendMode: "multiply" }} x={t.x} y={t.y} width={t.w} height={t.h} fill={colours[i]} data-part="cake-colour" />
            )}
          </g>
        );
      })}
      {L.topperBox && (
        <g data-part="cake-topper" style={held} onPointerDown={grab ? (e) => grab(e, "topper") : undefined}>
          {[-0.17, 0.17].map((dx) => (
            <path key={dx} d={`M ${words.x + dx * words.w} ${ageY - words.age * 0.1} L ${words.stickX + dx * words.w * 0.9} ${words.plane + 6}`} stroke={paint} strokeWidth={4} strokeLinecap="round" />
          ))}
          {/* Something to take hold of between the letters. */}
          {grab && <rect {...L.topperBox} fill="transparent" />}
          {name && <FitText x={words.x} y={nameY} fontSize={words.name} maxWidth={words.w} textAnchor="middle" fill={paint}
            stroke={tc.hex} strokeWidth={words.name * 0.03} paintOrder="stroke" style={{ fontFamily: family, fontWeight: face.weight }}>{name}</FitText>}
          {k.topper.age && <FitText x={words.x} y={ageY} fontSize={words.age} maxWidth={words.w * 0.8} textAnchor="middle" fill={paint}
            stroke={tc.hex} strokeWidth={words.age * 0.02} paintOrder="stroke" style={{ fontFamily: family, fontWeight: face.weight }}>{k.topper.age}</FitText>}
        </g>
      )}
      {L.figures.map((f, i) => (
        <image key={i} data-part="cake-figure" data-on={k.figures[i].on} href={f.src} x={f.x} y={f.y} width={f.w} height={f.h}
          style={held} onPointerDown={grab ? (e) => grab(e, i) : undefined} />
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

/** The view of the stand around a cake: close up, as tall as the cake and its topper need. */
function viewOf(k: Cake) {
  const { w: W, bottom } = CAKE_STAND;
  const top = Math.max(0, cakeLayout(k).contentTop - 50);
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

/** The cake with what she holds moved so its middle is at (cx, cy). */
function moved(k: Cake, what: CakePick, cx: number, cy: number): Cake {
  const st = cakeStack(k);
  if (what !== "topper") return { ...k, figures: k.figures.map((it, i) => (i === what ? itemAt(it, st, cx, cy) : it)) };
  const L = cakeLayout(k);
  const box = L.topperBox!;
  // Its words' line, the box's middle moved there.
  const bottom = cy + box.h / 2 - L.words.age * 0.12;
  return { ...k, topper: { ...k.topper, x: clamp((cx - CAKE_STAND.plate.x) / st.topW, -0.4, 0.4), up: clamp(st.top - bottom, 0, 380) } };
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
  const shown = drag ? moved(k, drag.what, drag.mid.x + drag.at.x - drag.from.x, drag.mid.y + drag.at.y - drag.from.y) : k;
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
    return (
      <div className="bz-ck-tools" role="toolbar" aria-label="The topper" data-testid="cake-tools">
        <b>Topper</b>
        <button type="button" onClick={() => setTopper({ s: clamp(s * 1.12, 0.6, 1.6) })} disabled={s >= 1.6}>Bigger</button>
        <button type="button" onClick={() => setTopper({ s: clamp(s / 1.12, 0.6, 1.6) })} disabled={s <= 0.6}>Smaller</button>
        <button type="button" onClick={() => setTopper({ x: undefined, up: undefined, s: undefined })}>Put back</button>
        <button type="button" className="off" onClick={() => { setTopper({ on: false }); onPick(null); }}>Remove</button>
        <button type="button" className="done" aria-label="Done" onClick={() => onPick(null)}>✓</button>
      </div>
    );
  }
  const it = k.figures[picked];
  if (!it) return null;
  const name = CAKE_FIGURES.find((f) => f.id === it.id)?.name;
  const set = (figures: Cake["figures"], next: CakePick | null = picked) => { setCake({ ...k, figures }); onPick(next); };
  const full = k.figures.length >= MAX_CAKE_FIGURES;
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
      <button type="button" onClick={copy} disabled={full} title={full ? `Up to ${MAX_CAKE_FIGURES} figures` : undefined}>Copy</button>
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
  const changeKey = k?.enabled ? JSON.stringify({ ...k, figures: k.figures.map((f) => f.id), topper: { ...k.topper, x: undefined, up: undefined, s: undefined }, done: undefined, render: undefined }) : "";
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
