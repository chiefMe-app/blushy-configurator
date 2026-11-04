// The Decor step: its head, the four tab buttons, the open tab and the tab
// footer. Moved unchanged from app/builder/page.tsx (Phase 0.1f); the tabs and
// their shared state live next to it.
import { SETUP_LAYOUT_TEMPLATES } from "@/lib/setupLayoutCatalog";
import { DECOR_TABS } from "@/components/builder/constants";
import { useDecorStep, type DecorStepProps } from "@/components/builder/decor/useDecorStep";
import BackdropTab from "@/components/builder/decor/BackdropTab";
import BalloonsTab from "@/components/builder/decor/BalloonsTab";
import StyleTab from "@/components/builder/decor/StyleTab";
import ExtrasTab from "@/components/builder/decor/ExtrasTab";

export default function DecorStep(props: DecorStepProps) {
  const ctx = useDecorStep(props);
  const {
    decorTab, setDecorTab, onGenerate, renderReady, hasRender, generating, onContinue, continueBlocked, d, theme,
    activeSetupTemplateId,
  } = ctx;
  // 2026-11-02 (owner, later: "her stepe koyalım demek istemedim, extras'tan sonra … öncesinde 'first generate
  // render to see final design' … 'finalize the backdrop to table setup' desin"): only on the last tab, Extras.
  // 2026-11-03 ("generate render yapmadan finalize … basılamasın"): and only once the render is made.
  const blocked = continueBlocked || !!props.needsRender;
  const finish = (
    <button type="button" className="bz-decor-cta" onClick={onContinue} disabled={blocked} data-testid="finish-backdrop"
      title={continueBlocked ? "Pick your arch's size first" : props.needsRender ? "Make its real photo first" : undefined}>
      <span className="full">Finalize the backdrop → Table setup</span><span className="short" aria-hidden="true">Finalize → Table setup</span>
    </button>
  );
  const offerRender = !renderReady && !d.backdropItems.some((i) => i.type === "themed_set");
  return (
    <div>
      {/* == Compact decor head + the four tabs (2026-10-22 redesign) == */}
      <div className="bz-decor-head">
        <span>YOUR DECOR</span>
        <strong>{SETUP_LAYOUT_TEMPLATES.find((t) => t.id === activeSetupTemplateId)?.name ?? "Pick a backdrop"}</strong>
        <span style={{ marginLeft: "auto", color: "#7f717c", fontWeight: 650 }}>{theme.name} theme</span>
      </div>
      <div className="bz-decor-tabbar" role="tablist" aria-label="Decor customization">
        {DECOR_TABS.map((t, i) => (
          <button key={t.name} type="button" role="tab" aria-selected={decorTab === i}
            className={`bz-decor-tab ${decorTab === i ? "on" : ""}`} onClick={() => setDecorTab(i)}>
            <span className="num">{t.num}</span><span>{t.name}</span>
          </button>
        ))}
      </div>
      {/* 2026-10-23: only the Backdrop tab keeps its own panel head. */}
      {decorTab === 0 && <div className="bz-decor-panel-head">
        <div>
          <span className="bz-decor-kicker">{DECOR_TABS[decorTab].kicker}</span>
          <h2>{DECOR_TABS[decorTab].title}</h2>
          <p>{DECOR_TABS[decorTab].sub}</p>
        </div>
        <span className="bz-decor-count">{DECOR_TABS[decorTab].num} / 04</span>
      </div>}

      {/* == 1 · BACKDROP (tab 01) ============================= */}
      {decorTab === 0 && <BackdropTab ctx={ctx} />}

      {/* == 2 · STYLE (tab 02) — 2026-10-23 redesign: five numbered steps for
           one piece at a time (size, message, lettering, colours, graphic).
           Every control writes through the same patchItem / patchItemText /
           patchItemGraphic handlers and keeps the same sales rules as before;
           only the presentation changed. == */}
      {decorTab === 1 && <StyleTab ctx={ctx} />}

      {/* == 3 · BALLOONS (tab 03) ============================= */}
      {decorTab === 2 && <BalloonsTab ctx={ctx} />}

      {/* == 4 · EXTRAS (tab 04) =============================== */}
      {/* == 4 · EXTRAS (tab 04) — 2026-10-23 redesign: five colour cards.
           Every control is the one that was here before (toggleCutoutAsset,
           patchDecor for florals / neon / number, setPlinthCount); prices come
           from the product data. == */}
      {decorTab === 3 && <ExtrasTab ctx={ctx} />}

      {/* == Tab footer: next tab; after Extras, the table — and the render, which is optional (2026-10-27) == */}
      <div className="bz-decor-footer">
        <span>✓ Saved as you go</span>
        {decorTab < DECOR_TABS.length - 1 ? (
          <span className="bz-decor-actions">
            <button type="button" className="bz-decor-hint" onClick={() => setDecorTab(decorTab + 1)}>
              Next up: {DECOR_TABS[decorTab + 1].name} →
            </button>
          </span>
        ) : (
          <span className="bz-decor-actions">
            {offerRender && <span className="bz-decor-first" data-testid="render-first-hint">{hasRender
              ? <>You changed it since its photo — <b>make a new photo</b> to finalize this design.</>
              : <>First <b>Make it a real photo</b> to see your final design.</>}</span>}
            {/* The Customized Themed set is its real photo: no render is made of it. */}
            {offerRender && (
              <button type="button" className="bz-decor-hint" onClick={onGenerate} data-testid="generate-render"
                disabled={generating || d.backdropItems.some((i) => i.type === "arch" && !i.sizeId)}>
                {generating ? "Making the photo…" : hasRender ? "Make a new photo ✨" : "Make it a real photo ✨"}
              </button>
            )}
            {finish}
          </span>
        )}
      </div>
      <div className="bz-decor-note">✳ No need to scroll through every option — just switch tabs.</div>
    </div>
  );
}
