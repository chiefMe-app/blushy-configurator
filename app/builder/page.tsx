"use client";

// Fonts (Kalam, Caveat, DM Sans) are loaded once in app/layout.tsx.

import { useEffect, useMemo, useRef, useState } from "react";
import { getThemeGraphicPresets } from "@/lib/themeCatalog";
import {
  EVENT_TYPES,
  THEMES,
  PACKAGES,
  BACKDROP_SHAPES,
  ARCH_SIZES,
  RECT_SIZES,
  makeBackdropItem,
  BALLOON_STYLES,
  PLINTH_SIZES,
  CUTOUT_SETS,
  CUTOUT_STANDEE_OPTIONS,
emptyCutoutStandees,
emptyCutoutQuantities,
normalizeCutouts,
type CutoutSelection,
cutoutPrice,
cutoutTotalCount,
  BACKDROP_PRINTS,
  GRAPHIC_STYLES,
  FONT_STYLES,
  TEXT_SIZES,
  TEXT_COLORS,
  DEFAULT_TEXT_VALUE,
  themeTextColor,
  resolveTextColorHex,
  isCustomTextColor,
  ADDONS,
  CAKE_TABLE_PRICE,
  PER_BACKDROP,
  defaultConfig,
  themeById,
  NEON_SIGN_PRICE,
  GARLAND_FLORALS_PRICE,
  NUMBER_LIGHT_PRICE,
  FOIL_NUMBER_BUNCH_PRICE,
  FOIL_NUMBER_COLOURS,
  foilNumberColour,
  plinthsTotal,
  packageById,
  priceBreakdown,
  formatAED,
  SERVICE_PACKAGES,
  servicePackageById,
  isAddOnRecommended,
  hexToRgbTriplet,
  softTriplet,
  type CutoutStandeeItem,
  type BuilderConfig,
  type DecorConfig,
  type VenueDetails,
  type CustomerDetails,
  type AddOnId,
  type EventTypeId,
  type ThemeId,
  type PackageId,
  type ServicePackageId,
  type BalloonStyleId,
  type BackdropShapeId,
  type BackdropItem,
  type BackdropItemText,
  type BackdropItemGraphic,
  type ArchSizeId,
  type RectSizeId,
  type PlinthSize,
  type CutoutPosition,
  type BackdropPrintType,
  type GraphicStyle,
  type FontStyle,
  type TextColor,
  type TextAlign,
  SHIMMER_COLORS,
  SHIMMER_COLOR_HEX,
  NEON_SIGN_PRESETS,
  type ShimmerColorId,
  DEFAULT_BACKDROP_COLOR,
  backdropSwatchesForTheme,
  BALLOON_RING_STYLES,
} from "@/lib/config";
import { SEMPERTEX_CATALOG } from "@/lib/sempertexCatalog";
import { getThemeCatalogEntry, FALLBACK_GRAPHIC_PRESETS, getThemeCutoutPresets } from "@/lib/themeCatalog";

import { SETUP_LAYOUT_TEMPLATES, inferSetupLayoutTemplateIdFromBackdropItems } from "@/lib/setupLayoutCatalog";
import SetupPreview, { useSetupPreview, type FinalRenderState } from "@/components/SetupPreview";
import {
  MAX_BACKDROP_ITEMS, SERIF, DC, STEPS, STEP_COPY, MAX_STANDEES, COMING_SOON_EVENTS, DECOR_STEP_COPY,
  DECOR_TABS, THEME_GROUPS, SETUP_ICON, THEME_SETUP_PREVIEW, THEME_PRINT_SUGGESTIONS, PLINTH_SHORT,
  getThemeDefault,
} from "@/components/builder/constants";
import { OptionSample, SetupMiniPreview, Dash, StepShell, ChoiceRow } from "@/components/builder/ui";
import { useDecorStep, type DecorStepProps, type DecorCtx } from "@/components/builder/decor/useDecorStep";
import ExtrasTab from "@/components/builder/decor/ExtrasTab";
import EventStep from "@/components/builder/steps/EventStep";
import ThemeStep from "@/components/builder/steps/ThemeStep";
import PackageStep from "@/components/builder/steps/PackageStep";
import AddOnsStep from "@/components/builder/steps/AddOnsStep";
import VenueStep from "@/components/builder/steps/VenueStep";
import ReviewStep from "@/components/builder/steps/ReviewStep";

import StepNavigation from "@/components/StepNavigation";
import OptionCard from "@/components/OptionCard";
import PackageCard from "@/components/PackageCard";
import AddOnCard from "@/components/AddOnCard";
import Sprinkles from "@/components/design/Sprinkles";
import { PieceDiagram } from "@/components/design/LiveSketch";
import VenueDetailsForm from "@/components/VenueDetailsForm";
import ReviewSummary from "@/components/ReviewSummary";

type View = "configure" | "success";

interface SubmitResult {
  designId: string;
  total: number;
}

