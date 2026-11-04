// The left-hand preview during the helium part of Decor (2026-11-04, the owner: "boş parti odası"; its wall white since
// her first look, the picture closed in on the balloons): the empty room photo with every balloon she picked in it (lib/studio/heliumLayout.ts) — the latex balloons and plain foils
// are white and silver photos coloured here, the theme foils their own printed photos, the age and the name drawn
// as puffy foil glyphs, the bubble drawn clear. Then that picture rendered into one photograph (usePieceRender,
// /api/helium-render).
import { useEffect, useState } from "react";
import type { BuilderConfig } from "@/lib/config";
import { HELIUM_ROOM, SILVER, heliumEmpty, heliumPicture, isPlainFoil, type Helium } from "@/lib/studio/helium";
import { heliumLayout } from "@/lib/studio/heliumLayout";
import { fontCss, tableFont } from "@/lib/studio/tableFonts";
import { usePhoneJump } from "@/components/builder/usePhoneJump";
import type { PieceRender } from "@/components/builder/usePieceRender";
import RenderAgain from "@/components/builder/RenderAgain";
import ZoomPhoto from "@/components/builder/ZoomPhoto";

// -- Colouring the white latex and the silver foils -----------------------------------------------------------------
// Once per picture and colour, on a canvas (an SVG filter per balloon made the page slow): the photo multiplied by the
// colour, its own outline kept. Until it is made the photo shows as it is.
const tinted = new Map<string, string>();
const making = new Map<string, Promise<void>>();
const TINT_TALL = 200;
const plainColour = (hex: string) => /^#F[0-9A-F]F[0-9A-F]F[0-9A-F]$/i.test(hex) || hex.toUpperCase() === SILVER;
function makeTint(src: string, hex: string): Promise<void> {
  const key = `${src}|${hex}`;
  if (tinted.has(key)) return Promise.resolve();
  if (!making.has(key)) making.set(key, (async () => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const h = Math.min(TINT_TALL, img.naturalHeight), w = Math.round((img.naturalWidth * h) / img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, w, h);
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(img, 0, 0, w, h);
    tinted.set(key, canvas.toDataURL("image/png"));
  })().catch(() => undefined));
  return making.get(key)!;
}
/** The pictures in their colours: a lookup that falls back to the photo while a colour is being made. */
function useTints(pairs: [string, string][]) {
  const [, redraw] = useState(0);
  const want = Array.from(new Set(pairs.filter(([, hex]) => !plainColour(hex)).map(([src, hex]) => `${src}|${hex}`)));
  const sig = want.join(",");
  useEffect(() => {
    let alive = true;
    const missing = want.filter((k) => !tinted.has(k));
    if (missing.length) void Promise.all(missing.map((k) => { const [src, hex] = k.split("|"); return makeTint(src, hex); })).then(() => { if (alive) redraw((x) => x + 1); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return (src: string, hex: string) => (plainColour(hex) ? src : tinted.get(`${src}|${hex}`) ?? src);
}

/** A foil's shine: lighter at the top, its colour, deeper below. */
function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)));
  return `#${ch.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
function FoilGradient({ id, hex }: { id: string; hex: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stopColor={shade(hex, 0.75)} /><stop offset="0.35" stopColor={shade(hex, 0.2)} />
      <stop offset="0.6" stopColor={hex} /><stop offset="0.85" stopColor={shade(hex, -0.35)} /><stop offset="1" stopColor={shade(hex, 0.1)} />
    </linearGradient>
  );
}

/** Puffy foil glyphs in a row: each letter its own balloon, a fat rounded stroke of the same foil, a light rim. */
function FoilGlyphs({ text, x, top, h, hex, uid, part }: { text: string; x: number; top: number; h: number; hex: string; uid: string; part: string }) {
  const face = tableFont("nunito");
  const step = h * 0.7;
  const left = x - (step * (text.length - 1)) / 2;
  const id = `${uid}-foil`;
  return (
    <g data-part={part}>
      <defs><FoilGradient id={id} hex={hex} /></defs>
      {text.split("").map((ch, i) => (
        <g key={i} data-part={`${part}-glyph`}>
          <text x={left + i * step} y={top + h * 0.86} textAnchor="middle" fontSize={h * 1.02} fill={`url(#${id})`} stroke={`url(#${id})`}
            strokeWidth={h * 0.13} strokeLinejoin="round" paintOrder="stroke" style={{ fontFamily: `${fontCss(face)}, sans-serif`, fontWeight: 900 }}>{ch}</text>
          <text x={left + i * step} y={top + h * 0.86} textAnchor="middle" fontSize={h * 1.02} fill="none" stroke="rgba(255,255,255,0.55)"
            strokeWidth={h * 0.02} style={{ fontFamily: `${fontCss(face)}, sans-serif`, fontWeight: 900 }}>{ch}</text>
        </g>
      ))}
    </g>
  );
}

