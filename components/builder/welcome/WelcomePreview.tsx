// The left-hand preview during the welcome board part of Decor (2026-10-31):
// the board drawn live. On a phone, where it sits under the choices, each
// change brings it into view, with a way back (as the kids' table does).
// Later that day: a real photo of the board on its stand, the customer's print
// and words laid onto it, with a real garland and roses
// (components/studio/WelcomeBoardArt.tsx). 2026-11-03 (the owner: "burda da
// rendera zorlasın, bakalım ne olacak merak ettim"): that preview, rendered
// into one photograph (the builder's usePieceRender, /api/welcome-render),
// which finalizing the board waits for.
import { useEffect, useState } from "react";
import { themeById, THEMES, type BuilderConfig } from "@/lib/config";
import WelcomeBoardArt from "@/components/studio/WelcomeBoardArt";
import { usePhoneJump } from "@/components/builder/usePhoneJump";
import type { PieceRender } from "@/components/builder/usePieceRender";
import RenderAgain from "@/components/builder/RenderAgain";

export default function WelcomePreview({ config, render, onGenerate }: { config: BuilderConfig; render: PieceRender; onGenerate: () => void }) {
  const theme = themeById(config.theme) ?? THEMES[0];
  const b = config.welcomeBoard;
  // Pressing Finish is not a change to the board.
  const changeKey = b?.enabled ? JSON.stringify({ ...b, done: undefined, render: undefined }) : "";
  const { backTo, back } = usePhoneJump(changeKey, "welcome-preview-card");
  // The render once there is one; the live board a tap away.
  const [live, setLive] = useState(false);
  useEffect(() => { if (render.url) setLive(false); }, [render.url]);
  const showRender = !!render.url && !live;
  return (
    <div className="bz-tb-preview" data-testid="welcome-preview" id="welcome-preview-card">
      <div className="head">
        <span className="title">✦ Your welcome board</span>
        {render.url && (
          <div className="views" role="tablist" aria-label="Welcome board view">
            <button type="button" role="tab" aria-selected={!showRender} className={!showRender ? "on" : ""} onClick={() => setLive(true)}>Live</button>
            <button type="button" role="tab" aria-selected={showRender} className={showRender ? "on" : ""} onClick={() => setLive(false)}>Render</button>
          </div>
        )}
      </div>
      {b?.enabled ? <>
        <link rel="stylesheet" href="/fonts/typography/fonts.css" />
        {showRender ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="bz-tb-photo" data-testid="welcome-render" src={render.url!} alt="Your welcome board, rendered" />
        ) : (
          <div className={render.loading ? "bz-wb-wait on" : "bz-wb-wait"}>
            <WelcomeBoardArt board={b} theme={theme} balloons={config.decor.balloonColors} className="bz-wb-art" />
            {render.loading && (
              <div className="veil" role="status" data-testid="welcome-render-wait">
                <span className="dots" aria-hidden="true"><i /><i /><i /></span>
                <b>Rendering your board</b>
                <span>From this preview — about 15 seconds.</span>
              </div>
            )}
          </div>
        )}
        <p className="note">{showRender ? "Your render — this board, made into one photograph." : "A real photo of your board, to scale — your words show as you type."}</p>
        {backTo !== null && <button type="button" className="bz-tb-back" data-testid="welcome-back-to-choices" onClick={back}>↑ Back to your choices</button>}
        {!render.ready && !render.loading && (
          <div className="bz-tb-render" data-testid="welcome-render-box">
            <button type="button" className="bz-next" onClick={onGenerate}>{render.stale ? "Regenerate render ✨" : "Generate render ✨"}</button>
            <p className="hint">{render.stale ? "You changed the board since your render." : "This preview made into one photo-real picture."} Needs a free account.</p>
            {render.error && <p className="error" role="alert">{render.error}</p>}
          </div>
        )}
        <RenderAgain render={render} onGenerate={onGenerate} testId="welcome-render-again" />
      </> : <div className="empty">Add a welcome board to see it here.</div>}
    </div>
  );
}