export default function ConfigurePage() {
  const [config, setConfig] = useState<BuilderConfig>(defaultConfig());
  const [step, setStep] = useState(0);
  // Which of the Decor step's four tabs is open.
  const [decorTab, setDecorTab] = useState(0);
  // 2026-10-24: the backdrop piece the Style tab is styling — kept here so the
  // live sketch in the preview can outline it.
  const [stylePieceId, setStylePieceId] = useState<string | null>(null);
  // Which list the theme was picked from, so Space (in both) ticks only there.
  const [themeGroup, setThemeGroup] = useState<"girl" | "boy" | null>(null);
  // The landing page links straight to the Theme step (/builder?step=theme).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("step");
    if (p === "theme") setStep(1);
  }, []);
  const [view, setView] = useState<View>("configure");

  // Auto-generating photorealistic preview (debounced, server-side fal.ai).
  const preview = useSetupPreview(config);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [customThemeText, setCustomThemeText] = useState("");
  const [showCustomThemeInput, setShowCustomThemeInput] = useState(false);

  // Tracks the live Final Design Render's state so the Decor step's footer CTA
  // can point the user at the render card instead of letting them continue
  // without ever having generated one.
  const [finalRenderState, setFinalRenderState] = useState<FinalRenderState>({
    hasRender: false, isStale: false, generating: false,
  });
  const [generateFinalRender, setGenerateFinalRender] = useState<(() => void) | null>(null);

  const theme = themeById(config.theme) ?? THEMES[0];
  // 2026-10-22 redesign: the interface stays in Blushy brand pink whatever the
  // theme (app/globals.css sets --accent); the theme's own accent is product
  // data and is still used for "Theme accent" lettering.
  const accentStyle = useMemo(() => ({}) as React.CSSProperties, []);
  void hexToRgbTriplet; void softTriplet;

  // ---- mutation helpers ----------------------------------------------------
  function patchDecor(patch: Partial<DecorConfig>) {
    setConfig((c) => ({ ...c, decor: { ...c.decor, ...patch } }));
  }
  function patchVenue(patch: Partial<VenueDetails>) {
    setConfig((c) => ({ ...c, venue: { ...c.venue, ...patch } }));
  }
  function patchCustomer(patch: Partial<CustomerDetails>) {
    setConfig((c) => ({ ...c, customer: { ...c.customer, ...patch } }));
  }

  function setEventType(id: EventTypeId) {
    setConfig((c) => ({ ...c, eventType: id }));
  }
  /** Selecting a theme pre-fills backdrop + balloon colors (overridable). */
  function setTheme(id: ThemeId) {
    const t = themeById(id);
    // 2026-10-24: standees belong to a theme — Elsa stayed on a Barbie party.
    // Characters the new theme does not offer are dropped.
    const themeAssetIds = new Set([
      ...(getThemeCutoutPresets(id) ?? []).map((p) => p.assetId),
      ...getThemeGraphicPresets(id).map((p) => p.assetId ?? p.id),
    ]);
    const keepCutouts = (cut: CutoutSelection): CutoutSelection => {
      const sel = cut.selectedAssets ?? [];
      const next = sel.filter((a) => themeAssetIds.has(a.assetId));
      return next.length === sel.length ? cut : normalizeCutouts({ ...cut, selectedAssets: next });
    };
    setConfig((c) => ({
      ...c,
      theme: id,
      themeSelected: true,
      decor: t
        ? {
            ...c.decor,
            // Theme drives the balloon palette only — boards stay white
            // unless the customer changes them (see DEFAULT_BACKDROP_COLOR).
            // Switching theme must not silently re-tint a board the customer
            // has already chosen a colour for, so an existing choice is kept.
            backdropColor: c.decor.backdropColor || DEFAULT_BACKDROP_COLOR,
            balloonColors: t.balloonColors.slice(0, 5),
            cutouts: c.theme === id ? c.decor.cutouts : keepCutouts(c.decor.cutouts),
            // 2026-10-22: lettering still in the old theme's colour follows
            // the new theme; a colour the customer picked themselves stays.
            backdropItems: c.decor.backdropItems.map((it) =>
              it.text?.color === themeTextColor(c.theme)
                ? { ...it, text: { ...it.text, color: themeTextColor(id) } }
                : it),
          }
        : c.decor,
    }));
  }
  /**
   * Selecting a service package only updates the service level -it never
   * touches the user's design (backdropItems, colors, text, graphics, etc.).
   */
  function setServicePackage(id: ServicePackageId) {
    setConfig((c) => ({ ...c, servicePackageId: id }));
  }

  function toggleAddOn(id: AddOnId) {
    setConfig((c) => {
      const exists = c.addOns.find((a) => a.id === id);
      return {
        ...c,
        addOns: exists
          ? c.addOns.filter((a) => a.id !== id)
          : [...c.addOns, { id, options: {} }],
      };
    });
  }
  function setAddOnOption(id: AddOnId, key: string, value: string) {
    setConfig((c) => ({
      ...c,
      addOns: c.addOns.map((a) =>
        a.id === id ? { ...a, options: { ...a.options, [key]: value } } : a
      ),
    }));
  }

  // ---- submit --------------------------------------------------------------
  async function submit() {
    setSubmitting(true);
    setSubmitError(null);

    const total = priceBreakdown(config).total;
    const payload = {
      eventType: config.eventType,
      theme: config.theme,
      // 2026-10-25: was missing, so the server priced orders without the
      // theme. The server now charges the theme for any valid theme anyway
      // (app/api/orders/route.ts); this keeps the body a full priced config.
      themeSelected: config.themeSelected,
      package: config.package,
      // The Package step (step 3) only ever writes servicePackageId — config.package
      // is a legacy field nothing sets anymore, permanently stuck at its "mini"
      // default. Omitting servicePackageId here meant the order route's
      // server-side computeTotal() couldn't see which service tier was chosen and
      // silently fell back to the cheapest one (Design Only) for every order,
      // regardless of what the customer picked and saw priced on the Review step.
      servicePackageId: config.servicePackageId,
      decor: config.decor,
      addOns: config.addOns,
      venue: {
        ...config.venue,
        // Files can't be JSON-serialized; send metadata only (no storage yet).
        photos: config.venue.photos.map((f) => ({ name: f.name, size: f.size })),
      },
      customer: config.customer,
      estimatedTotal: total,
    };

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      // Route logs payload if no table is configured -still treat as success.
      const designId: string =
        data?.order?.id ??
        data?.designId ??
        `BLW-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      if (!res.ok && res.status >= 500 && !data?.designId) {
        // Hard failure (e.g. Supabase configured but errored)
        throw new Error(data?.error ?? "Could not submit request");
      }
      setResult({ designId, total });
      setView("success");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not submit request");
    } finally {
      setSubmitting(false);
    }
  }

  // =========================================================================
  // SUCCESS SCREEN
  // =========================================================================
  if (view === "success" && result) {
    return (
      <main style={accentStyle} className="mx-auto min-h-screen max-w-xl px-4 pb-16">
        <div className="py-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-3xl">
            
          </div>
          <h1 className="text-2xl font-bold">Request received!</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-black/60">
            Your Blushy setup request has been received. We&apos;ll review your design and
            confirm the final quote.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
          <div className="p-4 pb-0">
            <SetupPreview
              config={config}
              status={preview.status}
              imageUrl={preview.imageUrl}
              isIncremental={preview.isIncremental}
              onRegenerate={preview.regenerate}
              showControls={false}
            />
          </div>
          <div className="space-y-4 p-5">
            <div className="flex items-center justify-between rounded-xl bg-accent-soft/50 px-4 py-3">
              <div className="flex flex-col">
                <span className="text-[11px] uppercase tracking-wide text-black/45">
                  Design ID
                </span>
                <span className="font-mono text-sm font-semibold">{result.designId}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[11px] uppercase tracking-wide text-black/45">
                  Estimated total
                </span>
                <span className="text-lg font-bold text-accent">
                  AED {formatAED(result.total)}
                </span>
              </div>
            </div>
            <p className="rounded-xl bg-black/[0.03] p-3 text-center text-sm text-black/65">
              [phone] We will contact you on WhatsApp to confirm venue, availability and final quote.
            </p>
          </div>
        </div>
      </main>
    );
  }

  // =========================================================================
  // CONFIGURE — 2026-10-22 "Sparkly party in minutes" redesign
  // (design-reference/Blushy_Sparkly_Party_All_Steps_Matching_Landing.html).
  // Layout and presentation only: every handler, state value, validation
  // rule and the render/price logic below is the one that was here before.
  // =========================================================================
  const isReview = step === STEPS.length - 1;
  const canSubmit =
    config.customer.name.trim().length > 1 && config.customer.whatsapp.trim().length >= 7;

  // Decor step (index 2): don't let the user Continue past their decor choices
  // without ever having generated the Final Design Render — swap the CTA for
  // "Generate Render" and scroll them to the render card instead. Once a
  // non-stale render exists, the footer reverts to a normal Continue.
  const isDecorStep = step === 2;
  // 2026-10-24: what the live sketch draws besides the config itself — the
  // piece the Style tab is on (same default as the tab: the lettered piece),
  // and the chosen standees' pictures.
  const sketchItems = config.decor.backdropItems;
  const sketchActiveId = sketchItems.find((i) => i.id === stylePieceId)?.id
    ?? sketchItems.find((i) => !["shimmer_wall", "balloon_ring", "open_arch_frame"].includes(i.type) && i.text.enabled)?.id
    ?? sketchItems[0]?.id ?? null;
  const sketchCutouts = (config.decor.cutouts.selectedAssets ?? [])
    .map((a) => a.previewUrl || getThemeCutoutPresets(config.theme)?.find((p) => p.assetId === a.assetId)?.previewUrl || "")
    .filter(Boolean);
  const decorRenderReady = finalRenderState.hasRender && !finalRenderState.isStale;
  const triggerDecorGenerateRender = () => {
    document.getElementById("party-preview-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    generateFinalRender?.();
  };
  // 2026-10-23: a new Decor tab opens at the top of its options — the panel
  // scrolls on desktop, the page on phones and tablets.
  const firstDecorTab = useRef(true);
  useEffect(() => {
    if (firstDecorTab.current) { firstDecorTab.current = false; return; }
    document.querySelector<HTMLElement>(".bz-content")?.scrollTo({ top: 0 });
    if (window.innerWidth < 1024) {
      // Instant: a smooth scroll lands short when the new tab's pictures load mid-way.
      document.querySelector(".bz-decor-tabbar")?.scrollIntoView({ block: "start" });
    }
  }, [decorTab]);
  // The Decor step is split into four tabs (Backdrop, Style, Balloons,
  // Extras); Generate Render is offered once the customer reaches Extras.
  const onLastDecorTab = decorTab === DECOR_TABS.length - 1;
  const archUnsized = config.decor.backdropItems.some((i) => i.type === "arch" && !i.sizeId);

  const goToStep = (n: number) => {
    setStep(Math.max(0, Math.min(STEPS.length - 1, n)));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const copy = (step === 2 && DECOR_STEP_COPY[decorTab]) || STEP_COPY[step];
  const total = priceBreakdown(config).total;

  let nextLabel: React.ReactNode = "Keep going →";
  let onNext: () => void = () => goToStep(step + 1);
  let nextDisabled = false;
  if (step === 0) nextLabel = "Let’s go! →";
  if (step === 1) { nextDisabled = !config.themeSelected; }
  if (isDecorStep) {
    if (!onLastDecorTab) {
      nextLabel = `Next: ${DECOR_TABS[decorTab + 1].name} →`;
      onNext = () => setDecorTab(decorTab + 1);
    } else if (!decorRenderReady) {
      nextLabel = finalRenderState.hasRender ? "Regenerate render ✨" : "Generate render ✨";
      onNext = triggerDecorGenerateRender;
      nextDisabled = archUnsized;
    } else {
      nextLabel = "Continue to Package →";
    }
  }
  if (step === 5) nextLabel = "See my party →";
  if (isReview) { nextLabel = "Request Final Quote ✦"; onNext = submit; nextDisabled = !canSubmit; }
  const busy = submitting || (isDecorStep && finalRenderState.generating);

  return (
    <div className="bz-body" style={{ minHeight: "calc(100vh / var(--bz-zoom, 1))", background: "#fff" }}>
      <Sprinkles count={110} seed={7} />

      {/* Top bar: wordmark, step navigation, running total */}
      <header className="bz-topbar">
        <div className="bz-topbar-inner">
          <a href="/" className="bz-brand" aria-label="PartyMuse by Blushy — home">
            {/* 2026-10-23: the PartyMuse by Blushy logo replaces the "blushy BIRTHDAY BUILDER" wordmark. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="logo" src="/design/partymuse-logo.webp" alt="PartyMuse by Blushy" />
          </a>
          <nav className="bz-stepnav" aria-label="Builder steps">
            {STEPS.map((s, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <button key={s} type="button"
                  className={`bz-navstep ${active ? "active" : ""} ${done ? "done" : ""}`}
                  onClick={() => i <= step && goToStep(i)}
                  disabled={i > step}
                  aria-current={active ? "step" : undefined}
                  aria-label={`Go to ${s}`}>
                  <span className="n">{done ? "✓" : i + 1}</span>
                  <span className="label">{s}</span>
                </button>
              );
            })}
          </nav>
          <div className="bz-total">
            <div>
              <div className="word">Your party so far</div>
              <strong>AED {formatAED(total)}</strong>
            </div>
            <span className="bz-mini-pill">✦ party in progress</span>
          </div>
        </div>
      </header>

      <div className="bz-ticker"><span className="sprinkle">✳</span> sprinkle a little happy <span className="accent">on your big day!</span><span className="sprinkle">✳</span></div>

      <main className="bz-main">
        {/* Left: the balloon dog during Event and Theme, then the real AI render card */}
        <section className="bz-left" aria-label="Party concept preview">
          {step < 2 ? (
            <div className="bz-cake">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {/* 2026-10-23: a denser, brighter sprinkle field round the dog, as in the reference. */}
              <Sprinkles count={70} seed={3} scatter className="dog" />
              <img src="/design/balloon-dog-outline.webp" alt="Illustrated dalmatian holding a bunch of balloons" />
              <svg className="bz-doodle heart" viewBox="0 0 40 36" aria-hidden="true"><path d="M20 33C8 24 3 17 4 11C5 5 12 3 16 7L20 11L24 7C28 3 35 5 36 11C37 17 32 24 20 33Z" /></svg>
              <svg className="bz-doodle burst" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3V37M3 20H37M8 8L32 32M32 8L8 32" /></svg>
              <svg className="bz-doodle dash" viewBox="0 0 40 40" aria-hidden="true"><path d="M6 10L20 4M4 22L26 14M10 34L24 28" /></svg>
            </div>
          ) : (
            <>
              <SetupPreview
                config={config}
                status={preview.status}
                imageUrl={preview.imageUrl}
                isIncremental={preview.isIncremental}
                onRegenerate={preview.regenerate}
                onPatchDecor={patchDecor}
                // Generate is offered from the Extras tab on, and wherever a
                // render already exists (so it can be regenerated).
                showControls={step > 2 || onLastDecorTab || finalRenderState.hasRender}
                onFinalRenderStateChange={setFinalRenderState}
                onGenerateReady={(fn) => setGenerateFinalRender(() => fn)}
                // 2026-10-23: the theme's example photo of the selected setup shows until a render exists.
                emptyArt={isDecorStep ? THEME_SETUP_PREVIEW[config.theme]?.[inferSetupLayoutTemplateIdFromBackdropItems(config.decor.backdropItems) ?? ""] : undefined}
                emptyArtLabel={`${themeById(config.theme)?.name ?? "Theme"} example.`}
                emptyArtNote={isDecorStep && decorTab === 3 ? "Your render will update after generation to show your selected extras." : undefined}
                // 2026-10-24: from Style on, a live sketch of the choices (not a render).
                sketchFirst={isDecorStep && decorTab > 0}
                sketchActiveId={isDecorStep && decorTab === 1 && sketchItems.length > 1 ? sketchActiveId : null}
                sketchCutouts={sketchCutouts}
              />
              {isDecorStep && !finalRenderState.hasRender && (
                <div className="bz-little-note">
                  <svg viewBox="0 0 35 28" aria-hidden="true"><path d="M3 4Q6 23 29 16M21 11L30 16L23 23" /></svg>
                  <span>Finish the Extras tab, then tap <b>Generate render</b> to see your design.</span>
                </div>
              )}
            </>
          )}
        </section>

        {/* Right: the step itself */}
        <section className="bz-right" aria-label="Party configuration">
          <div className="bz-headbox">
            <div className="bz-step-tag">{copy.eyebrow}</div>
            <h1>{copy.heading[0]} <span>{copy.heading[1]}</span>
              <svg className="bz-h1-dash" viewBox="0 0 34 40" aria-hidden="true"><path d="M6 8L18 3M4 21H24M6 34L18 39" /></svg>
            </h1>
            <p>{copy.description}</p>
            <svg className="bz-wiggle" viewBox="0 0 155 24" aria-hidden="true"><path d="M3 14Q15 3 27 14T51 14T75 14T99 14T123 14T147 14" /></svg>
          </div>
          <div className="bz-step-progress"><span>STEP {step + 1} OF {STEPS.length}</span><span>{copy.progress}</span></div>
          <div className="bz-progress"><span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>

          <div className="bz-content">
            {step === 0 && <EventStep config={config} setEventType={setEventType} />}

            {step === 1 && <ThemeStep config={config} theme={theme} themeGroup={themeGroup} setTheme={setTheme} setThemeGroup={setThemeGroup} />}

            {step === 2 && (
              <DecorStep config={config} patchDecor={patchDecor} decorTab={decorTab} setDecorTab={setDecorTab}
                stylePieceId={stylePieceId} setStylePieceId={setStylePieceId}
                onGenerate={triggerDecorGenerateRender} renderReady={decorRenderReady}
                hasRender={finalRenderState.hasRender} generating={finalRenderState.generating}
                onContinue={() => goToStep(3)} />
            )}

            {step === 3 && <PackageStep config={config} setServicePackage={setServicePackage} />}

            {step === 4 && <AddOnsStep config={config} toggleAddOn={toggleAddOn} setAddOnOption={setAddOnOption} />}

            {step === 5 && <VenueStep config={config} patchVenue={patchVenue} patchCustomer={patchCustomer} />}

            {step === 6 && <ReviewStep config={config} canSubmit={canSubmit} submitError={submitError} />}
          </div>
        </section>
      </main>

      {/* Footer bar: Back · note · next action */}
      <footer className="bz-footer">
        <div className="bz-footer-inner">
          <button type="button" className="bz-back" onClick={() => goToStep(step - 1)} disabled={step === 0}>← Back</button>
          <div className="bz-footer-note">Small steps, big party energy <b>✳</b></div>
          <button type="button" className="bz-next" onClick={onNext} disabled={nextDisabled || busy}>
            {busy && <span className="bz-spinner" aria-hidden="true" />}
            {busy ? (submitting ? "Sending…" : "Generating…") : nextLabel}
          </button>
        </div>
      </footer>
    </div>
  );
}
// ---------------------------------------------------------------------------
// Step shells + decor controls
// ---------------------------------------------------------------------------


function DecorStep(props: DecorStepProps) {
  const ctx = useDecorStep(props);
  const {
    config, patchDecor, decorTab, setDecorTab, stylePieceId, setStylePieceId, onGenerate, renderReady,
    hasRender, generating, onContinue, setOpenCustomizeIds, showManualPieces, setShowManualPieces,
    sempertexIds, sempertexManual, showSempertexBrowser, setShowSempertexBrowser, sempertexQuery,
    setSempertexQuery, sempertexFilter, setSempertexFilter, sempertexExceeded, effectiveSempertexSelection,
    toggleSempertex, resetToThemePalette, d, theme, t, print, patchItem, patchItemText, patchItemGraphic,
    accent, card, nextCue, BackdropShapePreview, chip, toggleArchSize, toggleRound, toggleOtherType,
    applySetupTemplate, activeSetupTemplateId, TYPE_LABEL,
  } = ctx;
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
      {decorTab === 0 && (
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
      )}{/* == end 1 · Backdrop == */}

      {/* == 2 · STYLE (tab 02) — 2026-10-23 redesign: five numbered steps for
           one piece at a time (size, message, lettering, colours, graphic).
           Every control writes through the same patchItem / patchItemText /
           patchItemGraphic handlers and keeps the same sales rules as before;
           only the presentation changed. == */}
      {decorTab === 1 && (() => {
        const items = d.backdropItems;
        if (items.length === 0) {
          return (
            <div className="bz-st-empty">
              <p>Pick a backdrop first — then we&apos;ll style it together.</p>
              <button type="button" className="bz-decor-hint" onClick={() => setDecorTab(0)}>← Go to Backdrop</button>
            </div>
          );
        }

        const archCount = items.filter((i) => i.type === "arch").length;
        const hasHalf = items.some((i) => i.type === "half_arch");
        const isPrintable = (it: BackdropItem) => !["shimmer_wall", "balloon_ring", "open_arch_frame"].includes(it.type);
        const pieceName = (it: BackdropItem, idx: number) => {
          if (it.type === "arch") {
            const n = items.filter((i, k) => i.type === "arch" && k <= idx).length;
            return archCount > 1 ? (n === 1 ? "Main arch" : "Second arch") : hasHalf ? "Centre arch" : "Arch backdrop";
          }
          if (it.type === "half_arch") {
            return items.filter((i, k) => i.type === "half_arch" && k < idx).length === 0 ? "Left half arch" : "Right half arch";
          }
          return TYPE_LABEL[it.type] ?? it.type;
        };

        // The piece being styled: the one picked above, else the one carrying
        // the lettering (where the setup puts "Happy Birthday"), else the first.
        const picked = items.findIndex((i) => i.id === stylePieceId);
        const itemIdx = picked >= 0 ? picked : Math.max(0, items.findIndex((i) => isPrintable(i) && i.text.enabled));
        const item = items[itemIdx];
        const printable = isPrintable(item);

        // Sizes come from ARCH_SIZES / RECT_SIZES; which of them this setup
        // sells is the same rule as before — Triple Arch's centre is Medium,
        // Double Arch is Large then Medium, a lone arch is Large.
        type SizeOpt = { id: string; name: string; w: number; h: number; available: boolean };
        let sizeOpts: SizeOpt[];
        if (item.type === "arch") {
          const n = items.filter((i, k) => i.type === "arch" && k <= itemIdx).length;
          const allowed = hasHalf ? ["medium"] : archCount > 1 ? [n === 1 ? "large" : "medium"] : ["large"];
          sizeOpts = ARCH_SIZES.map((s) => ({ id: s.id, name: s.label.replace(" / Standard", ""), w: s.widthCm, h: s.heightCm, available: allowed.includes(s.id) }));
        } else if (item.type === "rect") {
          sizeOpts = RECT_SIZES.map((s) => ({ id: s.id, name: "Rectangle", w: s.widthCm, h: s.heightCm, available: true }));
        } else {
          sizeOpts = [{ id: "__fixed", name: "One size", w: item.widthCm, h: item.heightCm, available: true }];
        }
        const isSizeOn = (o: SizeOpt) => o.id === "__fixed" || item.sizeId === o.id;
        const pickSize = (o: SizeOpt) => {
          if (!o.available || o.id === "__fixed") return;
          patchItem(itemIdx, { sizeId: o.id as BackdropItem["sizeId"], widthCm: o.w, heightCm: o.h });
          setOpenCustomizeIds((prev) => { const s = new Set(prev); s.add(item.id); return s; });
        };
        const needsSize = item.type === "arch" && !item.sizeId;
        const maxH = Math.max(...sizeOpts.map((o) => o.h));
        const maxW = Math.max(...sizeOpts.map((o) => o.w));
        const sizeIcon = (o: SizeOpt) => {
          const on = isSizeOn(o);
          const fill = !o.available ? "#EFE5EA" : on ? "#FF5C93" : "#F8B6CD";
          const w = 30 * (o.w / maxW), h = 44 * (o.h / maxH), x = 22 - w / 2, top = 50 - h;
          switch (item.type) {
            case "round": case "balloon_ring": return <circle cx="22" cy="28" r="19" fill={item.type === "round" ? fill : "none"} stroke={fill} strokeWidth={item.type === "round" ? 0 : 5} />;
            case "rect": case "banner": case "shimmer_wall": return <rect x={x} y={top} width={w} height={h} rx="3" fill={fill} />;
            case "half_arch": return <path d={`M ${x},50 L ${x},${top + w} A ${w},${w} 0 0 1 ${x + w},${top} L ${x + w},50 Z`} fill={fill} />;
            case "open_arch_frame": return <path d={`M ${x},50 L ${x},${top + w / 2} A ${w / 2},${w / 2} 0 0 1 ${x + w},${top + w / 2} L ${x + w},50`} fill="none" stroke={fill} strokeWidth="5" />;
            default: return <path d={`M ${x},50 L ${x},${top + w / 2} A ${w / 2},${w / 2} 0 0 1 ${x + w},${top + w / 2} L ${x + w},50 Z`} fill={fill} />;
          }
        };

        // Prices are read from the product data, never typed in here.
        const textPrice = BACKDROP_PRINTS.find((p) => p.id === "name_only")?.price;
        const graphicPrice = BACKDROP_PRINTS.find((p) => p.id === "theme_print")?.price;
        const presets = getThemeCatalogEntry(config.theme)?.graphicPresets ?? FALLBACK_GRAPHIC_PRESETS;
        const textHex = resolveTextColorHex(item.text.color, theme.accent);
        const boardHex = item.color || d.backdropColor || "#FFFFFF";
        const boardSwatches = backdropSwatchesForTheme(theme);
        const sameHex = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
        const boardInList = boardSwatches.some((hex) => sameHex(hex, boardHex));
        const sampleText = item.text.value.trim() || DEFAULT_TEXT_VALUE;
        const FONT_FACE: Record<string, { family: string; weight: number; size: number; short: string }> = {
          // The faces the render prints (app/layout.tsx). 2026-10-25 (T0):
          // Italianno replaces Brittany Signature; a narrower script, so a
          // larger size shows it at the same width.
          script:  { family: "var(--bz-signature)", weight: 400, size: 28, short: "Script" },
          block:   { family: "var(--bz-bold)", weight: 400, size: 19, short: "Bold" },
          // 21 -> 18: Playfair's "Birthday" is wider than Georgia's and broke
          // as "Birthda / y" in the narrow phone card.
          elegant: { family: "var(--bz-serif)", weight: 400, size: 18, short: "Serif" },
        };
        const textColorName = isCustomTextColor(item.text.color)
          ? "Custom"
          : TEXT_COLORS.find((c) => c.id === item.text.color)?.label ?? "";

        const showMsg = printable && !needsSize;
        const showFont = showMsg && item.text.enabled;
        const showColors = !needsSize;
        const showGraphic = printable && !needsSize;
        let k = 1;
        const nMsg = showMsg ? ++k : 0;
        const nFont = showFont ? ++k : 0;
        const nColors = showColors ? ++k : 0;
        const nGraphic = showGraphic ? ++k : 0;
        // In the two-column grid only an odd last card spans both columns, so
        // a hidden step never leaves a hole beside the colours.
        const lastWide = k % 2 === 1;

        const sizeChip = (() => {
          const o = sizeOpts.find(isSizeOn);
          if (!o) return "Pick a size";
          return o.id === "__fixed" ? `${o.w} × ${o.h} cm` : o.name === "Rectangle" ? `${o.w} × ${o.h} cm` : o.name;
        })();

        const Head = ({ n, title, sub, optional }: { n: number; title: string; sub: string; optional?: boolean }) => (
          <div className="bz-st-head">
            <span className="num">{n}</span>
            <div>
              <h3>{title}{optional && <span className="opt"> (optional)</span>}</h3>
              <p>{sub}</p>
            </div>
          </div>
        );
        const Tick = () => <span className="bz-st-tick" aria-hidden="true">✓</span>;

        return (
          <div className="bz-st">
            {items.length > 1 && (
              // 2026-10-24: a small drawing of the setup instead of name pills —
              // the piece being designed is the dark one; tap another to switch.
              <div className="bz-st-pieces diagram">
                <PieceDiagram items={items} activeId={item.id} onPick={setStylePieceId}
                  labels={items.map((it, i) => pieceName(it, i))} />
                <div className="txt">
                  <span className="lbl">Now designing:</span>
                  <b className="name">{pieceName(item, itemIdx)}</b>
                  <p className="hint">Your setup has {items.length} pieces. Tap a shape to design it — the dark one is the piece you’re changing.</p>
                </div>
              </div>
            )}

            <div className="bz-st-grid">
            {/* 1 — Size */}
            <section className={`bz-st-sec c-pink ${needsSize ? "attn" : ""}`}>
              <Head n={1} title="Pick your size"
                sub={sizeOpts.length === 1 ? "Our standard size looks perfect for most celebrations." : "Choose the size that fits your space."} />
              <div className={`bz-st-opts sizes ${sizeOpts.length === 1 ? "single" : ""}`}>
                {sizeOpts.map((o) => {
                  const on = isSizeOn(o);
                  return (
                    <button key={o.id} type="button" disabled={!o.available} aria-pressed={on}
                      className={`bz-st-card size ${on ? "on" : ""}`} onClick={() => pickSize(o)}
                      title={o.available ? undefined : "Not part of this setup"}>
                      {on && <Tick />}
                      <svg viewBox="0 0 44 52" aria-hidden="true">{sizeIcon(o)}</svg>
                      <strong>{o.name}</strong>
                      <span>{o.w} × {o.h} cm</span>
                      {!o.available && <em>Not in this setup</em>}
                    </button>
                  );
                })}
              </div>
              {needsSize && <div className="bz-st-cue">Choose a size to unlock text, colours and graphics ✦</div>}
            </section>

            {/* 2 — Message */}
            {showMsg && (
              <section className="bz-st-sec c-yellow">
                <Head n={nMsg} title="Add your message" sub="Make it personal with a special message." />
                <div className="bz-st-body">
                  <div className="bz-st-opts yn">
                    <button type="button" aria-pressed={item.text.enabled}
                      className={`bz-st-yn ${item.text.enabled ? "on" : ""}`}
                      onClick={() => { if (!item.text.enabled) patchItemText(itemIdx, { enabled: true, ...(!item.text.value.trim() ? { value: DEFAULT_TEXT_VALUE, color: themeTextColor(config.theme) } : {}) }); }}>
                      <span className="radio" aria-hidden="true">{item.text.enabled ? "✓" : ""}</span>
                      Yes, add text
                      {textPrice != null && <span className="price">+AED {textPrice}</span>}
                    </button>
                    <button type="button" aria-pressed={!item.text.enabled}
                      className={`bz-st-yn ${!item.text.enabled ? "on" : ""}`}
                      onClick={() => { if (item.text.enabled) patchItemText(itemIdx, { enabled: false }); }}>
                      <span className="radio" aria-hidden="true">{!item.text.enabled ? "✓" : ""}</span>
                      No, keep it clean
                    </button>
                  </div>
                  {item.text.enabled && (
                    <div className="bz-st-input">
                      <span className="lbl">Your message</span>
                      <textarea rows={1} value={item.text.value} aria-label="Your message"
                        onChange={(e) => patchItemText(itemIdx, { value: e.target.value })}
                        placeholder="Type the name or message..." />
                      <span className="count">{item.text.value.length}</span>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* 3 — Lettering style: each card shows the real message, in its
                 colour, on the chosen backdrop colour. */}
            {showFont && (
              <section className="bz-st-sec c-green">
                <Head n={nFont} title="Pick your text style" sub="Choose a style for your message." />
                <div className="bz-st-opts fonts">
                  {FONT_STYLES.map((f) => {
                    const on = item.text.fontStyle === f.id;
                    const face = FONT_FACE[f.id] ?? FONT_FACE.block;
                    return (
                      <button key={f.id} type="button" aria-pressed={on}
                        className={`bz-st-card font ${on ? "on" : ""}`}
                        onClick={() => patchItemText(itemIdx, { fontStyle: f.id as FontStyle })}>
                        {on && <Tick />}
                        <span className="sample" data-face={f.id} style={{ background: boardHex, color: textHex, fontFamily: face.family, fontWeight: face.weight, fontSize: face.size }}>
                          {sampleText}
                        </span>
                        <strong>{face.short}</strong>
                      </button>
                    );
                  })}
                </div>
                {/* 2026-10-25 (T0): the script face changed (Brittany Signature,
                    personal-use licence, -> Italianno); say so rather than
                    switch it silently. */}
                {item.text.fontStyle === "script" && (
                  <p className="bz-bl-muted" style={{ margin: "8px 0 0" }}>Script lettering is set in Italianno.</p>
                )}
                {/* 2026-10-24: lettering size. */}
                <div className="bz-st-size" role="group" aria-label="Text size">
                  <span className="lbl">Text size</span>
                  {TEXT_SIZES.map((t) => {
                    const on = (item.text.size ?? "medium") === t.id;
                    return (
                      <button key={t.id} type="button" aria-pressed={on} className={on ? "on" : ""}
                        onClick={() => patchItemText(itemIdx, { size: t.id })}>
                        <span className="aa" style={{ fontSize: 11 + 5 * t.scale }} aria-hidden="true">Aa</span>{t.label}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 4 — Colours */}
            {showColors && (
              <section className={`bz-st-sec c-lilac ${lastWide && !showGraphic ? "wide" : ""}`}>
                <Head n={nColors} title={item.type === "balloon_ring" ? "Pick your ring style" : "Pick your colors"}
                  sub={item.type === "shimmer_wall" ? "Choose the sequin finish."
                    : item.type === "balloon_ring" ? "Choose how the hoop is dressed."
                    : showFont ? "Choose a backdrop color and text color." : "Choose a backdrop color."} />
                <div className="bz-st-colors">
                  {item.type === "balloon_ring" ? (
                    <div className="bz-st-opts rings">
                      {BALLOON_RING_STYLES.map((rs) => {
                        const on = (d.balloonRingStyle ?? "full") === rs.id;
                        return (
                          <button key={rs.id} type="button" aria-pressed={on} className={`bz-st-card ring ${on ? "on" : ""}`}
                            // Same coupling as before: the bare hoop drops the balloon tier, a wrapped hoop puts a garland back.
                            onClick={() => patchDecor(rs.id === "none"
                              ? { balloonRingStyle: rs.id, balloonStyle: "none" }
                              : { balloonRingStyle: rs.id, balloonStyle: d.balloonStyle === "none" ? "full" : d.balloonStyle })}>
                            {on && <Tick />}
                            <strong>{rs.label}</strong>
                            <span>{rs.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : item.type === "shimmer_wall" ? (
                    <div className="bz-st-group">
                      <span className="lbl">Shimmer color · <b>{SHIMMER_COLORS.find((sc) => sc.id === (d.shimmerColor ?? "silver"))?.label}</b></span>
                      <div className="bz-st-swatches">
                        {SHIMMER_COLORS.map((sc) => {
                          const on = (d.shimmerColor ?? "silver") === sc.id;
                          return (
                            <button key={sc.id} type="button" aria-pressed={on} aria-label={sc.label} title={sc.label}
                              className={`bz-st-sw ${on ? "on" : ""}`} style={{ background: SHIMMER_COLOR_HEX[sc.id] }}
                              onClick={() => patchDecor({ shimmerColor: sc.id })} />
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="bz-st-group">
                      <span className="lbl">Backdrop color</span>
                      <div className="bz-st-swatches">
                        {boardSwatches.map((hex) => (
                          <button key={hex} type="button" aria-pressed={sameHex(hex, boardHex)} aria-label={`Backdrop ${hex}`} title={hex}
                            className={`bz-st-sw ${sameHex(hex, boardHex) ? "on" : ""}`} style={{ background: hex }}
                            onClick={() => patchItem(itemIdx, { color: hex })} />
                        ))}
                        {/* The current colour, when it is not one of the theme swatches, shows here. */}
                        <label className={`bz-st-sw custom ${!boardInList ? "on" : ""}`} title={boardInList ? "Custom colour" : `Current colour ${boardHex}`}
                          style={!boardInList ? { background: boardHex } : undefined}>
                          <span aria-hidden="true">+</span>
                          <input type="color" aria-label="Custom backdrop colour" value={item.color || d.backdropColor || "#FFFFFF"}
                            onChange={(e) => patchItem(itemIdx, { color: e.target.value })} />
                        </label>
                      </div>
                    </div>
                  )}
                  {showFont && (
                    <div className="bz-st-group text">
                      <span className="lbl">Text color · <b>{textColorName}</b></span>
                      <div className="bz-st-swatches">
                        {TEXT_COLORS.map((c) => {
                          const on = item.text.color === c.id;
                          return (
                            <button key={c.id} type="button" aria-pressed={on} aria-label={c.label} title={c.label}
                              className={`bz-st-sw ${on ? "on" : ""}`}
                              style={{ background: c.id === "accent" ? theme.accent : c.swatch }}
                              onClick={() => patchItemText(itemIdx, { color: c.id as TextColor })} />
                          );
                        })}
                        <label className={`bz-st-sw custom ${isCustomTextColor(item.text.color) ? "on" : ""}`} title="Custom colour"
                          style={isCustomTextColor(item.text.color) ? { background: textHex } : undefined}>
                          <span aria-hidden="true">+</span>
                          <input type="color" aria-label="Custom text colour" value={textHex}
                            onChange={(e) => patchItemText(itemIdx, { color: e.target.value.toUpperCase() })} />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* 5 — Theme graphic */}
            {showGraphic && (
              <section className={`bz-st-sec c-blue ${lastWide ? "wide" : ""}`}>
                <Head n={nGraphic} title="Add a theme graphic" optional sub="Includes a printed illustration to make it extra special." />
                <div className="bz-st-body">
                  <div className="bz-st-opts yn">
                    <button type="button" aria-pressed={!item.graphic.enabled}
                      className={`bz-st-card graphic ${!item.graphic.enabled ? "on" : ""}`}
                      onClick={() => { if (item.graphic.enabled) patchItemGraphic(itemIdx, { enabled: false }); }}>
                      {!item.graphic.enabled && <Tick />}
                      <span className="ico" aria-hidden="true">⊘</span>
                      <strong>No graphic</strong>
                    </button>
                    <button type="button" aria-pressed={item.graphic.enabled}
                      className={`bz-st-card graphic ${item.graphic.enabled ? "on" : ""}`}
                      onClick={() => {
                        if (item.graphic.enabled) return;
                        if (!item.graphic.assetId) {
                          const first = presets[0];
                          patchItemGraphic(itemIdx, { enabled: true, theme: first.id, source: "preset", assetId: first.assetId });
                        } else {
                          patchItemGraphic(itemIdx, { enabled: true });
                        }
                      }}>
                      {item.graphic.enabled && <Tick />}
                      <span className="ico" aria-hidden="true">🎉</span>
                      <span>
                        <strong>Add graphic</strong>
                        {graphicPrice != null && <span className="price">+AED {graphicPrice}</span>}
                      </span>
                    </button>
                  </div>
                  {item.graphic.enabled && (
                    <div className="bz-st-presets" role="group" aria-label="Choose the print">
                      {presets.map((p) => (
                        <button key={p.id} type="button" title={p.desc} aria-pressed={item.graphic.assetId === p.assetId}
                          className={`bz-st-chip ${item.graphic.assetId === p.assetId ? "on" : ""}`}
                          onClick={() => patchItemGraphic(itemIdx, { theme: p.id, source: "preset", assetId: p.assetId })}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            </div>{/* end bz-st-grid */}

            {/* Live summary of the real selections */}
            <div className="bz-st-summary" aria-live="polite">
              <span className="lead"><span aria-hidden="true">♥</span> Your style{items.length > 1 ? ` · ${pieceName(item, itemIdx)}` : ""}:</span>
              <span className="bz-st-pill">{sizeChip}</span>
              {printable && (
                <span className="bz-st-pill">{item.text.enabled ? <>Tт {sampleText.length > 22 ? `${sampleText.slice(0, 21)}…` : sampleText}</> : "No text"}</span>
              )}
              {printable && item.text.enabled && <span className="bz-st-pill">✎ {FONT_FACE[item.text.fontStyle]?.short ?? item.text.fontStyle}</span>}
              {printable && item.text.enabled && (
                <span className="bz-st-pill"><i style={{ background: textHex }} />{textColorName}</span>
              )}
              {item.type === "shimmer_wall" && (
                <span className="bz-st-pill"><i style={{ background: SHIMMER_COLOR_HEX[d.shimmerColor ?? "silver"] }} />{SHIMMER_COLORS.find((sc) => sc.id === (d.shimmerColor ?? "silver"))?.label}</span>
              )}
              {item.type === "balloon_ring" && (
                <span className="bz-st-pill">{BALLOON_RING_STYLES.find((rs) => rs.id === (d.balloonRingStyle ?? "full"))?.label}</span>
              )}
              {printable && item.graphic.enabled && (
                <span className="bz-st-pill">🎉 {presets.find((p) => p.assetId === item.graphic.assetId)?.label ?? "Theme graphic"}</span>
              )}
              <button type="button" className="go" onClick={() => setDecorTab(2)}>Looks great! ›</button>
            </div>
          </div>
        );
      })()}{/* -"--"- end Style tab -"--"- */}

      {/* == 3 · BALLOONS (tab 03) ============================= */}
      {decorTab === 2 && (
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
      )}{/* -"--"- end Balloons tab -"--"- */}

      {/* == 4 · EXTRAS (tab 04) =============================== */}
      {/* == 4 · EXTRAS (tab 04) — 2026-10-23 redesign: five colour cards.
           Every control is the one that was here before (toggleCutoutAsset,
           patchDecor for florals / neon / number, setPlinthCount); prices come
           from the product data. == */}
      {decorTab === 3 && <ExtrasTab ctx={ctx} />}

      {/* == Tab footer: next tab, or Generate Render after Extras == */}
      <div className="bz-decor-footer">
        <span>✓ Saved as you go</span>
        {decorTab < DECOR_TABS.length - 1 ? (
          <button type="button" className="bz-decor-hint" onClick={() => setDecorTab(decorTab + 1)}>
            Next up: {DECOR_TABS[decorTab + 1].name} →
          </button>
        ) : renderReady ? (
          <button type="button" className="bz-decor-cta" onClick={onContinue}>Continue to Package →</button>
        ) : (
          <button type="button" className="bz-decor-cta" onClick={onGenerate}
            disabled={generating || d.backdropItems.some((i) => i.type === "arch" && !i.sizeId)}>
            {generating ? "Generating…" : hasRender ? "Regenerate render ✨" : "Generate render ✨"}
          </button>
        )}
      </div>
      <div className="bz-decor-note">✳ No need to scroll through every option — just switch tabs.</div>
    </div>
  );
}