/** A curling ribbon from (x0, y0) down to (x1, y1). */
const ribbon = (x0: number, y0: number, x1: number, y1: number, wave: number) =>
  `M ${x0} ${y0} C ${x0 + wave} ${y0 + (y1 - y0) * 0.33}, ${x1 - wave} ${y0 + (y1 - y0) * 0.66}, ${x1} ${y1}`;
const RIBBON = "#D6D3D1";

/** A small foil-wrapped balloon weight on the floor: a round pouch, its foil gathered and tied at the top, shining. */
function Weight({ x, y, hex, uid }: { x: number; y: number; hex: string; uid: string }) {
  const id = `${uid}-wt`;
  return (
    <g data-part="helium-weight">
      <defs>
        <radialGradient id={id} cx="0.35" cy="0.35" r="0.8">
          <stop offset="0" stopColor={shade(hex, 0.7)} /><stop offset="0.45" stopColor={hex} /><stop offset="1" stopColor={shade(hex, -0.4)} />
        </radialGradient>
      </defs>
      <ellipse cx={x + 3} cy={y + 1} rx={19} ry={4.5} fill="rgba(60,50,40,0.22)" />
      <path d={`M ${x - 14} ${y - 2} Q ${x - 17} ${y - 16} ${x - 5} ${y - 21} L ${x + 5} ${y - 21} Q ${x + 17} ${y - 16} ${x + 14} ${y - 2} Q ${x} ${y + 3} ${x - 14} ${y - 2} Z`} fill={`url(#${id})`} />
      <path d={`M ${x - 5} ${y - 21} L ${x - 8} ${y - 29} L ${x - 2} ${y - 25} L ${x} ${y - 31} L ${x + 2} ${y - 25} L ${x + 8} ${y - 29} L ${x + 5} ${y - 21} Z`} fill={shade(hex, 0.25)} />
      <rect x={x - 6} y={y - 23} width={12} height={3} rx={1.5} fill={shade(hex, -0.35)} />
      <path d={`M ${x - 9} ${y - 14} Q ${x - 7} ${y - 8} ${x - 3} ${y - 5}`} stroke="rgba(255,255,255,0.7)" strokeWidth={2} fill="none" strokeLinecap="round" />
    </g>
  );
}

