// Decor step · Extras tab (tab 04), moved unchanged from DecorStep in
// app/builder/page.tsx (Phase 0.1). Everything it reads comes from the
// step's shared state (useDecorStep).
import {
  CUTOUT_STANDEE_OPTIONS,
  cutoutPrice,
  cutoutTotalCount,
  NEON_SIGN_PRICE,
  GARLAND_FLORALS_PRICE,
  NUMBER_LIGHT_PRICE,
  FOIL_NUMBER_BUNCH_PRICE,
  FOIL_NUMBER_COLOURS,
  foilNumberColour,
  plinthsTotal,
  NEON_SIGN_PRESETS,
} from "@/lib/config";
import { MAX_STANDEES, PLINTH_SHORT } from "@/components/builder/constants";
import { Dash } from "@/components/builder/ui";
import type { DecorCtx } from "@/components/builder/decor/useDecorStep";

export default function ExtrasTab({ ctx }: { ctx: DecorCtx }) {
  const {
    patchDecor, showAllChars, setShowAllChars, d, boardHasLettering, neonFreeBoards, theme, t, normalizedCut,
    cutoutPresetOptions, selectedCutoutAssets, toggleCutoutAsset, clearAllStandees, setPlinthCount,
    card, chip, TYPE_LABEL,
  } = ctx;
  const single = CUTOUT_STANDEE_OPTIONS.find((o) => o.size === "large")!;
  const standeeCount = cutoutTotalCount(normalizedCut);
  const shownChars = showAllChars ? cutoutPresetOptions : cutoutPresetOptions.slice(0, 3);
  const firstSel = selectedCutoutAssets[0];
  const firstSelPreview = firstSel
    ? (firstSel.previewUrl || (cutoutPresetOptions.find((p) => p.assetId === firstSel.assetId) as { previewUrl?: string } | undefined)?.previewUrl)
    : undefined;
  const plinthCount = d.plinths ?? 0;
  const plinthSum = plinthsTotal(d.plinthSizes);
  // A plain function, not a component: defined in render, a component would
  // remount the button (and drop keyboard focus) on every change.
  const switchBtn = ({ on, onClick, disabled, label }: { on: boolean; onClick: () => void; disabled?: boolean; label: string }) => (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled}
      className={`bz-switch ${on ? "on" : ""}`} onClick={onClick}><span /></button>
  );
  const priceLine = (p: number) => (p > 0 ? <em>+ AED {p}</em> : null);
  // 5 — PLINTHS: 0–3, sized by the ladder (XXL, then XL, then L). Beside the
  // light-up number while the neon card is short; under it once neon is on.
  const plinthsCard = (
    <section className="bz-ex-card c-green">
      <div className="bz-ex-row">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="bz-ex-art" src="/design/ui/extra-plinths.webp" alt="" />
        <div className="bz-ex-body">
          <h3 className="bz-ex-title"><span>5.</span> Cake plinths</h3>
          <p>Stylish plinths to beautifully display the cake and treats.</p>
        </div>
        <div className="bz-ex-side">
          <div className="bz-stepper" role="group" aria-label="Number of plinths">
            <button type="button" aria-label="One fewer plinth" disabled={plinthCount <= 0} onClick={() => setPlinthCount(Math.max(0, plinthCount - 1))}>−</button>
            <span>{plinthCount}</span>
            <button type="button" aria-label="One more plinth" className="plus" disabled={plinthCount >= 3} onClick={() => setPlinthCount(Math.min(3, plinthCount + 1))}>+</button>
          </div>
          <span className="lbl small">
            {plinthCount > 0
              ? <>{d.plinthSizes.map((sz) => PLINTH_SHORT[sz] ?? sz).join(" · ")}<br />AED {plinthSum} total</>
              : "Up to 3"}
          </span>
        </div>
      </div>
    </section>
  );
  return (
<div className="bz-ex">

  {/* 1 — CHARACTER STANDEES */}
  <section className="bz-ex-card c-pink bz-ex-standees">
    <div className="bz-ex-intro">
      <h3 className="bz-ex-title"><span>1.</span> Character standees <Dash /></h3>
      <p>Bring their favourite characters to life at the party!</p>
      <small>Each standee is {single.heightCm} cm · +AED {single.unitPrice} · up to {MAX_STANDEES}</small>
    </div>
    <div className="bz-ex-chars" id="bz-ex-chars">
      {shownChars.map((preset) => {
        const selected = selectedCutoutAssets.some((a) => a.assetId === preset.assetId);
        const preview = (preset as { previewUrl?: string }).previewUrl;
        const full = !selected && selectedCutoutAssets.length >= MAX_STANDEES;
        return (
          <button key={preset.assetId} type="button" aria-pressed={selected} disabled={full}
            title={full ? "Two standees at most — remove one to swap" : undefined}
            onClick={() => toggleCutoutAsset({ assetId: preset.assetId, label: preset.label, previewUrl: preview || undefined })}
            className={`bz-ex-char ${selected ? "on" : ""}`}>
            {selected && <span className="bz-st-tick" aria-hidden="true">✓</span>}
            <span className="pic">
              {preview
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={preview} alt="" />
                : <span className="ph" aria-hidden="true">✦</span>}
            </span>
            <span className="name">{preset.label}</span>
          </button>
        );
      })}
      {cutoutPresetOptions.length > 3 && (
        <button type="button" className="bz-ex-char more" onClick={() => setShowAllChars((v) => !v)}>
          <span className="plus" aria-hidden="true">{showAllChars ? "–" : "+"}</span>
          <span className="name">{showAllChars ? "Fewer characters" : "More characters"}</span>
        </button>
      )}
    </div>
    <div className="bz-ex-squad">
      <h4>Your standee squad</h4>
      {standeeCount > 0 ? (
        <>
          <div className="row">
            {firstSelPreview
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={firstSelPreview} alt="" />
              : <span className="ph" aria-hidden="true">✦</span>}
            <span className="count">{standeeCount} standee{standeeCount === 1 ? "" : "s"} selected<br /><b>+AED {cutoutPrice(normalizedCut)}</b></span>
          </div>
          <div className="acts">
            <button type="button" className="bz-ex-change"
              onClick={() => { setShowAllChars(true); document.getElementById("bz-ex-chars")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>
              Change
            </button>
            <button type="button" className="bz-ex-clear" onClick={clearAllStandees}>Clear all</button>
          </div>
        </>
      ) : (
        <p>No characters yet — tap one to add it.</p>
      )}
    </div>
  </section>

  <div className="bz-ex-grid">
    <div className="bz-ex-col">
    {/* 2 — FLORALS. Only does anything with a garland, so it says so. */}
    <section className="bz-ex-card c-yellow">
      <div className="bz-ex-row">
        <div className="bz-ex-body">
          <h3 className="bz-ex-title"><span>2.</span> Florals &amp; greenery</h3>
          <p>Add a fresh, elegant touch with florals and greenery.</p>
        </div>
        <div className="bz-ex-side">
          {switchBtn({ on: !!d.garlandFlorals, disabled: d.balloonStyle === "none", label: "Add florals and greenery",
            onClick: () => patchDecor({ garlandFlorals: !d.garlandFlorals }) })}
          <span className="lbl">Add florals &amp; greenery{priceLine(GARLAND_FLORALS_PRICE)}</span>
        </div>
      </div>
      {d.balloonStyle === "none" && <p className="bz-bl-muted">Pick a balloon garland first.</p>}
    </section>

    {/* 4 — NUMBER LIGHT */}
    <section className="bz-ex-card c-lilac2">
      <div className="bz-ex-row">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="bz-ex-art num" src="/design/ui/extra-number.webp" alt="" />
        <div className="bz-ex-body">
          <h3 className="bz-ex-title"><span>4.</span> Big number</h3>
          <p>Their age as a light-up number, or as a foil balloon bunch in your theme colours.</p>
        </div>
        <div className="bz-ex-side">
          {switchBtn({ on: !!d.numberLight?.enabled, label: "Add a number",
            onClick: () => patchDecor({ numberLight: { ...d.numberLight, value: d.numberLight?.value ?? "1", enabled: !(d.numberLight?.enabled) } }) })}
          <span className="lbl">Add a number{priceLine(d.numberLight?.style === "foil" ? FOIL_NUMBER_BUNCH_PRICE : NUMBER_LIGHT_PRICE)}</span>
        </div>
      </div>
      {d.numberLight?.enabled && (
        <div className="bz-ex-more">
          {/* 2026-10-24: two kinds of number, one at a time. */}
          <div className="bz-st-presets" role="group" aria-label="Kind of number">
            {([["marquee", "💡 Light-up marquee"], ["foil", "🎈 Foil balloon bunch"]] as const).map(([id, label]) => (
              <button key={id} type="button" aria-pressed={(d.numberLight?.style ?? "marquee") === id}
                className={`bz-st-chip ${(d.numberLight?.style ?? "marquee") === id ? "on" : ""}`}
                onClick={() => patchDecor({ numberLight: { ...d.numberLight!, style: id } })}>{label}</button>
            ))}
          </div>
          {d.numberLight?.style === "foil" && (() => {
            // 2026-10-25: the customer picks the foil's colour; the first swatch is the theme's own.
            const themeFoil = foilNumberColour(d.balloonColors);
            const current = d.numberLight?.foilColor ?? "";
            const swatches = [{ hex: "", label: "Theme colour", show: themeFoil }, ...FOIL_NUMBER_COLOURS.map((c) => ({ ...c, show: c.hex }))];
            return (
              <div className="bz-ex-more inline bz-foil-cols">
                <span className="bz-ex-mini">Foil colour</span>
                <div className="bz-st-swatches">
                  {swatches.map((c) => (
                    <button key={c.label} type="button" aria-pressed={current === c.hex} aria-label={c.label} title={c.label}
                      className={`bz-st-sw ${current === c.hex ? "on" : ""}`} style={{ background: c.show }}
                      onClick={() => patchDecor({ numberLight: { ...d.numberLight!, foilColor: c.hex || undefined } })} />
                  ))}
                </div>
              </div>
            );
          })()}
          <div className="bz-ex-more inline">
            <span className="bz-ex-mini">Which number?</span>
            <input type="text" inputMode="numeric" className="bz-ex-input num" value={d.numberLight?.value ?? ""} placeholder="1"
              aria-label="Number"
              onChange={(e) => patchDecor({ numberLight: { ...d.numberLight!, enabled: true, value: e.target.value.replace(/[^0-9]/g, "").slice(0, 2) } })} />
          </div>
        </div>
      )}
    </section>

    {!d.neonSign?.enabled ? null : plinthsCard}
    </div>
    <div className="bz-ex-col">
    {/* 3 — NEON SIGN: in a balloon ring's open centre, or on the backdrop face. */}
    <section className="bz-ex-card c-lilac">
      <div className="bz-ex-row">
        <div className="bz-ex-body">
          <h3 className="bz-ex-title"><span>3.</span> Neon LED sign</h3>
          <p>{d.backdropItems.some((i) => i.type === "balloon_ring")
            ? "Light up the celebration — hung in the middle of the ring."
            : "Light up the celebration with a custom sign."}</p>
        </div>
        <span className={`bz-neon ${d.neonSign?.enabled ? "on" : ""}`} aria-hidden="true">{(d.neonSign?.text || "Happy Birthday").trim() || "Happy Birthday"}</span>
        <div className="bz-ex-side">
          {switchBtn({ on: !!d.neonSign?.enabled, label: "Add a neon sign",
            disabled: !d.neonSign?.enabled && neonFreeBoards.length === 0,
            onClick: () => {
              const want = d.neonSign?.panelIndex ?? 0;
              const panelIndex = neonFreeBoards.some(({ i }) => i === want) ? want : (neonFreeBoards[0]?.i ?? 0);
              patchDecor({ neonSign: { text: d.neonSign?.text ?? "Happy Birthday", panelIndex, enabled: !(d.neonSign?.enabled) } });
            } })}
          <span className="lbl">Add neon sign{priceLine(NEON_SIGN_PRICE)}</span>
        </div>
      </div>
      {!d.neonSign?.enabled && neonFreeBoards.length === 0 && (
        <div className="bz-ex-note">
          <p>Your backdrop already has printed text, so a neon sign can’t go on it too.</p>
          {/* 2026-10-24: one tap — the printed text comes off and its words go on the neon. */}
          <button type="button" className="bz-ex-notext" onClick={() => {
            const i = Math.max(0, d.backdropItems.findIndex((it) => it.type !== "open_arch_frame" && boardHasLettering(it)));
            const words = (d.backdropItems[i]?.text.value ?? "").trim() || "Happy Birthday";
            patchDecor({
              backdropItems: d.backdropItems.map((it, k) => (k === i ? { ...it, text: { ...it.text, enabled: false } } : it)),
              neonSign: { text: words.slice(0, 40), panelIndex: i, enabled: true },
            });
          }}>No printed text — use a neon sign instead</button>
        </div>
      )}
      {d.neonSign?.enabled && (() => {
        // 2026-10-24: the way back — "text ac kapa, light ac kapa".
        const i = d.neonSign.panelIndex ?? 0;
        const board = d.backdropItems[i];
        if (!board || board.type === "open_arch_frame" || board.type === "shimmer_wall" || board.type === "balloon_ring") return null;
        return (
          <div className="bz-ex-swap">
            <button type="button" className="bz-ex-notext alt" onClick={() => patchDecor({
              backdropItems: d.backdropItems.map((it, k) => (k === i ? { ...it, text: { ...it.text, enabled: true, value: (d.neonSign?.text ?? "").trim() || it.text.value } } : it)),
              neonSign: { ...d.neonSign!, enabled: false },
            })}>Use printed text instead of the neon</button>
          </div>
        );
      })()}
      {d.neonSign?.enabled && (
        <div className="bz-ex-more">
          <div className="bz-st-presets">
            {NEON_SIGN_PRESETS.map((phrase) => (
              <button key={phrase} type="button" className={`bz-st-chip ${d.neonSign?.text === phrase ? "on" : ""}`}
                onClick={() => patchDecor({ neonSign: { enabled: true, text: phrase, panelIndex: d.neonSign?.panelIndex ?? 0 } })}>
                {phrase}
              </button>
            ))}
          </div>
          {/* On a two-piece setup the customer picks which board carries the
              sign; an open arch frame has no face for one, so it is not offered. */}
          {(() => {
            // Only boards without printed lettering (see neonFreeBoards).
            const neonEligible = neonFreeBoards;
            if (neonEligible.length < 2) return null;
            return (
              <div className="bz-st-presets">
                <span className="bz-ex-mini">Which backdrop?</span>
                {neonEligible.map(({ it, i }) => (
                  <button key={it.id} type="button" className={`bz-st-chip ${(d.neonSign?.panelIndex ?? 0) === i ? "on" : ""}`}
                    onClick={() => patchDecor({ neonSign: { enabled: true, text: d.neonSign?.text ?? "Happy Birthday", panelIndex: i } })}>
                    {`${i === 0 ? "Left" : "Right"} · ${TYPE_LABEL[it.type] ?? it.type}`}
                  </button>
                ))}
              </div>
            );
          })()}
          <input type="text" className="bz-ex-input" value={d.neonSign?.text ?? ""} maxLength={40} placeholder="Or type your own"
            aria-label="Neon sign text"
            onChange={(e) => patchDecor({ neonSign: { enabled: true, text: e.target.value.slice(0, 40), panelIndex: d.neonSign?.panelIndex ?? 0 } })} />
        </div>
      )}
    </section>
    {d.neonSign?.enabled ? null : plinthsCard}
    </div>
  </div>
</div>
  );
}
