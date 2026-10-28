"use client";

// Fonts (Kalam, Caveat, DM Sans) are loaded once in app/layout.tsx.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  THEMES,
  themeById,
  defaultConfig,
  priceBreakdown,
  formatAED,
  hexToRgbTriplet,
  softTriplet,
} from "@/lib/config";
import { getThemeCutoutPresets } from "@/lib/themeCatalog";

import { inferSetupLayoutTemplateIdFromBackdropItems } from "@/lib/setupLayoutCatalog";
import SetupPreview, { useSetupPreview, type FinalRenderState } from "@/components/SetupPreview";
import {
  STEPS,
  STEP_COPY,
  DECOR_STEP_COPY,
  DECOR_TABS,
  THEME_SETUP_PREVIEW,
} from "@/components/builder/constants";
import EventStep from "@/components/builder/steps/EventStep";
import ThemeStep from "@/components/builder/steps/ThemeStep";
import PackageStep from "@/components/builder/steps/PackageStep";
import AddOnsStep from "@/components/builder/steps/AddOnsStep";
import VenueStep from "@/components/builder/steps/VenueStep";
import ReviewStep from "@/components/builder/steps/ReviewStep";
import DecorStep from "@/components/builder/decor/DecorStep";
import { useBuilderConfig } from "@/components/builder/useBuilderConfig";
import { useLocalDraft } from "@/components/builder/useLocalDraft";
import { useServerDraft } from "@/components/builder/useServerDraft";
import AccountMenu from "@/components/account/AccountMenu";
import SignInDialog from "@/components/account/SignInDialog";
import { takeAfterSignIn } from "@/lib/account";
import TableStep from "@/components/builder/table/TableStep";
import BackdropIntro from "@/components/builder/decor/BackdropIntro";
import TablePreview from "@/components/builder/table/TablePreview";

import Sprinkles from "@/components/design/Sprinkles";

type View = "configure" | "success";

interface SubmitResult {
  designId: string;
  total: number;
}