/** The room and every balloon in it. */
export function HeliumArt({ h, className }: { h: Helium; className?: string }) {
  const { w: W, h: H } = HELIUM_ROOM;
  const L = heliumLayout(h);
  const view = L.view;
  const latex = [...L.bouquets.flatMap((b) => b.balloons), ...L.ceiling];
  const plainFoil = h.topper !== "none" && isPlainFoil(h.topper);
  const tint = useTints([
    ...latex.map((b) => [heliumPicture(b.pic).src, b.colour] as [string, string]),
    ...(plainFoil ? [[heliumPicture(h.topper).src, h.topperColour] as [string, string]] : []),
  ]);
  const balloon = (b: { pic: string; colour: string; x: number; y: number; w: number }, key: string | number) => {
    const pic = heliumPicture(b.pic);
    const bh = (pic.h / pic.w) * b.w;
    return <image key={key} data-part="helium-latex" href={tint(pic.src, b.colour)} x={b.x - b.w / 2} y={b.y - bh * 0.45} width={b.w} height={bh} />;
  };
  const knotY = (b: { pic: string; y: number; w: number }) => b.y + (heliumPicture(b.pic).h / heliumPicture(b.pic).w) * b.w * 0.53;
  return (
    <svg className={className} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} role="img" aria-label="Your helium balloons in the party room" data-testid="helium-art">
      <image href={HELIUM_ROOM.src} x={0} y={0} width={W} height={H} />

      {/* The ceiling's loose balloons, their ribbons hanging. */}
      {L.ceiling.length > 0 && (
        <g data-part="helium-ceiling">
          <g>{L.ceiling.map((b, i) => <path key={i} d={ribbon(b.x, knotY(b), b.x + (i % 2 ? 8 : -8), knotY(b) + b.ribbon, i % 2 ? 6 : -6)} stroke={RIBBON} strokeWidth={1.4} fill="none" />)}</g>
          {L.ceiling.map((b, i) => balloon(b, i))}
        </g>
      )}

      {/* The name on the wall. */}
      {L.letters && <FoilGlyphs text={h.letters.text} x={L.letters.x} top={L.letters.top} h={L.letters.h} hex={h.letters.colour} uid="hl-l" part="helium-letters" />}

      {/* The bouquets: ribbons to the weight, the foil on top, the latex balloons. */}
      {L.bouquets.map((q, i) => {
        const foilSrc = h.topper === "none" ? "" : tint(heliumPicture(h.topper).src, plainFoil ? h.topperColour : "#FFFFFF");
        return (
          <g key={i} data-part="helium-bouquet">
            {q.foil && <path d={ribbon(q.foil.x, q.foil.y + q.foil.h * 0.5, q.weight.x, q.weight.y - 22, 10)} stroke={RIBBON} strokeWidth={1.6} fill="none" />}
            {q.balloons.map((b, j) => <path key={j} d={ribbon(b.x, knotY(b), q.weight.x, q.weight.y - 22, (j % 2 ? 1 : -1) * 7)} stroke={RIBBON} strokeWidth={1.6} fill="none" />)}
            {q.foil && <image data-part="helium-foil" href={foilSrc} x={q.foil.x - q.foil.w / 2} y={q.foil.y - q.foil.h / 2} width={q.foil.w} height={q.foil.h} />}
            {q.balloons.map((b, j) => balloon(b, j))}
            <Weight x={q.weight.x} y={q.weight.y} hex={h.colours[0] ?? "#F8BBD0"} uid={`hl-q${i}`} />
          </g>
        );
      })}

      {/* The bubble, clear, on its ribbon, the name on it. */}
      {L.bubble && (() => {
        const { x, y, r, weight } = L.bubble;
        const inside = h.bubble.filling;
        const dots = Array.from({ length: inside === "mini" ? 9 : 26 }, (_, i) => {
          const a = i * 2.4, d = r * 0.78 * Math.sqrt(((i * 37) % 100) / 100);
          return { cx: x + Math.cos(a) * d, cy: y + Math.sin(a) * d };
        });
        const face = tableFont("birthstone-bounce");
        return (
          <g data-part="helium-bubble">
            <defs>
              <radialGradient id="hl-bubble" cx="0.38" cy="0.32" r="0.75">
                <stop offset="0" stopColor="rgba(255,255,255,0.6)" /><stop offset="0.7" stopColor="rgba(225,232,242,0.16)" /><stop offset="1" stopColor="rgba(170,182,200,0.45)" />
              </radialGradient>
            </defs>
            <path d={ribbon(x, y + r, weight.x, weight.y - 22, 8)} stroke={RIBBON} strokeWidth={1.6} fill="none" />
            {dots.map((d, i) => inside === "mini"
              ? <circle key={i} cx={d.cx} cy={d.cy} r={r * 0.17} fill={h.colours[i % h.colours.length] ?? "#F8BBD0"} stroke="rgba(0,0,0,0.08)" />
              : inside === "feathers"
                ? <ellipse key={i} cx={d.cx} cy={d.cy} rx={r * 0.13} ry={r * 0.04} transform={`rotate(${(i * 47) % 180} ${d.cx} ${d.cy})`} fill="#FFFFFF" stroke="rgba(0,0,0,0.12)" strokeWidth={0.6} />
                : <rect key={i} x={d.cx - 3} y={d.cy - 2} width={6} height={4} transform={`rotate(${(i * 53) % 180} ${d.cx} ${d.cy})`} fill={i % 3 ? "#D4AF37" : "#F3D98B"} />)}
            {/* On the white wall its edge shows by a faint grey rim, as a clear balloon's does in a photo. */}
            <circle cx={x} cy={y} r={r} fill="url(#hl-bubble)" stroke="rgba(130,142,160,0.55)" strokeWidth={2.5} />
            <circle cx={x} cy={y} r={r - 2} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth={1.5} />
            <ellipse cx={x - r * 0.35} cy={y - r * 0.45} rx={r * 0.22} ry={r * 0.1} transform={`rotate(-35 ${x - r * 0.35} ${y - r * 0.45})`} fill="rgba(255,255,255,0.8)" />
            <path d={`M ${x - 5} ${y + r - 1} L ${x + 5} ${y + r - 1} L ${x} ${y + r + 7} Z`} fill="rgba(255,255,255,0.85)" />
            {h.bubble.name && (
              <text x={x} y={y + r * 0.12} textAnchor="middle" fontSize={Math.min(r * 0.62, (r * 3.2) / Math.max(4, h.bubble.name.length))} fill={h.bubble.colour}
                stroke="rgba(0,0,0,0.12)" strokeWidth={0.6} paintOrder="stroke" style={{ fontFamily: `${fontCss(face)}, cursive`, fontWeight: face.weight }} data-part="helium-bubble-name">{h.bubble.name}</text>
            )}
            <Weight x={weight.x} y={weight.y} hex={h.colours[0] ?? "#F8BBD0"} uid="hl-b" />
          </g>
        );
      })()}

      {/* The age, standing on the floor. */}
      {L.number && (
        <g>
          <ellipse cx={L.number.x} cy={L.number.bottom - 2} rx={L.number.h * 0.32 * h.number.value.length} ry={8} fill="rgba(80,60,60,0.16)" />
          <FoilGlyphs text={h.number.value} x={L.number.x} top={L.number.bottom - L.number.h} h={L.number.h} hex={h.number.colour} uid="hl-n" part="helium-number" />
        </g>
      )}
    </svg>
  );
}

