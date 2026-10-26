// Decor step · Backdrop tab (tab 01), moved unchanged from DecorStep in
// app/builder/page.tsx (Phase 0.1). Everything it reads comes from the
// step's shared state (useDecorStep).
import { ARCH_SIZES, PER_BACKDROP, formatAED } from "@/lib/config";
import { SETUP_LAYOUT_TEMPLATES } from "@/lib/setupLayoutCatalog";
import { MAX_BACKDROP_ITEMS, SETUP_ICON } from "@/components/builder/constants";
import { SetupMiniPreview } from "@/components/builder/ui";
import type { DecorCtx } from "@/components/builder/decor/useDecorStep";

export default function BackdropTab({ ctx }: { ctx: DecorCtx }) {
  const {
    patchDecor, showManualPieces, setShowManualPieces, d, t, card, nextCue, BackdropShapePreview,
    toggleArchSize, toggleRound, toggleOtherType, applySetupTemplate, activeSetupTemplateId, TYPE_LABEL,
  } = ctx;
  return (
    <div>
    <div>
      {/* Curated setup layouts — illustrated icon cards */}
      <div style={{ marginBottom: 16 }}>
        {d.backdropItems.length === 0 && <div style={{ marginBottom: 10 }}>{nextCue("Start here — tap a layout")}</div>}
        <div className="bz-layout-grid">
          {SETUP_LAYOUT_TEMPLATES.map((tpl) => {
            const active = activeSetupTemplateId === tpl.id;
            const icon = SETUP_ICON[tpl.id];
            return (
              <button key={tpl.id} type="button" aria-pressed={active}
                onClick={() => {
                  applySetupTemplate(tpl.id);
                  // 2026-10-23: on phones and tablets the preview sits below the
                  // options, so each pick scrolls down to show it.
                  if (window.innerWidth < 1024) {
                    setTimeout(() => document.getElementById("party-preview-card")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
                  }
                }}
                className={`bz-choice bz-layout ${active ? "selected" : ""}`} title={tpl.description}>
                {active && <span className="tick">✓</span>}
                {tpl.badge && !active && (
                  <span className="bz-coming" style={{ top: 5, right: 5, padding: "3px 7px" }}>{tpl.badge}</span>
                )}
                {/* 2026-10-22 redesign: the reference's illustrated backdrop icon. */}
                <span className="art">
                  {icon
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={icon} alt="" loading="lazy" />
                    : <SetupMiniPreview shapes={tpl.miniPreview} />}
                </span>
                <h3>{tpl.name}</h3>
                {/* 2026-10-25: every choice shows its price. Boards cost PER_BACKDROP each (+80 for a shimmer wall). */}
                <small className="bz-layout-price">AED {formatAED(tpl.backdropTypes.reduce((s, t) => s + PER_BACKDROP + (t === "shimmer_wall" ? 80 : 0), 0))}</small>
              </button>
            );
          })}
        </div>
        {d.backdropItems.length > 0 && (
          <div style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6, background: "#FFF0F6", border: "1px solid #F7C9DD", borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 700, color: "#EC4D8D" }}>
            <span aria-hidden style={{ width: 5, height: 5, borderRadius: "50%", background: "#EC4D8D", display: "inline-block" }}/>
            <span>Your set: {d.backdropItems.map(i => TYPE_LABEL[i.type] ?? i.type).join(" + ")}</span>
          </div>
        )}
        {d.backdropItems.length >= MAX_BACKDROP_ITEMS && (
          <div style={{ marginTop: 8, fontSize: 11, color: "#73778A", fontWeight: 500 }}>
            You can select up to 3 backdrop pieces for a controlled render.
          </div>
        )}
        <button type="button" onClick={() => setShowManualPieces(v => !v)}
          style={{ marginTop: 10, fontSize: 11, fontWeight: 600, color: "#8A8DA0", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
          {showManualPieces ? "Hide manual piece options" : "Change pieces manually"}
        </button>
      </div>

      {/* 4 type cards in a row — secondary, behind "Change pieces manually" */}
      {showManualPieces && (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
        {[
          { type: "arch" as const, label: "Arch Backdrop", badge: "Most popular", click: () => { const hasArch = d.backdropItems.some(i=>i.type==="arch"); if(!hasArch) toggleArchSize(ARCH_SIZES.find(s=>s.id==="large") ?? ARCH_SIZES[2]); else patchDecor({ backdropItems: d.backdropItems.filter(i=>i.type!=="arch") }); } },
          { type: "rect" as const, label: "Rectangular Backdrop", badge: null, click: () => toggleOtherType("rect") },
          { type: "round" as const, label: "Round Backdrop", badge: null, click: () => toggleRound() },
        ].map(({ type, label, badge, click }) => {
          const isSelected = type === "arch"
            ? d.backdropItems.some(i => i.type === "arch")
            : d.backdropItems.some(i => i.type === type);
          return (
            <div key={type} onClick={click} style={{
              border: isSelected ? "2px solid #F7A7C8" : "1.5px solid #ECEAF1",
              borderRadius: 14, padding: "20px 10px 14px", textAlign: "center",
              background: isSelected ? "linear-gradient(145deg, #FFF7FB 0%, #FFFFFF 100%)" : "#FAFAFA",
              cursor: "pointer", position: "relative", transition: "all 0.18s",
              minHeight: 160, boxShadow: isSelected ? "0 8px 24px rgba(236,77,141,0.10)" : "none",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              {/* Elegant check -no SELECTED text */}
              {isSelected && (
                <span style={{ position: "absolute", top: 9, right: 9, background: "#EC4D8D", color: "white", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900 }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
              )}
              {badge && <span style={{ position: "absolute", top: 9, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", background: isSelected ? "#EC4D8D" : "#FFE8F0", color: isSelected ? "white" : "#EC4D8D", fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>{badge}</span>}
              <div style={{ marginTop: badge ? 10 : 0 }}>
                <BackdropShapePreview type={type} color={isSelected ? "#EC4D8D" : "#E8D5E8"} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: isSelected ? "#EC4D8D" : "#15182E", lineHeight: 1.3 }}>{label}</div>
            </div>
          );
        })}
      </div>
      )}

    </div>
    </div>
  );
}
