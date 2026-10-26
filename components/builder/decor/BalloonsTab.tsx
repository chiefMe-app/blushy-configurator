// Decor step · Balloons tab (tab 03), moved unchanged from DecorStep in
// app/builder/page.tsx (Phase 0.1). Everything it reads comes from the
// step's shared state (useDecorStep).
import { BALLOON_STYLES } from "@/lib/config";
import { SEMPERTEX_CATALOG } from "@/lib/sempertexCatalog";
import { Dash } from "@/components/builder/ui";
import type { DecorCtx } from "@/components/builder/decor/useDecorStep";

export default function BalloonsTab({ ctx }: { ctx: DecorCtx }) {
  const {
    patchDecor, sempertexIds, sempertexManual, showSempertexBrowser, setShowSempertexBrowser, sempertexQuery,
    setSempertexQuery, sempertexFilter, setSempertexFilter, sempertexExceeded, effectiveSempertexSelection,
    toggleSempertex, resetToThemePalette, d, theme, card, nextCue, chip,
  } = ctx;
  return (
    <div>
      {d.backdropItems.length > 0 && d.balloonStyle === "none" && <div style={{ marginBottom: 10 }}>{nextCue("Optional — add a garland")}</div>}

    {/* Garland choice — balloons are opt-in (2026-07-20). They used to be
        pre-added by the package's defaultDecor with no way to decline.
        2026-10-23: presented as the two large illustrated cards. */}
    <section className="bz-ex-card c-pink">
      <h3 className="bz-ex-title"><span>1.</span> Choose your balloon style <Dash /></h3>
      <div className="bz-bl-styles">
        {/* 2026-09-09: "No balloons" is offered on a Balloon Ring again. It
            used to be hidden because a ring WAS the balloons — but the ring
            now has a bare gold hoop dressing, and with that chosen the tier
            below has to be able to say "no balloons" too, or the quote still
            charges for a garland that is not in the render. The two controls
            are kept in step in both directions. */}
        {BALLOON_STYLES
          .map((b) => {
          const active = d.balloonStyle === b.id;
          const hasRing = d.backdropItems.some((i) => i.type === "balloon_ring");
          return (
            <button key={b.id} type="button"
              onClick={() => patchDecor(
                hasRing
                  ? { balloonStyle: b.id, balloonRingStyle: b.id === "none" ? "none" : (d.balloonRingStyle === "none" ? "full" : (d.balloonRingStyle ?? "full")) }
                  : { balloonStyle: b.id },
              )}
              aria-pressed={active}
              className={`bz-bl-style ${b.id === "none" ? "none" : "garland"} ${active ? "on" : ""}`}>
              {active ? <span className="bz-st-tick" aria-hidden="true">✓</span> : <span className="radio" aria-hidden="true" />}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.id === "none" ? "/design/ui/balloons-none.webp" : "/design/ui/balloons-garland.webp"} alt="" />
              <span className="txt">
                <strong>{b.id === "none" ? "No balloons" : "Organic Garland"}</strong>
                {b.price > 0 && <em>+AED {b.price}</em>}
                <small>{b.id === "none" ? "Keep it simple – backdrop only." : "A beautiful, modern garland to complete your backdrop."}</small>
              </span>
            </button>
          );
        })}
      </div>
    </section>

    {/* SEMPERTEX PICKER — the palette as balloon chips; expanded: full browser */}
    <section className="bz-ex-card c-yellow" style={{ opacity: d.balloonStyle === "none" ? 0.55 : 1 }}>
      <div className="bz-bl-head">
        <h3 className="bz-ex-title"><span>2.</span> Your balloon colours <Dash /></h3>
        <span className="bz-bl-pill">{sempertexManual ? "Your Sempertex mix" : `Matched to ${theme.name}`} · {effectiveSempertexSelection.length} colours</span>
      </div>
      {d.balloonStyle !== "none" && (
        <p className="bz-bl-lead">
          {sempertexManual
            ? "Your own pick of real Sempertex shades. Reset to go back to the theme’s colours."
            : <>Already chosen for your <b>{theme.name}</b> theme from the real Sempertex range — nothing to pick. Want something different? Change colours.</>}
        </p>
      )}
      {d.balloonStyle === "none" && <p className="bz-bl-muted">Pick a garland above to choose balloon colours.</p>}

      <div style={{ marginBottom: 12 }}>
        {/* Chips — rendered directly from effectiveSempertexSelection (single source of truth).
            Tapping one removes it, as before. */}
        <div className="bz-bl-chips">
          {effectiveSempertexSelection.length === 0 && (
            <span className="bz-bl-muted">No colours selected — tap “Change colours” to pick.</span>
          )}
          {effectiveSempertexSelection.map(c => (
            <button key={c.id} type="button" onClick={() => toggleSempertex(c.id)} className="bz-bl-chip" title={`Remove ${c.code} ${c.colorName}`}>
              <span className={`ball ${/reflex|chrome|metallic/i.test(c.finish) ? "chrome" : ""} ${/clear/i.test(c.colorName) ? "clear" : ""}`} style={{ ["--c" as string]: c.hex } as React.CSSProperties} aria-hidden="true" />
              <span className="txt"><strong>{c.code}</strong><small>{c.colorName}</small></span>
              <span className="x" aria-hidden="true">×</span>
            </button>
          ))}
        </div>
        <div className="bz-bl-actions">
          <button type="button" onClick={() => setShowSempertexBrowser(v => !v)} className={`bz-st-chip ${showSempertexBrowser ? "on" : ""}`}>
            {showSempertexBrowser ? "Done" : "Change colours"}
          </button>
          <button type="button" onClick={resetToThemePalette} className="bz-st-chip" style={{ opacity: sempertexManual ? 1 : 0.5 }}>
            Reset to theme
          </button>
        </div>
        {sempertexExceeded && (
          <div style={{ marginTop: 6, fontSize: 11, color: "#EC4D8D", fontWeight: 600 }}>Maximum 5 colors selected. Remove one to add another.</div>
        )}
        {sempertexManual && (
          <div style={{ marginTop: 8, padding: "6px 10px", background: "#FFF7E6", border: "1px solid #FCD9A0", borderRadius: 8, fontSize: 11, color: "#92620A", fontWeight: 600 }}>
            Balloon colors changed - regenerate to update preview.
          </div>
        )}
      </div>

      <div className="bz-bl-tip"><span aria-hidden="true">💡</span> These are the exact Sempertex shades our team will inflate on the day.</div>

      {/* Expandable catalogue browser */}
      {showSempertexBrowser && (
        <div style={{ borderTop: "1px solid #F1D8E2", paddingTop: 14 }}>
          {/* Search */}
          <input aria-label="Search Sempertex colors" type="text"
            placeholder="Search code or color, e.g. 609, Pastel Matte Pink, Reflex Gold"
            value={sempertexQuery} onChange={e => setSempertexQuery(e.target.value)}
            style={{ width: "100%", padding: "9px 14px", borderRadius: 10, border: "1.5px solid #ECEAF1", fontSize: 13, outline: "none", marginBottom: 10, boxSizing: "border-box", color: "#15182E" }} />

          {/* Filter pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {["All","Pastel Matte","Silk","Reflex","White","Pink","Purple","Gold"].map(f => (
              <button key={f} type="button" onClick={() => setSempertexFilter(f)}
                style={{ padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
                  background: sempertexFilter === f ? "#EC4D8D" : "white",
                  color: sempertexFilter === f ? "white" : "#73778A",
                  border: sempertexFilter === f ? "none" : "1.5px solid #ECEAF1" }}>
                {f}
              </button>
            ))}
          </div>

          {/* Color grid */}
          {(() => {
            const q = sempertexQuery.toLowerCase();
            const filtered = SEMPERTEX_CATALOG.filter(c => {
              const matchSearch = !q || c.code.includes(q) || c.colorName.toLowerCase().includes(q) || c.finish.toLowerCase().includes(q) || c.family.toLowerCase().includes(q);
              const matchFilter = sempertexFilter === "All" || c.finish.includes(sempertexFilter) || c.family === sempertexFilter;
              return matchSearch && matchFilter;
            });
            return (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
                {filtered.map(c => {
                  const sel = sempertexIds.includes(c.id);
                  const maxed = sempertexIds.length >= 5 && !sel;
                  return (
                    <button key={c.id} type="button" onClick={() => !maxed && toggleSempertex(c.id)}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px", borderRadius: 12,
                        cursor: maxed ? "not-allowed" : "pointer",
                        border: sel ? "2px solid #EC4D8D" : "1.5px solid #ECEAF1",
                        background: sel ? "#FFF7FB" : "white",
                        opacity: maxed ? 0.42 : 1, transition: "all 0.15s", position: "relative", textAlign: "left" }}>
                      {sel && <span style={{ position: "absolute", top: 5, right: 5, width: 16, height: 16, borderRadius: "50%", background: "#EC4D8D", color: "white", fontSize: 10, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span>}
                      <span style={{ width: 30, height: 30, borderRadius: "50%", background: c.hex, border: "1.5px solid rgba(0,0,0,0.10)", flexShrink: 0, display: "block" }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: sel ? "#EC4D8D" : "#15182E" }}>{c.code}</div>
                        <div style={{ fontSize: 10, color: "#73778A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.colorName}</div>
                        <div style={{ fontSize: 9, color: "#A1A3B4", marginTop: 1 }}>{c.finish}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
    </section>

    </div>
  );
}