export default function HeliumPreview({ config, render, onGenerate }: { config: BuilderConfig; render: PieceRender; onGenerate: () => void }) {
  const h = config.helium;
  const changeKey = h?.enabled ? JSON.stringify({ ...h, done: undefined, render: undefined }) : "";
  const { backTo, back } = usePhoneJump(changeKey, "helium-preview-card");
  const [live, setLive] = useState(false);
  useEffect(() => { if (render.url) setLive(false); }, [render.url]);
  const showRender = !!render.url && !live;
  const empty = !h?.enabled || heliumEmpty(h);
  const art = h?.enabled ? <HeliumArt h={h} className="bz-hl-art" /> : null;
  return (
    <div className="bz-tb-preview" data-testid="helium-preview" id="helium-preview-card">
      <link rel="stylesheet" href="/fonts/typography/fonts.css" />
      <div className="head">
        <span className="title">✦ Your helium balloons</span>
        {render.url && (
          <div className="views" role="tablist" aria-label="Balloons view">
            <button type="button" role="tab" aria-selected={!showRender} className={!showRender ? "on" : ""} onClick={() => setLive(true)}>Design</button>
            <button type="button" role="tab" aria-selected={showRender} className={showRender ? "on" : ""} onClick={() => setLive(false)}>Real photo ✨</button>
          </div>
        )}
      </div>
      {h?.enabled ? <>
        {showRender ? <>
          <ZoomPhoto testId="helium-render" src={render.url!} alt="Your helium balloons, as a real photo" />
          {/* The live picture stays in the page, out of sight, for a new render of it to be taken from (Regenerate). */}
          <div className="bz-live-hidden" aria-hidden="true"><div className="bz-wb-wait">{art}</div></div>
        </> : (
          <div className={render.loading ? "bz-wb-wait on" : "bz-wb-wait"}>
            {art}
            {render.loading && (
              <div className="veil" role="status" data-testid="helium-render-wait">
                <span className="dots" aria-hidden="true"><i /><i /><i /></span>
                <b>Making a real photo of your balloons</b>
                <span>From this preview — about 25 seconds.</span>
              </div>
            )}
          </div>
        )}
        <p className="note">{showRender ? "Your real photo — this very design, made real." : empty ? "Pick some balloons to see them in the room." : "In an empty party room, to scale."}</p>
        {backTo !== null && <button type="button" className="bz-tb-back" data-testid="helium-back-to-choices" onClick={back}>↑ Back to your choices</button>}
        {!render.ready && !render.loading && !empty && (
          <div className="bz-tb-render" data-testid="helium-render-box">
            <button type="button" className="bz-next" onClick={onGenerate}>{render.stale ? "Make a new photo ✨" : "Make it a real photo ✨"}</button>
            <p className="hint">{render.stale ? "You changed the balloons since your render." : "This preview made into one photo-real picture."} Needs a free account.</p>
            {render.error && <p className="error" role="alert">{render.error}</p>}
          </div>
        )}
        <RenderAgain render={render} onGenerate={onGenerate} testId="helium-render-again" />
      </> : <div className="empty">Add helium balloons to see them here.</div>}
    </div>
  );
}
