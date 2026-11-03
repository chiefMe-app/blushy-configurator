// The left-hand preview during the cake part of Decor (2026-11-03, the owner: "pasta standında, yakın plan"): the
// cake on a white stand, close up — a photo of the empty stand, the cake's white tiers stacked on its plate, each
// in its own colour (multiplied over the tier's own light and shade), the sugar figures on top and the topper with
// the name and age. Then that picture rendered into one photograph (usePieceRender, /api/cake-render).
import { useEffect, useState } from "react";
import { type BuilderConfig } from "@/lib/config";
import {
  CAKE_FLAVOURS, CAKE_STAND, TIER_WIDTHS, cakeStyle, figurePicture, tierColours, tierPicture, topperColour, topperShows, type Cake,
} from "@/lib/studio/cake";
import { asPrinted, fontCss, tableFont } from "@/lib/studio/tableFonts";
import FitText from "@/components/studio/FitText";
import { usePhoneJump } from "@/components/builder/usePhoneJump";
import type { PieceRender } from "@/components/builder/usePieceRender";
import RenderAgain from "@/components/builder/RenderAgain";

const WHITE = "#FFFFFF";

/** Where everything goes, in the stand photo's pixels: the tiers bottom first, the figures, the topper's words. */
export function cakeLayout(k: Pick<Cake, "tiers" | "style" | "figures" | "topper">) {
  const { plate } = CAKE_STAND;
  const pic = tierPicture(k.style);
  const widths = TIER_WIDTHS[k.tiers];
  const k0 = widths[0] / pic.w;
  let plane = plate.y;
  const tiers = widths.map((w) => {
    // A smaller tier is drawn less short than its width says: a cake's tiers are about as tall as each other.
    const kx = w / pic.w, ky = Math.sqrt(kx * k0);
    const t = { x: plate.x - w / 2, y: plane - pic.bottom * ky, w, h: pic.h * ky };
    plane -= (pic.bottom - pic.top) * ky;
    return t;
  });
  const top = widths[widths.length - 1];
  // The figures stand on the top tier, in front; one is the biggest.
  const n = k.figures.length;
  // On a small top tier they keep a size of their own, standing to its edges.
  const ref = Math.max(top, 210);
  const tall = ref * [0, 0.62, 0.5, 0.44][n];
  const room = ref * [0, 0.62, 0.5, 0.4][n];
  const at = [[], [0], [-0.24, 0.24], [-0.3, 0, 0.3]][n];
  const figures = k.figures.map((id, i) => {
    const f = figurePicture(id);
    const s = Math.min(tall / f.h, room / f.w) * (n === 3 && i === 1 ? 1.1 : 1);
    const base = plane + top * (n === 3 && i === 1 ? 0.05 : 0.03);
    return { id, src: f.src, x: plate.x + at[i] * (top + ref) / 2 - (f.w * s) / 2, y: base - f.h * s, w: f.w * s, h: f.h * s };
  });
  // The topper's words above the figures, on two sticks down into the cake.
  const tw = Math.min(240, Math.max(150, top * 1.15));
  const lift = n ? Math.max(...figures.map((f) => plane - f.y)) + 8 : tw * 0.22;
  const face = tableFont(k.topper.font);
  const age = tw * 0.46, name = tw * 0.24 * (face.hand ? face.scale : 1);
  const bottom = plane - lift;
  // The age's line at the bottom, the name's over it; a script's tall letters reach higher.
  const nameY = k.topper.age ? bottom - age * 0.82 : bottom;
  const words = { x: plate.x, bottom, w: tw, name, age, nameY, plane };
  const shows = topperShows(k);
  const textTop = !shows ? plane : k.topper.name.trim() ? nameY - name * (face.hand ? 0.95 : 0.8) : bottom - age * 0.75;
  const contentTop = Math.min(textTop, ...figures.map((f) => f.y), tiers[tiers.length - 1].y);
  return { tiers, figures, words, plane, contentTop, pic };
}

