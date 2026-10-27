// The Decor step's first question (2026-10-27): a backdrop, or skip it — as
// the kids' table asks ("aynı soruyu başta backdrop için de soralım").
import { themeById, THEMES, type BuilderConfig, type DecorConfig } from "@/lib/config";

export default function BackdropIntro({ config, patchDecor }: { config: BuilderConfig; patchDecor: (patch: Partial<DecorConfig>) => void }) {
  const theme = themeById(config.theme) ?? THEMES[0];
  const skipped = config.decor.backdropChoice === "skip";
  return (
    <div className="bz-tb-intro" data-testid="backdrop-intro">
      <h2>Add a backdrop?</h2>
      <p>The party&apos;s photo spot: boards, a balloon garland and the little extras — in your {theme.name} theme. You design it piece by piece; the price adds to your party.</p>
      <div className="actions">
        <button type="button" className="bz-next" onClick={() => patchDecor({ backdropChoice: "yes" })}>Yes, design the backdrop ✦</button>
        {!skipped && <button type="button" className="bz-back" onClick={() => patchDecor({ backdropChoice: "skip" })}>No thanks, skip</button>}
      </div>
      {skipped && <p className="skipped">You skipped the backdrop — it isn&apos;t in your total.</p>}
    </div>
  );
}
