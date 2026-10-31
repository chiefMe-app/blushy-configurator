// The left-hand preview during the welcome board part of Decor (2026-10-31):
// the board drawn live. On a phone, where it sits under the choices, each
// change brings it into view, with a way back (as the kids' table does).
// Later that day: the room, easel, balloons and roses are real photo pieces
// (components/studio/WelcomeBoardArt.tsx) — still no render.
import { themeById, THEMES, type BuilderConfig } from "@/lib/config";
import WelcomeBoardArt from "@/components/studio/WelcomeBoardArt";
import { usePhoneJump } from "@/components/builder/usePhoneJump";

export default function WelcomePreview({ config }: { config: BuilderConfig }) {
  const theme = themeById(config.theme) ?? THEMES[0];
  const b = config.welcomeBoard;
  // Pressing Finish is not a change to the board.
  const changeKey = b?.enabled ? JSON.stringify({ ...b, done: undefined }) : "";
  const { backTo, back } = usePhoneJump(changeKey, "welcome-preview-card");
  return (
    <div className="bz-tb-preview" data-testid="welcome-preview" id="welcome-preview-card">
      <div className="head"><span className="title">✦ Your welcome board</span></div>
      {b?.enabled ? <>
        <link rel="stylesheet" href="/fonts/typography/fonts.css" />
        <div className="bz-wb-wait"><WelcomeBoardArt board={b} theme={theme} balloons={config.decor.balloonColors} className="bz-wb-art" /></div>
        <p className="note">To scale, on its stand, made from photos of each piece — your words show as you type.</p>
        {backTo !== null && <button type="button" className="bz-tb-back" data-testid="welcome-back-to-choices" onClick={back}>↑ Back to your choices</button>}
      </> : <div className="empty">Add a welcome board to see it here.</div>}
    </div>
  );
}