/** The cake on its own, drawn in the stand photo's pixels (wrap it in a viewBox). */
export function CakePiece({ k, uid }: { k: Cake; uid: string }) {
  const L = cakeLayout(k);
  const colours = tierColours(k);
  const tc = topperColour(k.topper.colour);
  const face = tableFont(k.topper.font);
  const family = `${fontCss(face)}, Georgia, serif`;
  const name = asPrinted(k.topper.name.trim(), face);
  const { words } = L;
  const ageY = words.bottom, nameY = words.nameY;
  const paint = `url(#${uid}-gold)`;
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
      {topperShows(k) && (
        <g data-part="cake-topper">
          {[-0.17, 0.17].map((dx) => (
            <path key={dx} d={`M ${words.x + dx * words.w} ${ageY - words.age * 0.1} L ${words.x + dx * words.w * 0.9} ${words.plane + 6}`} stroke={paint} strokeWidth={4} strokeLinecap="round" />
          ))}
          {name && <FitText x={words.x} y={nameY} fontSize={words.name} maxWidth={words.w} textAnchor="middle" fill={paint}
            stroke={tc.hex} strokeWidth={words.name * 0.03} paintOrder="stroke" style={{ fontFamily: family, fontWeight: face.weight }}>{name}</FitText>}
          {k.topper.age && <FitText x={words.x} y={ageY} fontSize={words.age} maxWidth={words.w * 0.8} textAnchor="middle" fill={paint}
            stroke={tc.hex} strokeWidth={words.age * 0.02} paintOrder="stroke" style={{ fontFamily: family, fontWeight: face.weight }}>{k.topper.age}</FitText>}
        </g>
      )}
      {L.figures.map((f, i) => <image key={i} data-part="cake-figure" href={f.src} x={f.x} y={f.y} width={f.w} height={f.h} />)}
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

/** The stand, close up, with the cake on it. */
export function CakeArt({ k, className }: { k: Cake; className?: string }) {
  const { w: W, h: H } = CAKE_STAND;
  const L = cakeLayout(k);
  const { bottom } = CAKE_STAND;
  const top = Math.max(0, L.contentTop - 50);
  const h = bottom - top;
  const w = Math.min(W, h * 0.8);
  const x0 = Math.max(0, Math.min(W - w, CAKE_STAND.plate.x - w / 2));
  return (
    <svg className={className} viewBox={`${x0} ${top} ${w} ${h}`} role="img" aria-label="Your cake on its stand" data-testid="cake-art">
      <image href={CAKE_STAND.src} x={0} y={0} width={W} height={H} />
      <CakePiece k={k} uid="ck-stand" />
    </svg>
  );
}

export default function CakePreview({ config, render, onGenerate }: { config: BuilderConfig; render: PieceRender; onGenerate: () => void }) {
  const k = config.cake;
  const changeKey = k?.enabled ? JSON.stringify({ ...k, done: undefined, render: undefined }) : "";
  const { backTo, back } = usePhoneJump(changeKey, "cake-preview-card");
  const [live, setLive] = useState(false);
  useEffect(() => { if (render.url) setLive(false); }, [render.url]);
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
        ) : (
          <div className={render.loading ? "bz-wb-wait on" : "bz-wb-wait"}>
            <CakeArt k={k} className="bz-ck-art" />
            {render.loading && (
              <div className="veil" role="status" data-testid="cake-render-wait">
                <span className="dots" aria-hidden="true"><i /><i /><i /></span>
                <b>Rendering your cake</b>
                <span>From this preview — about 15 seconds.</span>
              </div>
            )}
          </div>
        )}
        <p className="note">{showRender ? "Your render — this picture, made into one photograph."
          : <>{["", "One tier", "Two tiers", "Three tiers"][k.tiers]}, {cakeStyle(k.style).name.toLowerCase()} · {CAKE_FLAVOURS.find((f) => f.id === k.flavour)?.name} inside.</>}</p>
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
