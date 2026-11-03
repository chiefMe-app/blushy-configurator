// The left-hand preview during the piñata part of Decor (2026-11-03, the owner: "askıda, parti odasında"): the
// piñata hung on its stand in a party room — a photo of the empty stand, the piñata's own photo on its hook (the
// fringe shape, or the age's white fringe digits coloured in her bands), its pull strings under it or the stick
// and blindfold by the stand. Then that picture rendered into one photograph (usePieceRender, /api/pinata-render).
import { useEffect, useState } from "react";
import { themeById, THEMES, type BuilderConfig } from "@/lib/config";
import { PINATA_FILLINGS, PINATA_ROOM, digitPicture, pinataSize, shapePicture, type Pinata } from "@/lib/studio/pinata";
import { usePhoneJump } from "@/components/builder/usePhoneJump";
import type { PieceRender } from "@/components/builder/usePieceRender";
import RenderAgain from "@/components/builder/RenderAgain";

/** The piñata on its own, `tall` high, its top centred on x, top: the shape's photo, or the digits in her bands. */
export function PinataPiece({ p, x, top, tall, uid, maxW = 380 }: { p: Pinata; x: number; top: number; tall: number; uid: string; maxW?: number }) {
  if (p.kind === "shape") {
    const pic = shapePicture(p.shape);
    const k = Math.min(tall / pic.h, maxW / pic.w);
    return <image data-part="pinata" href={pic.src} x={x - (pic.w * k) / 2} y={top} width={pic.w * k} height={pic.h * k} />;
  }
  const digits = p.number.split("").map(digitPicture);
  const gap = -tall * 0.04;
  const k0 = tall / Math.max(...digits.map((d) => d.h));
  const width = digits.reduce((s, d) => s + d.w * k0, 0) + gap * (digits.length - 1);
  const k = width > maxW ? (k0 * maxW) / width : k0;
  const w = width * (k / k0);
  let left = x - w / 2;
  const bands = p.colours.length ? p.colours : ["#FFFFFF"];
  return (
    <g data-part="pinata">
      {digits.map((d, i) => {
        const dw = d.w * k, dh = d.h * k, dx = left, dy = top + (tall * (k / k0) - dh);
        left += dw + gap * (k / k0);
        const id = `${uid}-d${i}`;
        return (
          <g key={i}>
            <defs><mask id={id} style={{ maskType: "alpha" }}><image href={d.src} x={dx} y={dy} width={dw} height={dh} /></mask></defs>
            <image href={d.src} x={dx} y={dy} width={dw} height={dh} />
            {/* Her colours in bands, top to bottom, under the white fringe's own light and shade. */}
            <g mask={`url(#${id})`} style={{ mixBlendMode: "multiply" }} data-part="pinata-colours">
              {bands.map((c, j) => <rect key={j} x={dx} y={dy + (dh * j) / bands.length} width={dw} height={dh / bands.length + 0.5} fill={c} />)}
            </g>
          </g>
        );
      })}
    </g>
  );
}

/** As wide as it may hang: inside the stand's legs. */
const ROOM_W = 350;

/** How tall the piñata hangs in the room, and where its top is: a wide shape is drawn less tall. */
function hung(p: Pinata) {
  const { hook, perCm } = PINATA_ROOM;
  const top = hook.y + 46;
  const tall = pinataSize(p.size).cm * perCm;
  let h = tall;
  if (p.kind === "shape") {
    const pic = shapePicture(p.shape);
    h = Math.min(tall, (ROOM_W / pic.w) * pic.h);
  }
  return { top, h };
}

