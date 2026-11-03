// The left-hand preview during the giveaways part of Decor (2026-11-03, the owner: "tabledaysa bir önceki aşamada
// seçim yaptığı table da görelim yada boardda görelim … onları da render alıp sonra gene preview'a koymamız
// lazım"): the boxes where they go — at the place on the kids' table she set (its One place view, a box lying at
// the top of the placemat), or on the shelves of the arch board in her colour, the name on it in vinyl. Then that
// picture rendered into one photograph (the builder's usePieceRender, /api/giveaway-render), which finalizing the
// giveaways waits for.
import { useEffect, useState } from "react";
import { themeById, THEMES, type BuilderConfig } from "@/lib/config";
import { BOARD_PHOTO, BOARD_SHOWS, BOX_PHOTO, GIVEAWAY_CONTENTS, boardOutline, type Giveaways } from "@/lib/studio/giveaways";
import PIECES from "@/lib/studio/welcomePieces.json";
import { setShot, useRecoloredBase } from "@/components/design/LiveSketch";
import { fontCss, tableFont } from "@/lib/studio/tableFonts";
import TablePlace from "@/components/studio/table/TablePlace";
import GiveawayBox, { type BoxLook } from "@/components/studio/GiveawayBox";
import { THEME_GROUPS } from "@/components/builder/constants";
import { usePhoneJump } from "@/components/builder/usePhoneJump";
import type { PieceRender } from "@/components/builder/usePieceRender";

/** The box's look in a theme: its placemat print and its picture (the theme list's crayon icon). */
export function boxLook(g: Giveaways, theme: { id: string; accent: string }): BoxLook {
  const icon = THEME_GROUPS.flatMap((gr) => gr.items).find((i) => i.id === theme.id)?.icon ?? "unicorn";
  return { print: `/design/table/placemats/${theme.id}/pattern.webp`, sticker: `/design/themes-v2/${icon}.webp`, accent: theme.accent, name: g.name, age: g.age, font: g.font };
}

