// The left-hand preview during the giveaways part of Decor (2026-11-03, the owner: "tabledaysa bir önceki aşamada
// seçim yaptığı table da görelim yada boardda görelim … onları da render alıp sonra gene preview'a koymamız
// lazım"): the boxes where they go — at the place on the kids' table she set (its One place view, a box lying at
// the top of the placemat), or on the shelves of the arch board in her colour, the name on it in vinyl. Then that
// picture rendered into one photograph (the builder's usePieceRender, /api/giveaway-render), which finalizing the
// giveaways waits for.
import { useEffect, useState } from "react";
import { themeById, THEMES, type BuilderConfig } from "@/lib/config";
import { BOARD_PHOTO, BOARD_SHOWS, BOX_PHOTO, boardOutline, type Giveaways } from "@/lib/studio/giveaways";
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

/** The shelved board, its boxes on the shelves and the name on its arch. */
export function GiveawayBoardArt({ g, theme, className }: { g: Giveaways; theme: { id: string; accent: string }; className?: string }) {
  const look = boxLook(g, theme);
  const { w: W, h: H, board, shelves, boxH, words } = BOARD_PHOTO;
  const boxW = (boxH * BOX_PHOTO.w) / BOX_PHOTO.h;
  const shown = Math.min(g.count, BOARD_SHOWS);
  const span = board.x1 - board.x0;
  const white = g.boardColour.toUpperCase() === "#FFFFFF";
  const face = tableFont(g.font);
  const name = g.name.trim();
  const nameSize = Math.min(78, (words.w / Math.max(4, name.length * 0.52))) * (face.hand ? 1 : 0.8);
  // The darker the board, the lighter the words.
  const ink = isDark(g.boardColour) ? "#FFFFFF" : theme.accent;
  return (
    <svg className={className} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Your giveaway board" data-testid="giveaway-board-art">
      <image href={BOARD_PHOTO.src} width={W} height={H} />
      {/* The board's colour, over its photographed light and shade. */}
      {!white && <path d={boardOutline()} fill={g.boardColour} style={{ mixBlendMode: "multiply" }} data-part="board-colour" />}
      {/* Her words on the arch, flat cut vinyl. */}
      {name && <text x={words.cx} y={words.top + nameSize * 0.8} fontSize={nameSize} textAnchor="middle" fill={ink}
        style={{ fontFamily: `${fontCss(face)}, Georgia, serif`, fontWeight: face.weight }}>{face.hand ? name : name.toUpperCase()}</text>}
      {g.boardLine.trim() && <text x={words.cx} y={words.bottom - 8} fontSize={24} textAnchor="middle" fill={ink} letterSpacing={2}
        style={{ fontFamily: "var(--font-sans), Arial, sans-serif", fontWeight: 600 }}>{g.boardLine.trim().toUpperCase()}</text>}
      {/* Three boxes to a shelf, top shelf first. */}
      {Array.from({ length: shown }, (_, i) => {
        const shelf = Math.floor(i / 3), col = i % 3;
        const x = board.x0 + span * ((col + 0.5) / 3);
        return <GiveawayBox key={i} look={look} x={x} y={shelves[shelf] - boxH / 2 + 2} h={boxH} uid={`gvb-${i}`} />;
      })}
    </svg>
  );
}

function isDark(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 140;
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
  return (
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
              : <GiveawayBoardArt g={g} theme={theme} className="bz-gv-art bz-gv-board" />}
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
  );
}