/** The room, the stand, the piñata on its hook, and how it opens. */
export function PinataArt({ p, theme, className }: { p: Pinata; theme: { balloonColors: string[] }; className?: string }) {
  const { w: W, h: H, hook, floor, legs } = PINATA_ROOM;
  const { top, h } = hung(p);
  const bottom = top + h;
  const ribbons = Array.from(new Set([...(p.kind === "number" ? p.colours : []), ...theme.balloonColors])).filter((c) => c.toUpperCase() !== "#FFFFFF");
  const ribbon = (i: number) => ribbons.length ? ribbons[i % ribbons.length] : ["#F8BBD0", "#BAE6FD", "#FEF08A"][i % 3];
  return (
    <svg className={className} viewBox={`0 120 ${W} ${H - 120}`} role="img" aria-label="Your piñata on its stand" data-testid="pinata-art">
      <image href={PINATA_ROOM.src} x={0} y={0} width={W} height={H} />
      {/* The rope from the hook. */}
      <path d={`M ${hook.x} ${hook.y - 4} L ${hook.x} ${top + 8}`} stroke="#C9B79C" strokeWidth={3} strokeLinecap="round" />
      {p.opening === "pull" && (
        <g data-part="pinata-strings">
          {Array.from({ length: 9 }, (_, i) => {
            const x0 = hook.x - 44 + i * 11, len = 120 + ((i * 37) % 30);
            const sway = (i % 2 ? 1 : -1) * 6;
            return <path key={i} d={`M ${x0} ${bottom - 10} C ${x0 + sway} ${bottom + len * 0.35}, ${x0 - sway} ${bottom + len * 0.7}, ${x0 + sway / 2} ${bottom + len}`}
              stroke={ribbon(i)} strokeWidth={4.5} fill="none" strokeLinecap="round" />;
          })}
        </g>
      )}
      <PinataPiece p={p} x={hook.x} top={top} tall={h} maxW={ROOM_W} uid="pn-room" />
      {p.opening === "stick" && (
        <g data-part="pinata-stick">
          {/* A crepe-wrapped stick leaning on the stand's right leg, a satin blindfold on the floor by it. */}
          <defs>
            <pattern id="pn-wrap" patternUnits="userSpaceOnUse" width="22" height="22" patternTransform="rotate(35)">
              <rect width="22" height="22" fill={ribbon(0)} /><rect width="11" height="22" fill={ribbon(1)} />
            </pattern>
          </defs>
          <path d={`M ${legs[1] + 40} ${floor - 2} L ${legs[1] - 22} ${floor - 330}`} stroke="url(#pn-wrap)" strokeWidth={14} strokeLinecap="round" />
          <path d={`M ${legs[1] - 120} ${floor + 18} q 40 -16 86 -4 q 22 6 40 -2`} stroke="#6D28D9" strokeWidth={13} fill="none" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}

export default function PinataPreview({ config, render, onGenerate }: { config: BuilderConfig; render: PieceRender; onGenerate: () => void }) {
  const theme = themeById(config.theme) ?? THEMES[0];
  const p = config.pinata;
  const changeKey = p?.enabled ? JSON.stringify({ ...p, done: undefined, render: undefined }) : "";
  const { backTo, back } = usePhoneJump(changeKey, "pinata-preview-card");
  const [live, setLive] = useState(false);
  useEffect(() => { if (render.url) setLive(false); }, [render.url]);
  const showRender = !!render.url && !live;
  const art = p?.enabled ? <PinataArt p={p} theme={theme} className="bz-pn-art" /> : null;
  const inside = p ? PINATA_FILLINGS.filter((f) => p.fillings.includes(f.id)) : [];
  return (
    <div className="bz-tb-preview" data-testid="pinata-preview" id="pinata-preview-card">
      <div className="head">
        <span className="title">✦ Your piñata</span>
        {render.url && (
          <div className="views" role="tablist" aria-label="Piñata view">
            <button type="button" role="tab" aria-selected={!showRender} className={!showRender ? "on" : ""} onClick={() => setLive(true)}>Live</button>
            <button type="button" role="tab" aria-selected={showRender} className={showRender ? "on" : ""} onClick={() => setLive(false)}>Render</button>
          </div>
        )}
      </div>
      {p?.enabled ? <>
        {showRender ? <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="bz-tb-photo" data-testid="pinata-render" src={render.url!} alt="Your piñata, rendered" />
          {/* The live picture stays in the page, out of sight, for a new render of it to be taken from (Regenerate). */}
          <div className="bz-live-hidden" aria-hidden="true"><div className="bz-wb-wait">{art}</div></div>
        </> : (
          <div className={render.loading ? "bz-wb-wait on" : "bz-wb-wait"}>
            {art}
            {render.loading && (
              <div className="veil" role="status" data-testid="pinata-render-wait">
                <span className="dots" aria-hidden="true"><i /><i /><i /></span>
                <b>Rendering your piñata</b>
                <span>From this preview — about 15 seconds.</span>
              </div>
            )}
          </div>
        )}
        <p className="note">{showRender ? "Your render — this picture, made into one photograph."
          : <>{pinataSize(p.size).note}, hung on its stand. {inside.length ? <>Inside: {inside.map((f) => f.name).join(" · ")}</> : "Nothing inside yet — pick what goes in it."}</>}</p>
        {backTo !== null && <button type="button" className="bz-tb-back" data-testid="pinata-back-to-choices" onClick={back}>↑ Back to your choices</button>}
        {!render.ready && !render.loading && (
          <div className="bz-tb-render" data-testid="pinata-render-box">
            <button type="button" className="bz-next" onClick={onGenerate}>{render.stale ? "Regenerate render ✨" : "Generate render ✨"}</button>
            <p className="hint">{render.stale ? "You changed the piñata since your render." : "This preview made into one photo-real picture."} Needs a free account.</p>
            {render.error && <p className="error" role="alert">{render.error}</p>}
          </div>
        )}
        <RenderAgain render={render} onGenerate={onGenerate} testId="pinata-render-again" />
      </> : <div className="empty">Add a piñata to see it here.</div>}
    </div>
  );
}
