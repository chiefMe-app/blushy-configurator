// The left-hand preview during the giveaways part of Decor (2026-11-03, the owner: "tabledaysa bir önceki aşamada
// seçim yaptığı table da görelim yada boardda görelim … onları da render alıp sonra gene preview'a koymamız
// lazım"): the boxes where they go — at the place on the kids' table she set (its One place view, a box lying at
// the top of the placemat), or on the shelves of the arch board in her colour, the name on it in vinyl. Then that
// picture rendered into one photograph (the builder's usePieceRender, /api/giveaway-render), which finalizing the
// giveaways waits for.
import { useEffect, useState } from "react";
import { themeById, THEMES, type BuilderConfig } from "@/lib/config";
import { BOARD_PHOTO, BOARD_SHOWS, GIVEAWAY_CONTENTS, boardOutline, shelfCounts, type Giveaways } from "@/lib/studio/giveaways";
import COLUMNS from "@/lib/studio/giveawayGarland.json";
import { setShot, useRecoloredBase } from "@/components/design/LiveSketch";
import { fontCss, tableFont } from "@/lib/studio/tableFonts";
import TablePlace from "@/components/studio/table/TablePlace";
import GiveawayBox, { boxLines, type BoxLook } from "@/components/studio/GiveawayBox";
import FitText from "@/components/studio/FitText";
import { THEME_GROUPS } from "@/components/builder/constants";
import { usePhoneJump } from "@/components/builder/usePhoneJump";
import type { PieceRender } from "@/components/builder/usePieceRender";
import RenderAgain from "@/components/builder/RenderAgain";

/** The box's look in a theme: its placemat print and its picture (the theme list's crayon icon). */
export function boxLook(g: Giveaways, theme: { id: string; accent: string }): BoxLook {
  const icon = THEME_GROUPS.flatMap((gr) => gr.items).find((i) => i.id === theme.id)?.icon ?? "unicorn";
  const plain = g.boxPrint === "plain";
  // On a dark plain box, white words unless she picks a colour.
  const ink = g.ink || (plain && isDark(g.boxColour) ? "#FFFFFF" : theme.accent);
  return { print: plain ? undefined : `/design/table/placemats/${theme.id}/${g.boxPrint ?? "pattern"}.webp`, colour: g.boxColour ?? "#FFFFFF", sticker: `/design/themes-v2/${icon}.webp`, accent: ink, name: g.name, font: g.font };
}

