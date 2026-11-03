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
import TablePreview, { type TableRenderJob } from "@/components/builder/table/TablePreview";
import AdultTableStep from "@/components/builder/table/AdultTableStep";
import FinishedDesigns from "@/components/builder/FinishedDesigns";
import WelcomeStep from "@/components/builder/welcome/WelcomeStep";
import AdultTableSketch from "@/components/studio/table/AdultTableSketch";
import WelcomePreview from "@/components/builder/welcome/WelcomePreview";
import GiveawaysStep, { giveawaysSeed } from "@/components/builder/giveaways/GiveawaysStep";
import GiveawaysPreview from "@/components/builder/giveaways/GiveawaysPreview";
import { defaultGiveaways, giveawaysRenderKey } from "@/lib/studio/giveaways";
import type { AfterSignInAction } from "@/lib/account";
import { adultCounts, defaultAdultTable } from "@/lib/studio/adultTable";
import { defaultTableSetup } from "@/lib/studio/tableSetup";
import { defaultWelcomeBoard, welcomeRenderKey } from "@/lib/studio/welcomeBoard";
import { tableRenderKey } from "@/lib/studio/tableRender";
import { usePieceRender } from "@/components/builder/usePieceRender";
import { nodeJpeg, svgLayers } from "@/components/builder/nodeJpeg";

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
  // 2026-10-31: the table part holds the kids' table, then (once that is
  // finished or skipped) the grown-ups' table; the welcome board comes after.
  const [decorPart, setDecorPart] = useState<"backdrop" | "table" | "welcome" | "giveaways">("backdrop");
  const [tableView, setTableView] = useState<"kids" | "adults">("kids");
  const shownPart = useRef(`${decorPart}:${tableView}`);
  useEffect(() => {
    // Only when the part changes — not on arrival (effects can run twice then).
    if (shownPart.current === `${decorPart}:${tableView}`) return;
    shownPart.current = `${decorPart}:${tableView}`;
    document.querySelector<HTMLElement>(".bz-content")?.scrollTo({ top: 0 });
    if (typeof window !== "undefined" && window.innerWidth < 1024) document.querySelector(".bz-right")?.scrollIntoView({ block: "start" });
    // On a phone the parts strip scrolls sideways: the part now open comes into sight.
    const strip = document.querySelector<HTMLElement>(".bz-parts"), on = strip?.querySelector<HTMLElement>("button.on");
    if (strip && on) strip.scrollLeft = on.offsetLeft - strip.offsetLeft - 12;
  }, [decorPart, tableView]);
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
      const query = new URLSearchParams(window.location.search);
      const toTheme = query.get("step") === "theme";
      const part = query.get("part");
      setStep(toTheme ? 1 : part === "table" || part === "welcome" || part === "giveaways" ? 2 : d.step);
      // A saved table setup (2026-10-30) or welcome board (2026-10-31), opened from My designs.
      if (!toTheme && part === "table") { setDecorPart("table"); setTableView(d.config.table?.enabled ? "kids" : "adults"); }
      if (!toTheme && part === "welcome") setDecorPart("welcome");
      if (!toTheme && part === "giveaways") setDecorPart("giveaways");
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
  const [signInFor, setSignInFor] = useState<AfterSignInAction | null>(null);
  const askSignIn = (purpose: AfterSignInAction) => {
    draft.flush(); // the design must be here when they come back
    setSignInFor(purpose);
  };
  const onSave = async () => {
    if ((await serverDraft.save()) === "signin") askSignIn("save");
  };
  const [renderOnArrival, setRenderOnArrival] = useState(false);
  const [tableRenderOnArrival, setTableRenderOnArrival] = useState(false);
  const [welcomeRenderOnArrival, setWelcomeRenderOnArrival] = useState(false);
  const [giveawaysRenderOnArrival, setGiveawaysRenderOnArrival] = useState(false);
  useEffect(() => {
    // After the device copy is restored (useLocalDraft, above), in the same pass.
    const then = takeAfterSignIn();
    if (then === "save") serverDraft.saveOnArrival();
    if (then === "render") setRenderOnArrival(true);
    if (then === "table-render") { setDecorPart("table"); setTableRenderOnArrival(true); }
    if (then === "welcome-render") { setDecorPart("welcome"); setWelcomeRenderOnArrival(true); }
    if (then === "giveaways-render") { setDecorPart("giveaways"); setGiveawaysRenderOnArrival(true); }
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

  // 2026-11-03 (the owner: "generate render yapmadan finalize … basılamasın … top view render alsın sadece …
  // burda da rendera zorlasın"): the kids' table's top view and the welcome board are each rendered before
  // they are finalized (components/builder/usePieceRender.ts); the renders show side by side at the end.
  const tablePlaceShot = useRef<(() => Promise<SVGSVGElement | null>) | null>(null);
  const tableKey = config.table?.enabled ? tableRenderKey(config.table, config.theme) : "";
  const tableRender = usePieceRender({
    endpoint: "/api/table-render", partKey: tableKey,
    kept: config.table?.render?.view === "top" ? { key: config.table.render.key, path: config.table.render.close } : undefined,
    // The one place as the customer sees it (2026-11-03: "live sketchin birebir aynı açısının renderı olsun").
    body: async () => {
      const node = await tablePlaceShot.current?.();
      return { table: config.table, theme: config.theme, view: "top", preview: node ? await nodeJpeg(node, 1200) : null };
    },
    onKept: (k) => setConfig((c) => (c.table ? { ...c, table: { ...c.table, render: { key: k.key, close: k.path, view: "top" } } } : c)),
    onSignInNeeded: () => askSignIn("table-render"),
  });
  const welcomeKey = config.welcomeBoard?.enabled ? welcomeRenderKey(config.welcomeBoard, config.theme, config.decor.balloonColors) : "";
  const welcomeRender = usePieceRender({
    endpoint: "/api/welcome-render", partKey: welcomeKey, kept: config.welcomeBoard?.render,
    // The live preview, as the customer sees it, is what is rendered.
    body: async () => {
      const node = document.querySelector<HTMLElement>("#welcome-preview-card .bz-wb-wait");
      return { board: config.welcomeBoard, theme: config.theme, balloons: config.decor.balloonColors, preview: node ? await nodeJpeg(node, 1400) : null };
    },
    onKept: (render) => setConfig((c) => (c.welcomeBoard ? { ...c, welcomeBoard: { ...c.welcomeBoard, render } } : c)),
    onSignInNeeded: () => askSignIn("welcome-render"),
  });
  // The giveaways (2026-11-03): their preview — the boxes on the kids' table, or on the board — rendered too.
  const giveawaysTableKey = config.giveaways?.place === "table" ? tableKey : "";
  const giveawaysKey = config.giveaways?.enabled ? giveawaysRenderKey(config.giveaways, config.theme, giveawaysTableKey, config.decor.balloonColors) : "";
  const giveawaysRender = usePieceRender({
    endpoint: "/api/giveaway-render", partKey: giveawaysKey, kept: config.giveaways?.render,
    body: async () => {
      // The scene without its boxes for the engine, and the boxes on their own, laid on its picture afterwards.
      const svg = document.querySelector<SVGSVGElement>("#giveaways-preview-card svg.bz-gv-art");
      const layers = svg ? await svgLayers(svg, 1400, '[data-part="giveaway-box"]') : null;
      return { giveaways: config.giveaways, theme: config.theme, tableKey: giveawaysTableKey, balloons: config.decor.balloonColors, preview: layers?.without ?? null, ...(layers?.only ? { boxes: layers.only } : {}) };
    },
    onKept: (render) => setConfig((c) => (c.giveaways ? { ...c, giveaways: { ...c.giveaways, render } } : c)),
    onSignInNeeded: () => askSignIn("giveaways-render"),
  });
  // Back from signing in for one of them: it starts.
  useEffect(() => {
    if (!tableRenderOnArrival || !tableKey) return;
    setTableRenderOnArrival(false);
    void tableRender.make();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableRenderOnArrival, tableKey]);
  useEffect(() => {
    if (!welcomeRenderOnArrival || !welcomeKey) return;
    setWelcomeRenderOnArrival(false);
    // The preview is drawn first.
    const t = setTimeout(() => void welcomeRender.make(), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [welcomeRenderOnArrival, welcomeKey]);
  const makeTableRender = () => { document.getElementById("table-preview-card")?.scrollIntoView({ behavior: "smooth", block: "start" }); void tableRender.make(); };
  useEffect(() => {
    if (!giveawaysRenderOnArrival || !giveawaysKey) return;
    setGiveawaysRenderOnArrival(false);
    const t = setTimeout(() => void giveawaysRender.make(), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [giveawaysRenderOnArrival, giveawaysKey]);
  const makeGiveawaysRender = () => { document.getElementById("giveaways-preview-card")?.scrollIntoView({ behavior: "smooth", block: "start" }); void giveawaysRender.make(); };
  const makeWelcomeRender = () => { document.getElementById("welcome-preview-card")?.scrollIntoView({ behavior: "smooth", block: "start" }); void welcomeRender.make(); };

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
      // 2026-10-31: was missing, so the server priced orders without the kids' table.
      ...(config.table ? { table: config.table } : {}),
      ...(config.adultTable ? { adultTable: config.adultTable } : {}),
      ...(config.welcomeBoard ? { welcomeBoard: config.welcomeBoard } : {}),
      ...(config.giveaways ? { giveaways: config.giveaways } : {}),
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

  // 2026-10-28 ("render aşırı uzun sürüyor"): the table's close-up renders in
  // the background; on any other step a note says how it is going, and once
  // the customer is back on the table it has been seen. (Above the success
  // screen's early return, like every hook.)
  const [tableJob, setTableJob] = useState<TableRenderJob | null>(null);
  const onTableNow = step === 2 && decorPart === "table";
  useEffect(() => { if (onTableNow && tableJob !== "loading") setTableJob(null); }, [onTableNow, tableJob]);
  useEffect(() => {
    if (tableRender.loading) setTableJob("loading");
    else setTableJob((j) => (j === "loading" ? (tableRender.error ? "error" : "ready") : j));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableRender.loading]);
  // 2026-11-03 (the owner: "kids table skipable olsun, default böyle gelsin"): the kids' table opens designed,
  // in the theme's own pieces (lib/studio/tableSetup.ts), with a way to skip it.
  useEffect(() => {
    if (onTableNow && !config.table) setConfig((c) => (c.table ? c : { ...c, table: defaultTableSetup(themeById(c.theme) ?? THEMES[0]) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onTableNow, config.table]);

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

  // A backdrop the customer is designing is finished with its render (2026-11-03); the Customized Themed set
  // is its own photo, and no render is made of it.
  const themedSet = config.decor.backdropItems.some((i) => i.type === "themed_set");
  const backdropFinished = config.decor.backdropChoice !== "yes" || themedSet || decorRenderReady;
  const onTable = step === 2 && decorPart === "table";
  const onWelcome = step === 2 && decorPart === "welcome";
  const onGiveaways = step === 2 && decorPart === "giveaways";
  const openTable = () => { goToStep(2); setDecorPart("table"); setTableView("kids"); };
  // The grown-ups' table is asked once the kids' table is finished or skipped (2026-10-31).
  const kidsDecided = !!config.table && (!config.table.enabled || !!config.table.done);
  const onAdults = onTable && tableView === "adults" && kidsDecided;
  const onKids = onTable && !onAdults;
  const setTable = (table: NonNullable<typeof config.table>) => setConfig((c) => ({ ...c, table }));
  const setAdultTable = (adultTable: NonNullable<typeof config.adultTable>) => setConfig((c) => ({ ...c, adultTable }));
  const setWelcomeBoard = (welcomeBoard: NonNullable<typeof config.welcomeBoard>) => setConfig((c) => ({ ...c, welcomeBoard }));
  const setGiveaways = (giveaways: NonNullable<typeof config.giveaways>) => setConfig((c) => ({ ...c, giveaways }));
  const finishKids = () => { if (config.table) setTable({ ...config.table, done: true }); setTableView("adults"); };
  // 2026-11-03 (the owner: "kids table skipable olsun, default böyle gelsin"): the table opens designed, in
  // the theme's own pieces, with a way to skip it.
  const skipKids = () => { setTable({ ...(config.table ?? defaultTableSetup(theme)), enabled: false, done: false }); setTableView("adults"); };
  const toWelcome = () => {
    // Leaving the grown-ups' question unanswered skips it.
    if (!config.adultTable) setAdultTable({ ...defaultAdultTable(themeById(config.theme) ?? THEMES[0]), enabled: false });
    setDecorPart("welcome");
  };
  const finishAdults = () => { if (config.adultTable) setAdultTable({ ...config.adultTable, done: true }); toWelcome(); };
  // 2026-11-02 (owner: "adult table setup skip edemiyorum"): no grown-ups' table, asked or not, kept to come back to.
  const skipAdults = () => { setAdultTable({ ...(config.adultTable ?? defaultAdultTable(themeById(config.theme) ?? THEMES[0])), enabled: false, done: false }); setDecorPart("welcome"); };
  // The whole table setup finished from anywhere in it, on to the welcome board ("finalize … sonrasında da
  // welcome board için olmalı aynı şekilde buton"): the kids' table finished, the grown-ups' too or skipped.
  const finishTables = () => {
    if (config.table?.enabled) setTable({ ...config.table, done: true });
    if (config.adultTable?.enabled) setAdultTable({ ...config.adultTable, done: true });
    toWelcome();
  };
  // After the welcome board, the giveaways (2026-11-03); leaving a question unanswered skips it.
  const toGiveaways = () => {
    if (!config.welcomeBoard) setWelcomeBoard({ ...defaultWelcomeBoard(themeById(config.theme) ?? THEMES[0]), enabled: false });
    setDecorPart("giveaways");
  };
  const toPackage = () => {
    if (!config.welcomeBoard) setWelcomeBoard({ ...defaultWelcomeBoard(themeById(config.theme) ?? THEMES[0]), enabled: false });
    if (!config.giveaways) setGiveaways({ ...defaultGiveaways(giveawaysSeed(config)), enabled: false });
    goToStep(3);
  };
  const finishWelcome = () => { if (config.welcomeBoard) setWelcomeBoard({ ...config.welcomeBoard, done: true }); toGiveaways(); };
  const finishGiveaways = () => { if (config.giveaways) setGiveaways({ ...config.giveaways, done: true }); toPackage(); };
  // Skipped from inside the part, no render needed (2026-11-03, the owner: "welcome board skip yapabilmeliyim").
  const skipWelcome = () => { if (config.welcomeBoard) setWelcomeBoard({ ...config.welcomeBoard, enabled: false, done: false }); setDecorPart("giveaways"); };
  const skipGiveaways = () => { if (config.giveaways) setGiveaways({ ...config.giveaways, enabled: false, done: false }); toPackage(); };
  // The backdrop is a choice too: asked first, and skippable.
  const backdropAsked = config.decor.backdropChoice === "yes";
  const onBackdropQuestion = step === 2 && decorPart === "backdrop" && !backdropAsked;
  const copy = onAdults
    ? { eyebrow: "DECOR · PART 2 · TABLE SETUP", heading: ["Set the", "grown-ups' table"] as [string, string], description: "For the parents and guests — every piece on one page.", progress: "Table, linens, tableware and decor" }
    : onTable
    ? { eyebrow: "DECOR · PART 2 · TABLE SETUP", heading: ["Set the", "kids' table"] as [string, string], description: "Every piece on one page — we work out how many.", progress: "Table, linens, tableware and extras" }
    : onWelcome
    ? { eyebrow: "DECOR · PART 3 · WELCOME BOARD", heading: ["Greet your", "guests"] as [string, string], description: "A printed board at the entrance, with your words.", progress: "Size, design, words and stand" }
    : onGiveaways
    ? { eyebrow: "DECOR · PART 4 · GIVEAWAYS", heading: ["Something to", "take home"] as [string, string], description: "A themed box for every child, on the table or on a board.", progress: "Box, contents, name and place" }
    : (step === 2 && DECOR_STEP_COPY[decorTab]) || STEP_COPY[step];
  const total = priceBreakdown(config).total;

  let nextLabel: React.ReactNode = "Keep going →";
  let onNext: () => void = () => goToStep(step + 1);
  let nextDisabled = false;
  // 2026-11-03 (the owner: "finalize the backdrop çıksın, next table setup çıkmasın, ikisi aynı"): where a part
  // ends in its own Finalize buttons, the footer has no Next of its own.
  let hideNext = false;
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
      // The Extras tab ends in Finalize the backdrop (DecorStep), once the render is made.
      hideNext = true;
    }
  }
  // 2026-10-31 (owner): each table is finished with a button, then on to the
  // grown-ups' table, then the welcome board — not straight to Package.
  // A long label and a short one for phones (blushy.css).
  const label = (full: string, short: string) => <><span className="full">{full}</span><span className="short" aria-hidden="true">{short}</span></>;
  // An enabled table or board ends in its own Finalize buttons (TableStep, AdultTableStep, WelcomeStep);
  // a skipped one goes on from the footer.
  if (onKids) {
    if (config.table?.enabled) hideNext = true;
    else { nextLabel = label("Next: Grown-ups' table →", "Next →"); onNext = () => setTableView("adults"); }
  }
  if (onAdults) {
    if (config.adultTable?.enabled) hideNext = true;
    else { nextLabel = config.adultTable ? label("Next: Welcome board →", "Next →") : label("Skip to Welcome board →", "Skip →"); onNext = toWelcome; }
  }
  if (onWelcome) {
    if (config.welcomeBoard?.enabled) hideNext = true;
    else { nextLabel = config.welcomeBoard ? label("Next: Giveaways →", "Next →") : label("Skip to Giveaways →", "Skip →"); onNext = toGiveaways; }
  }
  if (onGiveaways) {
    if (config.giveaways?.enabled) hideNext = true;
    else { nextLabel = config.giveaways ? label("Continue to Package →", "Package →") : label("Skip to Package →", "Skip →"); onNext = toPackage; }
  }
  // Back walks the parts and tabs of Decor before leaving it.
  const onBack = () => {
    if (onGiveaways) { setDecorPart("welcome"); return; }
    if (onWelcome) { setDecorPart("table"); setTableView(kidsDecided ? "adults" : "kids"); return; }
    if (onAdults) { setTableView("kids"); return; }
    if (onTable) {
      setDecorPart("backdrop"); setDecorTab(DECOR_TABS.length - 1);
      return;
    }
    // Back from Package lands on the giveaways.
    if (step === 3) { goToStep(2); setDecorPart("giveaways"); return; }
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
          {/* The table's preview stays mounted, so a close-up keeps rendering on the other steps. */}
          {onAdults && (
            <div className="bz-tb-preview" data-testid="adult-preview">
              <div className="head"><span className="title">✦ Your grown-ups&apos; table</span></div>
              {config.adultTable?.enabled ? <>
                <div className="bz-tb-wait"><AdultTableSketch a={config.adultTable} theme={theme} className="bz-tb-sketch" /></div>
                <p className="note">One table from above, to scale · {adultCounts(config.adultTable).tables} table{adultCounts(config.adultTable).tables > 1 ? "s" : ""} · {config.adultTable.guests} guests — a drawing, not a photo.</p>
              </> : <div className="empty">Add a grown-ups&apos; table to see it here.</div>}
            </div>
          )}
          {onWelcome && <WelcomePreview config={config} render={welcomeRender} onGenerate={makeWelcomeRender} />}
          {onGiveaways && <GiveawaysPreview config={config} render={giveawaysRender} onGenerate={makeGiveawaysRender} />}
          <div hidden={!onKids}>
            <TablePreview config={config} render={tableRender} onGenerate={makeTableRender} placeShot={tablePlaceShot} />
          </div>
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
              {!onTable && !onWelcome && !onGiveaways && config.decor.backdropChoice === "skip" && (
                <div className="bz-tb-preview"><div className="empty">No backdrop in this party — add one any time.</div></div>
              )}
              {/* The backdrop's preview stays mounted (its render is kept) while the table is on show. */}
              <div hidden={onTable || onWelcome || onGiveaways || config.decor.backdropChoice === "skip"}>
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
                // 2026-11-01: from the Backdrop tab too — the owner, on Unicorn's empty
                // preview: "preview olarak görmek gerekiyor backdrop seçince". A theme's
                // example photo stays one tap away (the Example toggle).
                sketchFirst={isDecorStep}
                sketchActiveId={isDecorStep && decorTab === 1 && sketchItems.length > 1 ? sketchActiveId : null}
                sketchCutouts={sketchCutouts}
              />
              {isDecorStep && !onTable && !onWelcome && !onGiveaways && !finalRenderState.hasRender && (
                <div className="bz-little-note">
                  <svg viewBox="0 0 35 28" aria-hidden="true"><path d="M3 4Q6 23 29 16M21 11L30 16L23 23" /></svg>
                  <span>See it for real: tap <b>Generate render</b> on the Extras tab — your backdrop is finalized with its render.</span>
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
            {!onTable && tableJob && (
              <div className={`bz-tip bz-tb-job ${tableJob}`} role="status" data-testid="table-render-job">
                {tableJob === "loading" ? (
                  <><span className="dots" aria-hidden="true"><i /><i /><i /></span>
                    <span><b>Your table close-up is on its way.</b> Carry on — we&apos;ll tell you here when it&apos;s ready.</span></>
                ) : tableJob === "ready" ? (
                  <><span className="icon" aria-hidden="true">✦</span>
                    <span><b>Your table close-up is ready.</b></span>
                    <button type="button" className="bz-restart" onClick={openTable}>See it</button></>
                ) : (
                  <><span className="icon" aria-hidden="true">!</span>
                    <span><b>Your table close-up didn&apos;t come out.</b> You can try again on the table.</span>
                    <button type="button" className="bz-restart" onClick={openTable}>Back to the table</button></>
                )}
              </div>
            )}
            {step === 0 && <EventStep config={config} setEventType={setEventType} />}

            {step === 1 && <ThemeStep config={config} theme={theme} themeGroup={themeGroup} setTheme={setTheme} setThemeGroup={setThemeGroup} />}

            {step === 2 && (
              <div className="bz-parts-wrap">
                <span className="label">Your party, piece by piece</span>
                <div className="bz-parts" role="tablist" aria-label="Decor parts">
                  {([["backdrop", "Backdrop"], ["table", "Table setup"], ["welcome", "Welcome board"], ["giveaways", "Giveaways"]] as const).map(([id, name], i) => {
                    const tablesDone = kidsDecided && !!config.adultTable && (!config.adultTable.enabled || !!config.adultTable.done);
                    const welcomeDone = !!config.welcomeBoard && (!config.welcomeBoard.enabled || !!config.welcomeBoard.done);
                    const done = id === "table" ? tablesDone : id === "welcome" ? welcomeDone
                      : id === "giveaways" ? !!config.giveaways && (!config.giveaways.enabled || !!config.giveaways.done) : false;
                    // 2026-11-03 ("render almadan o aşamaya geçemesin"): a part opens once the ones before it are finalized.
                    const open = id === "backdrop" || (backdropFinished && (id === "table" || (tablesDone && (id === "welcome" || welcomeDone))));
                    return (
                      <span key={id} style={{ display: "contents" }}>
                        {i > 0 && <span className="arrow" aria-hidden="true">→</span>}
                        <button type="button" role="tab" aria-selected={decorPart === id} className={`${decorPart === id ? "on" : ""} ${done ? "done" : ""}`}
                          disabled={decorPart !== id && !open} title={decorPart !== id && !open ? "Finalize the part before it first" : undefined}
                          onClick={() => setDecorPart(id)}><span className="n">{done ? "✓" : i + 1}</span>{name}</button>
                      </span>
                    );
                  })}
                  {["Helium balloons"].map((name) => (
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
                onContinue={() => setDecorPart("table")} continueBlocked={archUnsized} needsRender={!backdropFinished} />
            )}
            {onTable && (
              // The two tables, the grown-ups' only once the kids' is finished or skipped.
              <div className="bz-tb-tables" role="tablist" aria-label="Tables">
                <button type="button" role="tab" aria-selected={onKids} className={onKids ? "on" : ""} onClick={() => setTableView("kids")}>
                  {config.table?.done ? "✓ " : ""}Kids&apos; table
                </button>
                <button type="button" role="tab" aria-selected={onAdults} className={onAdults ? "on" : ""} disabled={!kidsDecided} data-testid="adults-tab"
                  title={kidsDecided ? undefined : "Finish the kids' table first"} onClick={() => setTableView("adults")}>
                  {config.adultTable?.done ? "✓ " : ""}Grown-ups&apos; table
                </button>
              </div>
            )}
            {onKids && (
              <TableStep config={config} setTable={setTable} onFinish={finishKids} onFinishTables={finishTables} onSkip={skipKids}
                render={tableRender} onGenerate={makeTableRender} />
            )}
            {onAdults && <AdultTableStep config={config} setAdultTable={setAdultTable} onFinish={finishAdults} onSkip={skipAdults} />}
            {onWelcome && <WelcomeStep config={config} setWelcomeBoard={setWelcomeBoard} onFinish={finishWelcome} onSkip={skipWelcome} render={welcomeRender} onGenerate={makeWelcomeRender} />}
            {onGiveaways && <GiveawaysStep config={config} setGiveaways={setGiveaways} onFinish={finishGiveaways} onSkip={skipGiveaways} render={giveawaysRender} onGenerate={makeGiveawaysRender} />}

            {/* 2026-11-02 (owner: "finalize olmuş table setup dizaynı, backdrop vs tek tek çıkmalı. Jpeg şeklinde"). */}
            {(step === 3 || step === 6) && <FinishedDesigns config={config}
              renderUrl={finalRenderState.hasRender && !finalRenderState.isStale ? finalRenderState.imageUrl : null}
              tableRenderUrl={tableRender.url} welcomeRenderUrl={welcomeRender.url} giveawaysRenderUrl={giveawaysRender.url} />}
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
          {hideNext ? <span className="bz-next-gap" aria-hidden="true" /> : (
            <button type="button" className="bz-next" onClick={onNext} disabled={nextDisabled || busy}>
              {busy && <span className="bz-spinner" aria-hidden="true" />}
              {busy ? (submitting ? "Sending…" : "Generating…") : nextLabel}
            </button>
          )}
        </div>
      </footer>
      <SignInDialog open={signInFor !== null} purpose={signInFor ?? undefined} onClose={() => setSignInFor(null)} />
    </div>
  );
}
// ---------------------------------------------------------------------------
// Step shells + decor controls
// ---------------------------------------------------------------------------