/** The shelved board, its boxes on the shelves, the name on its arch and, if she wants one, a balloon garland. */
export function GiveawayBoardArt({ g, theme, balloons, className }: { g: Giveaways; theme: { id: string; accent: string; balloonColors?: string[] }; balloons?: string[]; className?: string }) {
  const look = boxLook(g, theme);
  const { w: W, h: H, board, shelves, boxH } = BOARD_PHOTO;
  // The garland (2026-11-03, the owner: "balon garland opsiyonu olsun"): the welcome board's — the backdrop's own
  // Single Arch set photo, repainted to the party's balloons — from the floor up the board's right edge and over
  // its top; the words move left, clear of it.
  const palette = balloons?.length ? balloons : theme.balloonColors ?? [];
  const shot = setShot(theme.id, palette);
  const gName = `garland-${shot.folder}` as keyof typeof PIECES;
  const gp = PIECES[gName] as { w: number; h: number; edge: number };
  const gSrc = useRecoloredBase(g.boardGarland ? `/design/welcome/pieces/${gName}.webp` : null, `/design/welcome/pieces/${gName}-families.png`, palette, shot.asShot, 50);
  // The board is tall and narrow: drawn at its height the garland's arch would cover the whole top. So it is drawn
  // smaller, its arch over the board's top right shoulder, and again below it for the rest of its column down to
  // the floor — the first without its foot, the second only its column and foot.
  const gW = 380, gH = (gW * gp.h) / gp.w, gX = board.x1 - gW * gp.edge, gTop = 70;
  const floorY = board.bottom + 6, gTop2 = floorY - gH;
  // The upper one fades out over its last stretch of column, over the lower one's (below its own arch).
  const fadeTo = gTop + gH * 0.82, fadeFrom = fadeTo - 60, cutB = gTop2 + gH * 0.25;
  // Up there the arch curves in: the words kept a little inside its left edge, and clear of the balloons.
  const wordsX0 = board.x0 + (board.x1 - board.x0) * 0.07;
  const words = g.boardGarland ? { ...BOARD_PHOTO.words, cx: (wordsX0 + gX) / 2 + 6, w: gX - wordsX0 - 40 } : BOARD_PHOTO.words;
  const boxW = (boxH * BOX_PHOTO.w) / BOX_PHOTO.h;
  const shown = Math.min(g.count, BOARD_SHOWS);
  const span = board.x1 - board.x0;
  const white = g.boardColour.toUpperCase() === "#FFFFFF";
  const face = tableFont(g.boardFont);
  const name = g.name.trim();
  // A handwritten face draws small for its size: its own scale, as the box's plate (GiveawayBox).
  const line = g.boardLine.trim().toUpperCase();
  const lineBox = g.boardGarland ? { cx: (board.x0 + board.x1 - 70) / 2, w: board.x1 - 70 - board.x0 - 30 } : { cx: words.cx, w: words.w };
  const lineSize = Math.min(24, lineBox.w / Math.max(6, line.length * 0.78));
  // As wide as the space lets it, and clear of the line under it (a script's tails hang below the line it sits on).
  const byWidth = (words.w / Math.max(2.6, name.length * 0.52)) * (face.hand ? face.scale ?? 1 : 0.8);
  const nameSize = Math.min(byWidth, (words.bottom - 8 - lineSize - 6 - words.top) / (face.hand ? 1.15 : 0.95));
  // Her colour, or: the darker the board, the lighter the words.
  const ink = g.boardInk || (isDark(g.boardColour) ? "#FFFFFF" : theme.accent);
  return (
    <svg className={className} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Your giveaway board" data-testid="giveaway-board-art" data-garland={g.boardGarland ? "yes" : "no"}>
      <defs>
        <filter id="gvb-wall" x="-20%" y="-10%" width="140%" height="120%"><feDropShadow dx={8} dy={6} stdDeviation={9} floodColor="#4a3328" floodOpacity={0.22} /></filter>
      </defs>
      <image href={BOARD_PHOTO.src} width={W} height={H} />
      {/* The board's colour, over its photographed light and shade. */}
      {!white && <path d={boardOutline()} fill={g.boardColour} style={{ mixBlendMode: "multiply" }} data-part="board-colour" />}
      {/* Her words on the arch, flat cut vinyl. */}
      {name && <text x={words.cx} y={words.top + nameSize * 0.8} fontSize={nameSize} textAnchor="middle" fill={ink}
        style={{ fontFamily: `${fontCss(face)}, Georgia, serif`, fontWeight: face.weight }}>{face.hand ? name : name.toUpperCase()}</text>}
      {line && <text x={lineBox.cx} y={words.bottom - 8} fontSize={lineSize} textAnchor="middle" fill={ink} letterSpacing={lineSize * 0.08}
        style={{ fontFamily: "var(--font-sans), Arial, sans-serif", fontWeight: 600 }}>{line}</text>}
      {/* Three boxes to a shelf, top shelf first. */}
      {Array.from({ length: shown }, (_, i) => {
        const shelf = Math.floor(i / 3), col = i % 3;
        const x = board.x0 + span * ((col + 0.5) / 3);
        return <GiveawayBox key={i} look={look} x={x} y={shelves[shelf] - boxH / 2 + 2} h={boxH} uid={`gvb-${i}`} />;
      })}
      {g.boardGarland && gSrc && (
        <g data-part="garland" data-set={shot.folder} filter="url(#gvb-wall)">
          <clipPath id="gvb-col"><rect x={gX - 10} y={cutB} width={gW + 20} height={floorY + 20 - cutB} /></clipPath>
          <linearGradient id="gvb-fade" gradientUnits="userSpaceOnUse" x1="0" y1={fadeFrom} x2="0" y2={fadeTo}><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#000" /></linearGradient>
          <mask id="gvb-arch" maskUnits="userSpaceOnUse" x={gX - 10} y={gTop - 10} width={gW + 20} height={fadeTo - gTop + 10}>
            <rect x={gX - 10} y={gTop - 10} width={gW + 20} height={fadeTo - gTop + 10} fill="url(#gvb-fade)" />
          </mask>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <image href={gSrc} x={gX} y={gTop2} width={gW} height={gH} clipPath="url(#gvb-col)" />
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <image href={gSrc} x={gX} y={gTop} width={gW} height={gH} mask="url(#gvb-arch)" />
        </g>
      )}
    </svg>
  );
}

function isDark(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 140;
}

/**
 * One box, close up (2026-11-03, the owner: "giveaway box'ı yakından görmemiz lazım, render'ın üstünde yeni bir
 * kart yapalım preview için"): the box as it is printed, and what goes in it.
 */