/** The shelved board, its boxes on the shelves, the name on its arch and, if she wants one, a balloon garland. */
export function GiveawayBoardArt({ g, theme, balloons, className }: { g: Giveaways; theme: { id: string; accent: string; balloonColors?: string[] }; balloons?: string[]; className?: string }) {
  const look = boxLook(g, theme);
  const { w: W, h: H, board, shelves, boxH, words } = BOARD_PHOTO;
  const face = tableFont(g.boardFont), lineFace = tableFont(g.boardLineFont);
  const name = g.name.trim();
  const line = g.boardLine.trim() ? (lineFace.hand ? g.boardLine.trim() : g.boardLine.trim().toUpperCase()) : "";
  // The garland (2026-11-03, the owner: "balon garland opsiyonu olsun"; later: "üste doğru ilerlemesin, thank you
  // for coming'in hizasında bitsin"): a column of balloons on the floor beside the board's right edge, its top
  // level with the line — a photo of the balloon set's column, ending in whole balloons
  // (scripts/giveaways/garland-column.ts), repainted to the party's balloons.
  const palette = balloons?.length ? balloons : theme.balloonColors ?? [];
  const shot = setShot(theme.id, palette);
  const gName = `garland-${shot.folder}` as keyof typeof COLUMNS;
  const gp = COLUMNS[gName] ?? COLUMNS["garland-unicorn-pastel"];
  const gSrc = useRecoloredBase(g.boardGarland ? `/design/giveaways/${gName}-column.webp` : null, `/design/giveaways/${gName}-column-families.png`, palette, shot.asShot, 50);
  const lineSize0 = 24;
  const floorY = board.bottom + 6, gTop = words.bottom - 8 - lineSize0 - 4;
  const gH = floorY - gTop, gW = (gH * gp.w) / gp.h;
  // A fifth of it over the board's edge, hugging it.
  const gX = board.x1 - gW * 0.2;
  // The boxes and the line keep clear of it.
  const right = g.boardGarland ? Math.min(board.x1, gX + 6) : board.x1;
  const span = right - board.x0;
  const lineBox = { cx: (board.x0 + right) / 2 + (g.boardGarland ? 4 : 0), w: span - 40 };
  const perChar = (f: typeof face) => (f.hand ? 0.36 / (f.scale ?? 1) : f.id === "archivo-black" ? 0.86 : 0.74);
  const lineSize = Math.min(lineSize0 * (lineFace.hand ? lineFace.scale ?? 1 : 1), lineBox.w / (Math.max(6, line.length) * perChar(lineFace)));
  // The name as wide as the arch lets it, a long one on two lines as on the box, and clear of the line under it
  // (a script's tails hang below its line).
  const nameLines = boxLines(face.hand ? name : name.toUpperCase());
  const longest = Math.max(2.6, ...nameLines.map((l) => l.length * 0.52));
  const byWidth = (words.w / longest) * (face.hand ? face.scale ?? 1 : 0.8);
  const nameRoom = words.bottom - 8 - lineSize0 - 6 - words.top;
  const nameGap = face.hand ? 0.82 : 1.0;
  const nameSize = Math.min(byWidth, nameRoom / ((face.hand ? 1.15 : 0.95) + (nameLines.length - 1) * nameGap));
  // Her colour, or: the darker the board, the lighter the words.
  const ink = g.boardInk || (isDark(g.boardColour) ? "#FFFFFF" : theme.accent);
  const white = g.boardColour.toUpperCase() === "#FFFFFF";
  // Three to a shelf, never one on its own (shelfCounts), spread along it.
  const rows = shelfCounts(g.count);
  // The board's width at a height: its top is a half circle.
  const archWidth = (y: number) => {
    const r = (board.x1 - board.x0) / 2, dy = board.top + r - y;
    return dy <= 0 ? 2 * r : 2 * Math.sqrt(Math.max(0, r * r - dy * dy));
  };
  return (
    <svg className={className} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Your giveaway board" data-testid="giveaway-board-art" data-garland={g.boardGarland ? "yes" : "no"}>
      <defs>
        <filter id="gvb-wall" x="-20%" y="-10%" width="140%" height="120%"><feDropShadow dx={8} dy={6} stdDeviation={9} floodColor="#4a3328" floodOpacity={0.22} /></filter>
      </defs>
      <image href={BOARD_PHOTO.src} width={W} height={H} />
      {/* The board's colour, over its photographed light and shade. */}
      {!white && <path d={boardOutline()} fill={g.boardColour} style={{ mixBlendMode: "multiply" }} data-part="board-colour" />}
      {/* Her words on the arch, flat cut vinyl. */}
      {nameLines.map((l, i) => {
        const y = words.top + nameSize * 0.8 + i * nameSize * nameGap;
        return <FitText key={i} x={words.cx} y={y} fontSize={nameSize} maxWidth={archWidth(y - nameSize * 0.75) - 28} textAnchor="middle" fill={ink}
          data-word="name" style={{ fontFamily: `${fontCss(face)}, Georgia, serif`, fontWeight: face.weight }}>{l}</FitText>;
      })}
      {line && <FitText x={lineBox.cx} y={words.bottom - 8} fontSize={lineSize} maxWidth={Math.min(lineBox.w, archWidth(words.bottom - 8 - lineSize * 0.75) - 28)} textAnchor="middle" fill={ink}
        letterSpacing={lineFace.hand ? 0 : lineSize * 0.06} data-word="line" style={{ fontFamily: `${fontCss(lineFace)}, Georgia, serif`, fontWeight: lineFace.weight }}>{line}</FitText>}
      {rows.flatMap((n, shelf) => Array.from({ length: n }, (_, col) => {
        const x = board.x0 + span * ((col + 0.5) / 3) + (span / 3) * ((3 - n) / 2);
        return <GiveawayBox key={`${shelf}-${col}`} look={look} x={x} y={shelves[shelf] - boxH / 2 + 2} h={boxH} uid={`gvb-${shelf}-${col}`} />;
      }))}
      {g.boardGarland && gSrc && (
        <g data-part="garland" data-set={shot.folder} filter="url(#gvb-wall)">
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <image href={gSrc} x={gX} y={gTop} width={gW} height={gH} />
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
  const art = !g?.enabled ? null : onTable
    ? <TablePlace table={config.table!} theme={theme} className="bz-tb-place bz-gv-art"
        atPlace={(id) => <GiveawayBox look={boxLook(g, theme)} x={2} y={-17.8} h={14} rot={-4} uid={`gvt-${id}`} />} />
    : <GiveawayBoardArt g={g} theme={theme} balloons={config.decor.balloonColors} className="bz-gv-art bz-gv-board" />;
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
        {showRender ? <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="bz-tb-photo" data-testid="giveaways-render" src={render.url!} alt="Your giveaways, rendered" />
          {/* The live picture stays in the page, out of sight, for a new render of it to be taken from (Regenerate). */}
          <div className="bz-live-hidden" aria-hidden="true"><div className="bz-wb-wait">{art}</div></div>
        </> : (
          <div className={render.loading ? "bz-wb-wait on" : "bz-wb-wait"}>
            {art}
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
          : g.count > BOARD_SHOWS ? `Your board holds ${BOARD_SHOWS} boxes — the other ${g.count - BOARD_SHOWS} are kept beside it, and the shelves are filled up again as they go.`
          : `Your board — all ${g.count} of your boxes on its shelves.`}</p>
        {backTo !== null && <button type="button" className="bz-tb-back" data-testid="giveaways-back-to-choices" onClick={back}>↑ Back to your choices</button>}
        {!render.ready && !render.loading && (
          <div className="bz-tb-render" data-testid="giveaways-render-box">
            <button type="button" className="bz-next" onClick={onGenerate}>{render.stale ? "Regenerate render ✨" : "Generate render ✨"}</button>
            <p className="hint">{render.stale ? "You changed the giveaways since your render." : "This preview made into one photo-real picture."} Needs a free account.</p>
            {render.error && <p className="error" role="alert">{render.error}</p>}
          </div>
        )}
        <RenderAgain render={render} onGenerate={onGenerate} testId="giveaways-render-again" />
      </> : <div className="empty">Add giveaways to see them here.</div>}
    </div>
  </>);
}