export default function ConfigurePage() {
  const {
    config, setConfig, patchDecor, patchVenue, patchCustomer, setEventType, setTheme,
    setServicePackage, toggleAddOn, setAddOnOption,
  } = useBuilderConfig();
  const [step, setStep] = useState(0);
  // Which of the Decor step's four tabs is open.
  const [decorTab, setDecorTab] = useState(0);
  // 2026-10-24: the backdrop piece the Style tab is styling — kept here so the
  // live sketch in the preview can outline it.
  const [stylePieceId, setStylePieceId] = useState<string | null>(null);
  // 2026-10-27 (F2): the Decor step in parts — the backdrop, then the kids'
  // table (then, in turn, welcome board, giveaways and helium balloons).
  const [decorPart, setDecorPart] = useState<"backdrop" | "table">("backdrop");
  const shownPart = useRef(decorPart);
  useEffect(() => {
    // Only when the part changes — not on arrival (effects can run twice then).
    if (shownPart.current === decorPart) return;
    shownPart.current = decorPart;
    document.querySelector<HTMLElement>(".bz-content")?.scrollTo({ top: 0 });
    if (typeof window !== "undefined" && window.innerWidth < 1024) document.querySelector(".bz-right")?.scrollIntoView({ block: "start" });
  }, [decorPart]);
  // Which list the theme was picked from, so Space (in both) ticks only there.
  const [themeGroup, setThemeGroup] = useState<"girl" | "boy" | null>(null);
  // The landing page links straight to the Theme step (/builder?step=theme).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("step");
    if (p === "theme") setStep(1);
  }, []);
  const [view, setView] = useState<View>("configure");

  // 2026-10-26: the design is kept on this device; a reload or a return visit
  // opens where the customer left off (the landing page's Theme link still
  // opens on Theme). Only design choices are stored.
  const draft = useLocalDraft({
    config, step, decorTab, enabled: view === "configure",
    onRestore: (d) => {
      setConfig(d.config);
      const toTheme = new URLSearchParams(window.location.search).get("step") === "theme";
      setStep(toTheme ? 1 : d.step);
      // The restored tab is not a tab change: no scroll.
      if (d.decorTab !== decorTab) firstDecorTab.current = true;
      setDecorTab(d.decorTab);
    },
  });
  // 2026-10-26 (0.3): the customer's party in the database — when the customer
  // presses Save (the footer button), never on its own. 2026-10-27: Save
  // needs an account; nobody signed in, it opens the sign-in window.
  const serverDraft = useServerDraft({ config, step, decorTab });
  // 2026-10-27 (0.5b): renders need an account too. One sign-in window, for
  // saving or for a render; back from signing in, that is done at once.
  const [signInFor, setSignInFor] = useState<"save" | "render" | "table-render" | null>(null);
  const askSignIn = (purpose: "save" | "render" | "table-render") => {
    draft.flush(); // the design must be here when they come back
    setSignInFor(purpose);
  };
  const onSave = async () => {
    if ((await serverDraft.save()) === "signin") askSignIn("save");
  };
  const [renderOnArrival, setRenderOnArrival] = useState(false);
  const [tableRenderOnArrival, setTableRenderOnArrival] = useState(false);
  useEffect(() => {
    // After the device copy is restored (useLocalDraft, above), in the same pass.
    const then = takeAfterSignIn();
    if (then === "save") serverDraft.saveOnArrival();
    if (then === "render") setRenderOnArrival(true);
    if (then === "table-render") { setDecorPart("table"); setTableRenderOnArrival(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const startOver = () => {
    draft.clear();
    serverDraft.forget();
    setConfig(defaultConfig());
    setStep(0);
    setDecorTab(0);
    setStylePieceId(null);
    setThemeGroup(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

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

  // Back from signing in to see a render: start it (above the success screen's
  // early return, like every hook here).
  useEffect(() => {
    if (!renderOnArrival || !generateFinalRender) return;
    setRenderOnArrival(false);
    document.getElementById("party-preview-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    generateFinalRender();
  }, [renderOnArrival, generateFinalRender]);

  const theme = themeById(config.theme) ?? THEMES[0];
  // 2026-10-22 redesign: the interface stays in Blushy brand pink whatever the
  // theme (app/globals.css sets --accent); the theme's own accent is product
  // data and is still used for "Theme accent" lettering.
  const accentStyle = useMemo(() => ({}) as React.CSSProperties, []);
  void hexToRgbTriplet; void softTriplet;

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
      // The request is sent; the next visit starts a new design.
      draft.clear();
      serverDraft.forget(); // the next design is a new one
      setView("success");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not submit request");
    } finally {
      setSubmitting(false);
    }
  }

  // Every hook stays above the success screen's early return: one below it
  // crashed the page as soon as a request was sent (2026-10-26).
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
  // The Decor step is split into four tabs (Backdrop, Style, Balloons,
  // Extras); Generate Render is offered once the customer reaches Extras.
  const onLastDecorTab = decorTab === DECOR_TABS.length - 1;
  const archUnsized = config.decor.backdropItems.some((i) => i.type === "arch" && !i.sizeId);

  const goToStep = (n: number) => {
    setStep(Math.max(0, Math.min(STEPS.length - 1, n)));
    draft.dismiss();
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onTable = step === 2 && decorPart === "table";
  // The backdrop is a choice too: asked first, and skippable.
  const backdropAsked = config.decor.backdropChoice === "yes";
  const onBackdropQuestion = step === 2 && decorPart === "backdrop" && !backdropAsked;
  const copy = onTable
    ? { eyebrow: "DECOR · PART 2 · TABLE SETUP", heading: ["Set the", "kids' table"] as [string, string], description: "Every piece on one page — we work out how many.", progress: "Table, linens, tableware and extras" }
    : (step === 2 && DECOR_STEP_COPY[decorTab]) || STEP_COPY[step];
  const total = priceBreakdown(config).total;

  let nextLabel: React.ReactNode = "Keep going →";
  let onNext: () => void = () => goToStep(step + 1);
  let nextDisabled = false;
  if (step === 0) nextLabel = "Let’s go! →";
  if (step === 1) { nextDisabled = !config.themeSelected; }
  if (onBackdropQuestion) {
    nextLabel = "Next: Table setup →";
    onNext = () => setDecorPart("table");
  } else if (isDecorStep && decorPart === "backdrop") {
    if (!onLastDecorTab) {
      nextLabel = `Next: ${DECOR_TABS[decorTab + 1].name} →`;
      onNext = () => setDecorTab(decorTab + 1);
    } else {
      // 2026-10-27: the render is optional ("extras'tan sonraki adıma geçebilmek
      // için illa generate render olmamalı") — it is offered beside this, in
      // the Extras tab and on the preview card. Next comes the kids' table.
      nextLabel = "Next: Table setup →";
      onNext = () => setDecorPart("table");
      nextDisabled = archUnsized;
    }
  }
  if (onTable) {
    nextLabel = config.table ? "Continue to Package →" : "Skip to Package →";
  }
  // Back walks the parts and tabs of Decor before leaving it.
  const onBack = () => {
    if (onTable) {
      setDecorPart("backdrop"); setDecorTab(DECOR_TABS.length - 1);
      return;
    }
    goToStep(step - 1);
  };
  if (step === 5) nextLabel = "See my party →";
  if (isReview) { nextLabel = "Request Final Quote ✦"; onNext = submit; nextDisabled = !canSubmit; }
  // A render in progress does not hold the customer on Decor any more.
  const busy = submitting;

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
          {/* 2026-10-26 (0.4): Sign in, or the customer's account. */}
          <AccountMenu />
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
              {onTable && <TablePreview config={config} setTable={(table) => setConfig((c) => ({ ...c, table }))}
                onSignInNeeded={() => askSignIn("table-render")}
                startNow={tableRenderOnArrival} onStarted={() => setTableRenderOnArrival(false)} />}
              {!onTable && config.decor.backdropChoice === "skip" && (
                <div className="bz-tb-preview"><div className="empty">No backdrop in this party — add one any time.</div></div>
              )}
              {/* The backdrop's preview stays mounted (its render is kept) while the table is on show. */}
              <div hidden={onTable || config.decor.backdropChoice === "skip"}>
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
                onSignInNeeded={() => askSignIn("render")}
                // 0.5c: the render kept in the account goes with the design (Save keeps it).
                onRenderStored={(savedRender) => patchDecor({ savedRender })}
                // 2026-10-23: the theme's example photo of the selected setup shows until a render exists.
                emptyArt={isDecorStep ? THEME_SETUP_PREVIEW[config.theme]?.[inferSetupLayoutTemplateIdFromBackdropItems(config.decor.backdropItems) ?? ""] : undefined}
                emptyArtLabel={`${themeById(config.theme)?.name ?? "Theme"} example.`}
                emptyArtNote={isDecorStep && decorTab === 3 ? "Your render will update after generation to show your selected extras." : undefined}
                // 2026-10-24: from Style on, a live sketch of the choices (not a render).
                sketchFirst={isDecorStep && decorTab > 0}
                sketchActiveId={isDecorStep && decorTab === 1 && sketchItems.length > 1 ? sketchActiveId : null}
                sketchCutouts={sketchCutouts}
              />
              {isDecorStep && !onTable && !finalRenderState.hasRender && (
                <div className="bz-little-note">
                  <svg viewBox="0 0 35 28" aria-hidden="true"><path d="M3 4Q6 23 29 16M21 11L30 16L23 23" /></svg>
                  <span>Want to see it for real? Tap <b>Generate render</b> on the Extras tab — or carry on without one.</span>
                </div>
              )}
              </div>
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
            {draft.restored && (
              <div className="bz-tip bz-restored" data-testid="draft-restored" role="status">
                <span className="icon" aria-hidden="true">✓</span>
                <span><b>Welcome back!</b> We kept your design on this device.</span>
                <button type="button" className="bz-restart" onClick={startOver}>Start over</button>
              </div>
            )}
            {step === 0 && <EventStep config={config} setEventType={setEventType} />}

            {step === 1 && <ThemeStep config={config} theme={theme} themeGroup={themeGroup} setTheme={setTheme} setThemeGroup={setThemeGroup} />}

            {step === 2 && (
              <div className="bz-parts-wrap">
                <span className="label">Your party, piece by piece</span>
                <div className="bz-parts" role="tablist" aria-label="Decor parts">
                  {([["backdrop", "Backdrop"], ["table", "Table setup"]] as const).map(([id, name], i) => (
                    <span key={id} style={{ display: "contents" }}>
                      {i > 0 && <span className="arrow" aria-hidden="true">→</span>}
                      <button type="button" role="tab" aria-selected={decorPart === id} className={decorPart === id ? "on" : ""}
                        onClick={() => setDecorPart(id)}><span className="n">{i + 1}</span>{name}</button>
                    </span>
                  ))}
                  {["Welcome board", "Giveaways", "Helium balloons"].map((name) => (
                    <span key={name} style={{ display: "contents" }}>
                      <span className="arrow" aria-hidden="true">→</span>
                      <span className="soon" aria-disabled="true">{name} <small>soon</small></span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {onBackdropQuestion && <BackdropIntro config={config} patchDecor={patchDecor} />}
            {step === 2 && decorPart === "backdrop" && backdropAsked && (
              <DecorStep config={config} patchDecor={patchDecor} decorTab={decorTab} setDecorTab={setDecorTab}
                stylePieceId={stylePieceId} setStylePieceId={setStylePieceId}
                onGenerate={triggerDecorGenerateRender} renderReady={decorRenderReady}
                hasRender={finalRenderState.hasRender} generating={finalRenderState.generating}
                onContinue={() => setDecorPart("table")} />
            )}
            {onTable && (
              <TableStep config={config}
                setTable={(table) => setConfig((c) => ({ ...c, table }))} />
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
          <button type="button" className="bz-back" onClick={onBack} disabled={step === 0}>← Back</button>
          {/* 2026-10-26: Save — the design goes to the database only when pressed. */}
          {serverDraft.available && config.themeSelected ? (
            <button type="button" className={`bz-save ${serverDraft.saved ? "done" : ""}`} data-testid="save-design"
              onClick={() => { void onSave(); }}
              disabled={serverDraft.saved || serverDraft.status === "saving" || serverDraft.status === "unavailable"}>
              {(() => {
                // Full label, and a short one for phones (blushy.css).
                const [full, short] = serverDraft.status === "saving" ? ["Saving…", "Saving…"]
                  : serverDraft.saved ? ["✓ Saved", "✓ Saved"]
                  : serverDraft.status === "unavailable" ? ["Saving is unavailable", "Unavailable"]
                  : serverDraft.status === "error" ? ["↻ Try saving again", "↻ Retry"]
                  : serverDraft.savedBefore ? ["♡ Save changes", "♡ Save"] : ["♡ Save my design", "♡ Save"];
                return <><span className="full">{full}</span><span className="short" aria-hidden="true">{short}</span></>;
              })()}
            </button>
          ) : (
            <div className="bz-footer-note">Small steps, big party energy <b>✳</b></div>
          )}
          <button type="button" className="bz-next" onClick={onNext} disabled={nextDisabled || busy}>
            {busy && <span className="bz-spinner" aria-hidden="true" />}
            {busy ? (submitting ? "Sending…" : "Generating…") : nextLabel}
          </button>
        </div>
      </footer>
      <SignInDialog open={signInFor !== null} purpose={signInFor ?? undefined} onClose={() => setSignInFor(null)} />
    </div>
  );
}
// ---------------------------------------------------------------------------
// Step shells + decor controls
// ---------------------------------------------------------------------------