export function GiveawayBoxCard({ g, theme }: { g: Giveaways; theme: { id: string; accent: string } }) {
  const inside = GIVEAWAY_CONTENTS.filter((c) => g.contents.includes(c.id));
  return (
    <div className="bz-tb-preview bz-gv-close" data-testid="giveaway-box-card">
      <div className="head"><span className="title">✦ Your box, close up</span></div>
      <svg className="bz-gv-box" viewBox="0 0 120 150" role="img" aria-label="Your giveaway box, close up">
        <GiveawayBox look={boxLook(g, theme)} x={60} y={75} h={146} uid="gv-close" />
      </svg>
      <p className="note">{inside.length ? <>Inside: {inside.map((c) => c.name).join(" · ")}</> : "Nothing inside yet — pick what goes in it."}</p>
    </div>
  );
}

export default function GiveawaysPreview({ config, render, onGenerate }: { config: BuilderConfig; render: PieceRender; onGenerate: () => void }) {
  const theme = themeById(config.theme) ?? THEMES[0];
  const g = config.giveaways;
  const changeKey = g?.enabled ? JSON.stringify({ ...g, done: undefined, render: undefined }) : "";
  const { backTo, back } = usePhoneJump(changeKey, "giveaways-preview-card");
  const [live, setLive] = useState(false);
  useEffect(() => { if (render.url) setLive(false); }, [render.url]);
  const showRender = !!render.url && !live;
  const onTable = g?.place === "table" && !!config.table?.enabled;
  return (<>
    {g?.enabled && <><link rel="stylesheet" href="/fonts/typography/fonts.css" /><GiveawayBoxCard g={g} theme={theme} /></>}
    <div className="bz-tb-preview" data-testid="giveaways-preview" id="giveaways-preview-card">
      <div className="head">
        <span className="title">✦ Your giveaways</span>
        {render.url && (
          <div className="views" role="tablist" aria-label="Giveaways view">
            <button type="button" role="tab" aria-selected={!showRender} className={!showRender ? "on" : ""} onClick={() => setLive(true)}>Live</button>
            <button type="button" role="tab" aria-selected={showRender} className={showRender ? "on" : ""} onClick={() => setLive(false)}>Render</button>
          </div>
        )}
      </div>
      {g?.enabled ? <>
        <link rel="stylesheet" href="/fonts/typography/fonts.css" />
        {showRender ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="bz-tb-photo" data-testid="giveaways-render" src={render.url!} alt="Your giveaways, rendered" />
        ) : (
          <div className={render.loading ? "bz-wb-wait on" : "bz-wb-wait"}>
            {onTable
              ? <TablePlace table={config.table!} theme={theme} className="bz-tb-place bz-gv-art"
                  atPlace={(id) => <GiveawayBox look={boxLook(g, theme)} x={5} y={-17.5} h={10.5} rot={-6} uid={`gvt-${id}`} />} />
              : <GiveawayBoardArt g={g} theme={theme} balloons={config.decor.balloonColors} className="bz-gv-art bz-gv-board" />}
            {render.loading && (
              <div className="veil" role="status" data-testid="giveaways-render-wait">
                <span className="dots" aria-hidden="true"><i /><i /><i /></span>
                <b>Rendering your giveaways</b>
                <span>From this preview — about 15 seconds.</span>
              </div>
            )}
          </div>
        )}
        <p className="note">{showRender ? "Your render — this picture, made into one photograph."
          : onTable ? `One box at each place — ${g.count} in all. What's inside is listed under the choices.`
          : `Your board — ${Math.min(g.count, BOARD_SHOWS)} of your ${g.count} boxes on its shelves.`}</p>
        {backTo !== null && <button type="button" className="bz-tb-back" data-testid="giveaways-back-to-choices" onClick={back}>↑ Back to your choices</button>}
        {!render.ready && !render.loading && (
          <div className="bz-tb-render" data-testid="giveaways-render-box">
            <button type="button" className="bz-next" onClick={onGenerate}>{render.stale ? "Regenerate render ✨" : "Generate render ✨"}</button>
            <p className="hint">{render.stale ? "You changed the giveaways since your render." : "This preview made into one photo-real picture."} Needs a free account.</p>
            {render.error && <p className="error" role="alert">{render.error}</p>}
          </div>
        )}
      </> : <div className="empty">Add giveaways to see them here.</div>}
    </div>
  </>);
}
