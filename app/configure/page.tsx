"use client";

import { Plus_Jakarta_Sans, Cormorant_Garamond } from "next/font/google";
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["500", "600", "700", "800"] });
// Claude Design handoff: elegant serif display headings (self-hosted at build via next/font)
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["600", "700"] });

import { useEffect, useMemo, useState } from "react";
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
cutoutPrice,
cutoutTotalCount,
  BACKDROP_PRINTS,
  GRAPHIC_STYLES,
  FONT_STYLES,
  TEXT_COLORS,
  ADDONS,
  CAKE_TABLE_PRICE,
  PER_BACKDROP,
  defaultConfig,
  themeById,
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
  type ShimmerColorId,
} from "@/lib/config";
import { SEMPERTEX_CATALOG } from "@/lib/sempertexCatalog";
import { getThemeCatalogEntry, FALLBACK_GRAPHIC_PRESETS, getThemeCutoutPresets } from "@/lib/themeCatalog";
import { SETUP_LAYOUT_TEMPLATES, inferSetupLayoutTemplateIdFromBackdropItems } from "@/lib/setupLayoutCatalog";
import SetupPreview, { useSetupPreview } from "@/components/SetupPreview";

// Controlled render limit: at most 2 backdrop pieces per setup.
const MAX_BACKDROP_ITEMS = 2;

// Elegant serif for display headings — Cormorant Garamond per the Claude Design
// handoff, with system serif fallbacks.
const SERIF = `${cormorant.style.fontFamily}, Georgia, 'Times New Roman', serif`;

// ── Claude Design handoff tokens ─────────────────────────────────────────
const DC = {
  pageBg:    "#FDF6F8",
  cardBd:    "#F3D7E1",
  innerBg:   "#FDF9FA",
  rose:      "#D8548A",
  roseDeep:  "#C24373",
  plum:      "#46313B",
  muted:     "#97808A",
  faint:     "#B79AA6",
  chipBg:    "#FBE9EF",
  dashedBd:  "#E5BECF",
  ctaGrad:   "linear-gradient(135deg,#E36A97,#D8548A)",
  ctaShadow: "0 8px 22px rgba(216,84,138,.4)",
  cardShadow: "0 8px 24px rgba(216,84,138,.08)",
  selBorder: "2px solid #D8548A",
  selShadow: "0 0 0 5px #FBE9EF, 0 10px 26px rgba(216,84,138,.16)",
  amberBg:   "#FFF3D6",
  amberFg:   "#A0761E",
} as const;

// Playful mini illustration for setup layout cards — Claude Design proportions:
// bigger pastel shapes with gradient fills on a 120×64 stage, no text.
function SetupMiniPreview({ shapes }: { shapes: string[] }) {
  const els: JSX.Element[] = [];
  const drawShapes = shapes.filter(s => s !== "balloons");
  const hasBalloons = shapes.includes("balloons");
  const n = drawShapes.length;
  const BASE = 60; // floor line
  drawShapes.forEach((shape, i) => {
    const cx = n === 1 ? 60 : i === 0 ? 40 : 84;
    const key = `${shape}-${i}`;
    if (shape === "arch" || shape === "arch_large" || shape === "arch_small") {
      const w = shape === "arch_large" ? 38 : shape === "arch_small" ? 26 : 34;
      const top = shape === "arch_large" ? 8 : shape === "arch_small" ? 26 : 12;
      const r = w / 2;
      els.push(
        <path key={key} d={`M ${cx - r},${BASE} L ${cx - r},${top + r} A ${r},${r} 0 0 1 ${cx + r},${top + r} L ${cx + r},${BASE} Z`}
          fill={`url(#gradArch)`} />
      );
    } else if (shape === "round") {
      els.push(<circle key={key} cx={cx} cy={36} r={24} fill="url(#gradRound)" />);
    } else if (shape === "shimmer") {
      els.push(
        <g key={key}>
          <rect x={cx - 19} y={16} width={38} height={44} rx={4} fill="url(#gradShim)" />
          {[25, 34, 43, 52].map(y => <line key={`h${y}`} x1={cx - 19} y1={y} x2={cx + 19} y2={y} stroke="white" strokeWidth={1.2} opacity={0.65} />)}
          {[-9.5, 0, 9.5].map(dx => <line key={`v${dx}`} x1={cx + dx} y1={16} x2={cx + dx} y2={60} stroke="white" strokeWidth={1.2} opacity={0.65} />)}
        </g>
      );
    } else if (shape === "open_frame") {
      const r = 15;
      els.push(
        <path key={key} d={`M ${cx - r},${BASE} L ${cx - r},${24 + r} A ${r},${r} 0 0 1 ${cx + r},${24 + r} L ${cx + r},${BASE}`}
          fill="none" stroke="#E8A9C4" strokeWidth={5} strokeLinecap="round" />
      );
    }
  });
  if (hasBalloons) {
    els.push(
      <g key="balloons">
        <circle cx={80} cy={12} r={6} fill="#F7A7C8" />
        <circle cx={91} cy={19} r={4.5} fill="#C9E4F5" />
        <circle cx={98} cy={11} r={3.5} fill="#F9DFA9" />
      </g>
    );
  }
  return (
    <svg width={120} height={64} viewBox="0 0 120 64" aria-hidden="true">
      <defs>
        <linearGradient id="gradArch" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F3A9C6" /><stop offset="100%" stopColor="#E27BA4" />
        </linearGradient>
        <linearGradient id="gradRound" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#BFD9F2" /><stop offset="100%" stopColor="#93BCE3" />
        </linearGradient>
        <linearGradient id="gradShim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E3D5F5" /><stop offset="100%" stopColor="#CBB3E8" />
        </linearGradient>
      </defs>
      {els}
    </svg>
  );
}
import StepNavigation from "@/components/StepNavigation";
import OptionCard from "@/components/OptionCard";
import PackageCard from "@/components/PackageCard";
import AddOnCard from "@/components/AddOnCard";
import PriceSummary, { TotalBadge } from "@/components/PriceSummary";
import VenueDetailsForm from "@/components/VenueDetailsForm";
import ReviewSummary from "@/components/ReviewSummary";
import StickyBottomCTA from "@/components/StickyBottomCTA";

const STEPS = [
  "Event",
  "Theme",
  "Decor",
  "Package",
  "Add-ons",
  "Venue",
  "Review",
];

type View = "configure" | "success";

interface SubmitResult {
  designId: string;
  total: number;
}

export default function ConfigurePage() {
  const [config, setConfig] = useState<BuilderConfig>(defaultConfig());
  const [step, setStep] = useState(0);
  const [view, setView] = useState<View>("configure");

  // Auto-generating photorealistic preview (debounced, server-side fal.ai).
  const preview = useSetupPreview(config);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [customThemeText, setCustomThemeText] = useState("");
  const [showCustomThemeInput, setShowCustomThemeInput] = useState(false);

  const theme = themeById(config.theme) ?? THEMES[0];
  const accentStyle = useMemo(
    () =>
      ({
        ["--accent" as any]: hexToRgbTriplet(theme.accent),
        ["--accent-soft" as any]: softTriplet(theme.accent),
      }) as React.CSSProperties,
    [theme]
  );

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
    setConfig((c) => ({
      ...c,
      theme: id,
      themeSelected: true,
      decor: t
        ? {
            ...c.decor,
            backdropColor: t.backdropColors[0],
            balloonColors: t.balloonColors.slice(0, 5),
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
  // CONFIGURE
  // =========================================================================
  const isReview = step === STEPS.length - 1;
  const canSubmit =
    config.customer.name.trim().length > 1 && config.customer.whatsapp.trim().length >= 7;

  const Preview = (
    <div className="space-y-3">
      <SetupPreview
        config={config}
        status={preview.status}
        imageUrl={preview.imageUrl}
        isIncremental={preview.isIncremental}
        onRegenerate={preview.regenerate}
        onPatchDecor={patchDecor}
      />
      <PriceSummary config={config} className="hidden lg:block" />
    </div>
  );

  return (
    <main style={{ ...accentStyle, background: DC.pageBg }} className={`min-h-screen ${jakarta.className}`}>
      {/* Header — Claude Design: white translucent bar, serif wordmark, step pills */}
      <header className="sticky top-0 z-30 backdrop-blur" style={{ background: "rgba(255,255,255,.92)", borderBottom: `1px solid ${DC.cardBd}` }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-7 py-3.5">
          {/* Logo */}
          <div className="flex items-baseline gap-2">
            <span style={{ color: DC.rose, fontSize: 18, lineHeight: 1 }}>✦</span>
            <span style={{ fontSize: 26, fontWeight: 700, color: DC.plum, fontFamily: SERIF, lineHeight: 1 }}>Blushy</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: DC.rose, letterSpacing: "0.18em", textTransform: "uppercase" }}>Birthday Builder</span>
          </div>

          {/* Step navigation -centered pills */}
          <nav className="hidden lg:flex items-center gap-1.5">
            {STEPS.map((s, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <button
                  key={i}
                  onClick={() => i <= step && setStep(i)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "6px 13px",
                    borderRadius: 999, fontSize: 12, fontWeight: 600,
                    background: active ? DC.rose : done ? DC.chipBg : "#FFFFFF",
                    color: active ? "#FFFFFF" : done ? DC.roseDeep : DC.faint,
                    border: `1.5px solid ${active ? DC.rose : DC.cardBd}`,
                    cursor: i <= step ? "pointer" : "default",
                    transition: "all 0.15s",
                  }}
                >
                  <span style={{ fontSize: 10 }}>{done ? "✓" : i + 1}</span>
                  {s}
                </button>
              );
            })}
          </nav>

          {/* Total */}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, color: DC.faint, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>Your party so far</div>
            <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 22, color: DC.rose, lineHeight: 1.1 }}>AED {formatAED(priceBreakdown(config).total)}</div>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "24px 28px 0", display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
        {/* Left: preview rail — hero-width (~480px) on desktop, full-width when wrapped */}
        <div style={{ flex: "0 1 480px", minWidth: 320, maxWidth: 500 }}>
          <div className="lg:sticky" style={{ top: 76 }}>
            <div className="space-y-3.5">
              {/* Preview card — SetupPreview draws its own image + footer card */}
              <div>
                <SetupPreview
                  config={config}
                  status={preview.status}
                  imageUrl={preview.imageUrl}
                  isIncremental={preview.isIncremental}
                  onRegenerate={preview.regenerate}
                  onPatchDecor={patchDecor}
                />
              </div>
              <PriceSummary config={config} className="hidden lg:block" />
            </div>
          </div>
        </div>

        {/* Right: steps -flex 1, min 720px */}
        <div style={{ flex: "999 1 480px", minWidth: 0, paddingBottom: 120 }}>

          <div>
            {step === 0 && (
              <div>
                {/* Intro band */}
                {/* Typographic intro — no decorative icons (2026-07-20 product
                    direction: the pastel icon set read as unprofessional). */}
                <div style={{ marginBottom: 22 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.6px", textTransform: "uppercase", color: DC.faint }}>Step 1 — Occasion</div>
                  <div style={{ fontFamily: SERIF, fontSize: 27, fontWeight: 600, color: DC.plum, letterSpacing: "-0.3px", marginTop: 6, lineHeight: 1.15 }}>What are we celebrating?</div>
                  <div style={{ fontSize: 13, color: DC.muted, marginTop: 7, fontWeight: 500, maxWidth: 520, lineHeight: 1.55 }}>
                    We tailor every balloon, backdrop and styling suggestion to your occasion.
                  </div>
                </div>

                {/* Occasion cards — Birthday live, the rest on the roadmap */}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {EVENT_TYPES.map((e) => {
                    const sel = config.eventType === e.id;
                    const available = e.id === "birthday";
                    return (
                      <button key={e.id} type="button"
                        onClick={() => available && setEventType(e.id)}
                        disabled={!available}
                        aria-pressed={available ? sel : undefined}
                        className={available ? "transition hover:-translate-y-0.5" : ""}
                        style={{
                          position: "relative", textAlign: "left",
                          cursor: available ? "pointer" : "default",
                          borderRadius: 14, padding: "15px 16px", minHeight: 78,
                          border: sel && available ? "1.5px solid #D8548A" : "1px solid #ECE7E4",
                          background: available ? "white" : "#FBFAF9",
                          boxShadow: sel && available ? "0 0 0 3px #FBE9EF" : "0 2px 8px rgba(70,49,59,.05)",
                          opacity: available ? 1 : 0.62,
                        }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                          <span style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600, color: available ? DC.plum : "#9B8F94", lineHeight: 1.25 }}>{e.label}</span>
                          {available
                            ? sel && (
                                <span aria-hidden style={{ flexShrink: 0, marginTop: 3, width: 16, height: 16, borderRadius: "50%", background: DC.rose, color: "white", fontSize: 9, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>✓</span>
                              )
                            : (
                              <span style={{ flexShrink: 0, marginTop: 2, fontSize: 9, fontWeight: 600, letterSpacing: ".6px", textTransform: "uppercase", color: "#A99DA3", background: "#F2EEEC", border: "1px solid rgba(40,28,34,.05)", padding: "2px 7px", borderRadius: 20, whiteSpace: "nowrap" }}>Soon</span>
                            )}
                        </div>
                        <div style={{ fontSize: 11.5, color: available ? DC.muted : "#AFA4A9", marginTop: 3, lineHeight: 1.45 }}>{e.description}</div>
                      </button>
                    );
                  })}
                </div>

                {/* Bottom hint */}
                <div style={{ marginTop: 18, fontSize: 11.5, color: DC.faint, lineHeight: 1.55 }}>
                  More occasions are on the way — birthdays are where Blushy shines today.
                </div>
              </div>
            )}

            {step === 1 && (
              <StepShell title="Pick your party world">
                <p className="-mt-2 mb-3 text-[12.5px] font-medium" style={{ color: DC.muted, maxWidth: 520, lineHeight: 1.55 }}>
                  Pick one and we&apos;ll match the balloons, graphics and styling to it. You can change it anytime.
                </p>
                {!config.themeSelected && (
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5"
                    style={{ background: DC.chipBg, color: DC.roseDeep, fontSize: 11.5, fontWeight: 600 }}>
                    <span aria-hidden style={{ width: 5, height: 5, borderRadius: "50%", background: DC.rose, display: "inline-block" }}/>
                    Choose a theme to continue
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                  {THEMES.map((t) => {
                    const sel = config.themeSelected && config.theme === t.id;
                    // Theme cards are a compact name-first list (2026-07-20
                    // product direction: illustrated covers read as childish and
                    // made this step far too tall) — no icon or cover art per card.
                    return (
                      <button key={t.id} type="button" onClick={() => setTheme(t.id)} aria-pressed={sel}
                        className="relative flex w-full flex-col gap-2 px-3.5 py-3 text-left transition hover:-translate-y-0.5"
                        style={{
                          background: "white", borderRadius: 14,
                          border: sel ? "1.5px solid #D8548A" : "1px solid #ECE7E4",
                          boxShadow: sel ? "0 0 0 3px #FBE9EF" : "0 2px 8px rgba(70,49,59,.05)",
                        }}>
                        <div className="flex items-start justify-between gap-2">
                          <span className="truncate" style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 15.5, color: DC.plum, lineHeight: 1.25 }}>{t.name}</span>
                          {sel && (
                            <span aria-hidden className="mt-[3px] inline-flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: DC.rose }}>✓</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          {t.balloonColors.length > 0 && (
                            <div className="flex gap-[4px]">
                              {t.balloonColors.slice(0, 5).map((c, i) => <span key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: c, border: "1px solid rgba(40,28,34,.1)" }}/>)}
                            </div>
                          )}
                          <span className="shrink-0 text-[9.5px] font-medium tracking-wide" style={{ color: t.priceModifier > 0 ? DC.faint : "#5C9179" }}>
                            {t.priceModifier > 0 ? `+AED ${t.priceModifier}` : "Included"}
                          </span>
                        </div>
                      </button>
                    );
                  })}

                  {/* Custom Theme placeholder */}
                  <button type="button"
                    onClick={() => setShowCustomThemeInput(v => !v)}
                    className="relative flex w-full flex-col gap-2 rounded-2xl border border-dashed border-black/20 bg-white p-4 text-left transition hover:border-accent/40">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="8" stroke="#C084FC" strokeWidth="1.5" strokeDasharray="3 2"/><path d="M11 7v4M11 13v2" stroke="#C084FC" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        <span className="text-sm font-semibold text-black/70">Custom Theme</span>
                      </div>
                      <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-medium text-black/40">Coming soon</span>
                    </div>
                    <span className="text-xs leading-snug text-black/40">Describe your own theme for a fully personalized setup</span>
                    {showCustomThemeInput && (
                      <textarea
                        value={customThemeText}
                        onChange={e => setCustomThemeText(e.target.value)}
                        placeholder="e.g. Under the sea with teal and coral colors, starfish, seashells..."
                        onClick={e => e.stopPropagation()}
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-black/10 p-2 text-xs outline-none focus:border-accent/50"
                      />
                    )}
                  </button>
                </div>
              </StepShell>
            )}

            {step === 2 && (
              <div style={{ background: "white", borderRadius: 20, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", padding: 24 }}>
                <DecorStep config={config} patchDecor={patchDecor} />
              </div>
            )}

            {step === 3 && (
              <StepShell
                title="Choose your service package"
                subtitle="Your design is ready -now choose how you want to use it."
              >
                <p className="mb-5 rounded-xl bg-black/4 px-4 py-3 text-xs text-black/55">
                  Packages do not change your design. They define what you receive and how the setup is handled.
                </p>

                {/* Design Packages */}
                <div className="mb-6">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-black/35">
                    Design Packages
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    {SERVICE_PACKAGES.filter((p) => p.group === "design").map((p) => {
                      const selected = config.servicePackageId === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setServicePackage(p.id)}
                          className={`flex w-full flex-col gap-3 rounded-2xl border p-5 text-left transition ${
                            selected
                              ? "border-accent bg-accent-soft/60 shadow-sm"
                              : "border-black/10 bg-white hover:border-accent/40"
                          }`}
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-sm font-semibold">{p.name}</span>
                            <span className="text-sm font-bold text-accent">AED {formatAED(p.price)}</span>
                          </div>
                          <ul className="space-y-1.5">
                            {p.includes.map((line) => (
                              <li key={line} className="flex items-start gap-2 text-xs text-black/65">
                                <span className="mt-[3px] text-accent"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                                <span>{line}</span>
                              </li>
                            ))}
                          </ul>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Execution Packages */}
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-black/35">
                    Execution Packages
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    {SERVICE_PACKAGES.filter((p) => p.group === "execution").map((p) => {
                      const selected = config.servicePackageId === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setServicePackage(p.id)}
                          className={`flex w-full flex-col gap-3 rounded-2xl border p-5 text-left transition ${
                            selected
                              ? "border-accent bg-accent-soft/60 shadow-sm"
                              : "border-black/10 bg-white hover:border-accent/40"
                          }`}
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-sm font-semibold">{p.name}</span>
                            <span className="text-sm font-bold text-accent">AED {formatAED(p.price)}</span>
                          </div>
                          <ul className="space-y-1.5">
                            {p.includes.map((line) => (
                              <li key={line} className="flex items-start gap-2 text-xs text-black/65">
                                <span className="mt-[3px] text-accent"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                                <span>{line}</span>
                              </li>
                            ))}
                          </ul>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </StepShell>
            )}

            {step === 4 && (
              <StepShell title="Add experiences" subtitle="Optional extras for the day.">
                <div className="space-y-3">
                  {ADDONS.map((addon) => (
                    <AddOnCard
                      key={addon.id}
                      addon={addon}
                      selection={config.addOns.find((a) => a.id === addon.id)}
                      recommended={isAddOnRecommended(addon, config)}
                      onToggle={() => toggleAddOn(addon.id)}
                      onOption={(k, v) => setAddOnOption(addon.id, k, v)}
                    />
                  ))}
                </div>
              </StepShell>
            )}

            {step === 5 && (
              <StepShell title="Venue details">
                <VenueDetailsForm
                  venue={config.venue}
                  customer={config.customer}
                  onVenue={patchVenue}
                  onCustomer={patchCustomer}
                />
              </StepShell>
            )}

            {step === 6 && (
              <StepShell title="Review & submit">
                <div className="space-y-4">
                  <ReviewSummary config={config} />

                  {!canSubmit && (
                    <p className="text-center text-xs text-black/50">
                      Add your name &amp; WhatsApp number in the Venue step to submit.
                    </p>
                  )}
                  {submitError && (
                    <p className="text-center text-xs text-red-500">{submitError}</p>
                  )}
                </div>
              </StepShell>
            )}
          </div>
        </div>
      </div>

      <StickyBottomCTA
        config={config}
        stepName={STEPS[step]}
        ctaLabel={isReview ? "Request Final Quote" : "Continue"}
        showBack={step > 0}
        onBack={() => setStep((s) => Math.max(0, s - 1))}
        onNext={isReview ? submit : () => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
        // Theme step is a required choice — everything downstream (palette,
        // graphics, standee suggestions) is themed, so continuing without one
        // silently applied the default theme.
        disabled={(isReview && !canSubmit) || (step === 1 && !config.themeSelected)}
        busy={submitting}
      />
    </main>
  );
}

// ---------------------------------------------------------------------------
// Step shells + decor controls
// ---------------------------------------------------------------------------

function StepShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-[30px] font-semibold text-[#46313B]" style={{ fontFamily: SERIF, lineHeight: 1.08 }}>{title}</h2>
      {subtitle && <p className="mb-4 mt-1.5 text-[13.5px] font-medium text-[#97808A]">{subtitle}</p>}
      <div className={subtitle ? "" : "mt-4"}>{children}</div>
    </section>
  );
}

/** Generic labelled button-group row for decor selects. */
function ChoiceRow<T extends string>({
  label,
  value,
  options,
  onChange,
  priceOf,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  priceOf?: (id: T) => number;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-black/55">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = o.id === value;
          const price = priceOf?.(o.id) ?? 0;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                active ? "bg-accent text-white" : "bg-white text-black/60 border border-black/15"
              }`}
            >
              {o.label}
              {price > 0 && (
                <span className={active ? "text-white/80" : "text-black/40"}> +{price}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Per-theme print suggestion text shown below the Theme Graphic card. */
const THEME_PRINT_SUGGESTIONS: Record<string, string> = {
  frozen: "Frozen castle, snowflakes, Anna & Elsa silhouette",
  unicorn: "Unicorn face with gold horn, flower crown and lashes",
  dinosaur: "Jungle palm trees, volcano, dinosaur footprints",
  safari: "African savanna, giraffe silhouette, tropical leaves",
  princess: "Castle turrets, crown, stars and magic wand",
  superhero: "City skyline, lightning bolt, hero shield",
  barbie: "Barbie logo, stars, fashion illustration",
  bluey: "Bluey and Bingo characters with paw prints",
  pokemon: "Pokeball graphic, Pikachu silhouette, lightning bolt",
  stitch: "Stitch with hibiscus flowers and Hawaii text",
  mermaid: "Underwater scene, shells, bubbles, coral reef",
  space: "Galaxy stars, planets, rocket ship, moon",
  football: "Football pitch lines, soccer ball, jersey number",
  lego: "Lego brick grid pattern and colorful Lego minifigure face graphics",
  kpop: "Stage spotlight, microphone, sparkle star graphics",
  encanto: "Casita house, magical candle, Colombian flowers",
  cocomelon: "Watermelon slices, JJ character, bright polka dots",
  teddy_bear: "Cute teddy bear illustrations, hearts, soft bow",
  pineapple_tropical: "Gold pineapple outline, tropical monstera leaves, hibiscus",
  blush_garden: "Botanical roses and peonies, delicate foliage",
  luxury_neutral: "Minimal gold line art, abstract botanical, elegant monogram",
};

/** Short display labels for plinth size buttons. */
const PLINTH_SHORT: Record<string, string> = {
  small: "S",
  medium: "M",
  large: "L",
  xl: "XL",
};

const DEFAULT_SEMPERTEX_IDS = ["fashion-005-white", "pastel-matte-609-pink", "pastel-matte-650-lilac"];

const getThemeDefault = (themeId: string): string[] => {
  const entry = getThemeCatalogEntry(themeId);
  if (entry && entry.sempertexPaletteIds.length > 0) return entry.sempertexPaletteIds;
  return DEFAULT_SEMPERTEX_IDS;
};

function DecorStep({
  config,
  patchDecor,
}: {
  config: BuilderConfig;
  patchDecor: (p: Partial<DecorConfig>) => void;
}) {
  const [printFile, setPrintFile] = useState<File | null>(null);
  const [showAdvancedPanel, setShowAdvancedPanel] = useState(false);
  const [openCustomizeIds, setOpenCustomizeIds] = useState<Set<string>>(new Set());
  // Manual shape cards are secondary — hidden behind "Change pieces manually"
  const [showManualPieces, setShowManualPieces] = useState(false);
  // Sempertex picker -UI only, does not affect pricing/render
  const [sempertexIds, setSempertexIds] = useState<string[]>(() => getThemeDefault(config.theme));
  const [sempertexManual, setSempertexManual] = useState(false); // true once user manually changes
  const [showSempertexBrowser, setShowSempertexBrowser] = useState(false);
  const [sempertexQuery, setSempertexQuery] = useState("");
  const [sempertexFilter, setSempertexFilter] = useState("All");
  const [lastTheme, setLastTheme] = useState(config.theme);

  // Auto-apply theme default when theme changes (unless user manually changed)
  if (config.theme !== lastTheme) {
    setLastTheme(config.theme);
    setSempertexManual(false);
    setSempertexIds(getThemeDefault(config.theme));
  }

  const [sempertexExceeded, setSempertexExceeded] = useState(false);

  // ── Single source of truth ────────────────────────────────────────────
  // effectiveSempertexSelection: manual selection if the user edited colors,
  // otherwise the theme-mapped Sempertex colors. Every consumer — chips,
  // render payload, stale detection, and the render prompt — reads this same
  // derived value (via the decor sync effect below), so they can never diverge.
  const effectiveSempertexSelection = useMemo(
    () => sempertexIds
      .map((id) => SEMPERTEX_CATALOG.find((c) => c.id === id))
      .filter((c): c is typeof SEMPERTEX_CATALOG[number] => !!c),
    [sempertexIds]
  );

  // Push the single source of truth into decor state whenever it changes.
  // Empty selection falls back to the theme's hex palette.
  useEffect(() => {
    if (effectiveSempertexSelection.length > 0) {
      patchDecor({
        balloonColors: effectiveSempertexSelection.map((c) => c.hex),
        sempertexSelection: effectiveSempertexSelection.map((c) => ({ code: c.code, colorName: c.colorName, finish: c.finish, family: c.family, hex: c.hex })),
      });
    } else {
      const t = themeById(config.theme);
      patchDecor({
        balloonColors: t ? t.balloonColors.slice(0, 5) : [],
        sempertexSelection: [],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveSempertexSelection]);

  const toggleSempertex = (id: string) => {
    setSempertexManual(true);
    setSempertexIds(prev => {
      if (prev.includes(id)) { setSempertexExceeded(false); return prev.filter(x => x !== id); }
      if (prev.length >= 5) { setSempertexExceeded(true); return prev; }
      setSempertexExceeded(false);
      return [...prev, id];
    });
  };
  const resetToThemePalette = () => {
    setSempertexIds(getThemeDefault(config.theme));
    setSempertexManual(false);
    setSempertexExceeded(false);
  };
  const toggleCustomize = (id: string) =>
    setOpenCustomizeIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const d = config.decor;
  const theme = themeById(config.theme)!;
  const t = d.backdropText;
  const cut = d.cutouts;
  const normalizedCut = normalizeCutouts(cut);
// Real-asset cutout presets (with PNG previews) when the theme has them;
// otherwise fall back to the generic text-only preset cards.
const themeCutoutPresets = getThemeCutoutPresets(config.theme);
const cutoutPresetOptions = themeCutoutPresets
  ?? getThemeGraphicPresets(config.theme).map((p) => ({
       id: p.id,
       assetId: p.assetId ?? p.id,
       label: p.label,
       desc: (p as any).description ?? (p as any).desc ?? p.label,
       previewUrl: "",
     }));
// Multi-select standee model — NOTHING is selected by default.
const selectedCutoutAssets = normalizedCut.selectedAssets ?? [];

function toggleCutoutAsset(preset: { assetId: string; label: string; previewUrl?: string }) {
  const exists = selectedCutoutAssets.some((a) => a.assetId === preset.assetId);
  const next = exists
    ? selectedCutoutAssets.filter((a) => a.assetId !== preset.assetId)
    : [...selectedCutoutAssets, {
        assetId: preset.assetId,
        label: preset.label,
        previewUrl: preset.previewUrl,
        // Standees ship in ONE standard height (2026-07-20 product decision):
        // picking the character is the whole choice, so selecting a design
        // adds exactly one 150cm feature standee.
        quantities: { ...emptyCutoutQuantities(), large: 1 },
      }];
  patchDecor({
    cutouts: {
      ...normalizedCut,
      size: "none",
      position: "floor",
      source: "preset",
      presetAssetId: undefined,
      mode: next.length > 0 ? "standees" : "none",
      selectedAssets: next,
    },
  });
}

function setAssetQuantity(assetId: string, size: "large" | "medium" | "small", quantity: number) {
  const next = selectedCutoutAssets.map((a) =>
    a.assetId === assetId
      ? { ...a, quantities: { ...a.quantities, [size]: Math.max(0, Math.min(9, quantity)) } }
      : a,
  );
  patchDecor({
    cutouts: {
      ...normalizedCut,
      size: "none",
      position: "floor",
      source: "preset",
      presetAssetId: undefined,
      mode: "standees",
      selectedAssets: next,
    },
  });
}

function clearAllStandees() {
  patchDecor({
    cutouts: {
      size: "none",
      mode: "none",
      position: "floor",
      source: "preset",
      presetAssetId: undefined,
      selectedAssets: [],
      items: emptyCutoutStandees(),
    },
  });
}
  const print = d.backdropPrint ?? { type: "none" as BackdropPrintType };

  function setText(patch: Partial<DecorConfig["backdropText"]>) {
    patchDecor({ backdropText: { ...t, ...patch } });
  }
  function setPrint(type: BackdropPrintType) {
    patchDecor({
      backdropPrint: {
        type,
        ...(type === "theme_print" && !print.graphicStyle
          ? { graphicStyle: "illustrated" as GraphicStyle }
          : {}),
      },
    });
  }
  function setGraphicStyle(style: GraphicStyle) {
    patchDecor({ backdropPrint: { ...print, graphicStyle: style } });
  }
  function setPlinthCount(n: number) {
    const sizes: PlinthSize[] = [...d.plinthSizes];
    while (sizes.length < n) sizes.push("medium");
    sizes.length = n;
    patchDecor({ plinths: n, plinthSizes: sizes });
  }
  function setPlinthSize(i: number, size: PlinthSize) {
    const sizes = [...d.plinthSizes];
    sizes[i] = size;
    patchDecor({ plinthSizes: sizes, plinths: sizes.length });
  }
  // Per-panel patch helpers
  function patchItem(idx: number, patch: Partial<BackdropItem>) {
    const next = d.backdropItems.map((item, i) => i === idx ? { ...item, ...patch } : item);
    patchDecor({ backdropItems: next });
  }
  function patchItemText(idx: number, patch: Partial<BackdropItemText>) {
    const item = d.backdropItems[idx];
    if (!item) return;
    patchItem(idx, { text: { ...item.text, ...patch } });
  }
  function patchItemGraphic(idx: number, patch: Partial<BackdropItemGraphic>) {
    const item = d.backdropItems[idx];
    if (!item) return;
    patchItem(idx, { graphic: { ...item.graphic, ...patch } });
  }

  function toggleBalloon(hex: string) {
    const has = d.balloonColors.includes(hex);
    const next = has
      ? d.balloonColors.filter((c) => c !== hex)
      : d.balloonColors.length < 5
        ? [...d.balloonColors, hex]
        : d.balloonColors;
    patchDecor({ balloonColors: next });
  }

  const swatch = (active: boolean) =>
    `h-9 w-9 rounded-full border shadow-sm transition ${
      active ? "ring-2 ring-accent ring-offset-2" : "border-black/15"
    }`;

  const accent = theme.accent;
  // Claude Design inner sub-card: #FDF9FA on white section cards
  const card: React.CSSProperties = {
    background: DC.innerBg,
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    border: `1.5px solid ${DC.cardBd}`,
  };
  // Claude Design: soft rounded-square number chip (#FBE9EF / #C24373)
  const numBadge = (n: number) => (
    <div style={{
      width: 26, height: 26, borderRadius: 9, background: DC.chipBg,
      color: DC.roseDeep, fontSize: 12, fontWeight: 700,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>{n}</div>
  );
  const secLabel = (text: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
      <span style={{ width: 2.5, height: 14, borderRadius: 2, background: accent, display: "inline-block", flexShrink: 0 }} />
      <span style={{ fontSize: 13.5, fontWeight: 600, color: "#2B2040", fontFamily: SERIF, letterSpacing: "-0.01em" }}>{text}</span>
    </div>
  );
  const secSub = (text: string) => (
    <p style={{ fontSize: 11.5, color: "#727386", marginTop: 2, marginBottom: 10, fontWeight: 500 }}>{text}</p>
  );

  /**
   * "You're here" pointer for the step that needs attention next.
   * Deliberately a soft pill with a gentle nudge rather than a cartoon arrow —
   * it guides a first-time user without undoing the premium look (2026-07-20).
   */
  const nextCue = (text: string) => (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6, marginTop: 2,
      background: DC.chipBg, color: DC.roseDeep, borderRadius: 999,
      padding: "3px 10px 3px 8px", fontSize: 10.5, fontWeight: 700,
      animation: "blushyNudge 1.8s ease-in-out infinite",
    }}>
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path d="M2.5 6h6.2M6 3.2 8.9 6 6 8.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      {text}
    </div>
  );

  function BackdropShapePreview({ type, color = "#F2D4E0" }: { type: string; color?: string }) {
    if (type === "arch") return (
      <svg width="60" height="80" viewBox="0 0 60 80">
        <rect x="5" y="40" width="50" height="35" rx="4" fill={color}/>
        <ellipse cx="30" cy="40" rx="25" ry="25" fill={color}/>
      </svg>
    );
    if (type === "rect") return (
      <svg width="60" height="80" viewBox="0 0 60 80">
        <rect x="8" y="10" width="44" height="60" rx="4" fill={color}/>
      </svg>
    );
    if (type === "round") return (
      <svg width="60" height="80" viewBox="0 0 60 80">
        <circle cx="30" cy="40" r="28" fill={color}/>
      </svg>
    );
    if (type === "shimmer_wall") return (
      <svg width="60" height="80" viewBox="0 0 60 80">
        <rect x="5" y="10" width="50" height="60" rx="4" fill={color}/>
        {[0,1,2,3,4].map(r => [0,1,2,3].map(c => (
          <rect key={`${r}-${c}`} x={7+c*12} y={12+r*12} width="10" height="10" rx="2" fill="rgba(255,255,255,0.5)"/>
        )))}
      </svg>
    );
    return null;
  }
  const chip = (label: string, active: boolean): React.CSSProperties => ({
    fontSize: 11, fontWeight: 700,
    color: active ? "rgba(255,255,255,0.85)" : accent,
    background: active ? "rgba(255,255,255,0.2)" : accent + "18",
    padding: "2px 8px", borderRadius: 20, marginLeft: 6, display: "inline-block",
  });
  const checkBadge = (active: boolean): React.CSSProperties => ({
    width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
    background: active ? accent : "transparent",
    color: active ? "white" : "transparent",
    border: `1.5px solid ${active ? accent : "rgba(0,0,0,0.2)"}`,
    fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700,
  });

  // Toggle a specific arch size (multi-select, max 3 total)
  function toggleArchSize(size: (typeof ARCH_SIZES)[0]) {
    const existing = d.backdropItems.find(i => i.type === "arch" && i.sizeId === size.id);
    if (existing) {
      patchDecor({ backdropItems: d.backdropItems.filter(i => i.id !== existing.id) });
    } else {
      if (d.backdropItems.length >= MAX_BACKDROP_ITEMS) return;
      const hasRound = d.backdropItems.some(i => i.type === "round");
      if (hasRound) {
        const newItem = { ...makeBackdropItem("arch"), sizeId: size.id, widthCm: size.widthCm, heightCm: size.heightCm, id: size.id };
        patchDecor({ backdropItems: [newItem] });
        setOpenCustomizeIds(prev => { const n = new Set(prev); n.add(newItem.id); return n; });
      } else {
        const newItem = { ...makeBackdropItem("arch"), sizeId: size.id, widthCm: size.widthCm, heightCm: size.heightCm, id: `arch-${size.id}` };
        patchDecor({ backdropItems: [...d.backdropItems, newItem] });
        setOpenCustomizeIds(prev => { const n = new Set(prev); n.add(newItem.id); return n; });
      }
    }
  }

  // Toggle round -exclusive (removes all others)
  function toggleRound() {
    const hasRound = d.backdropItems.some(i => i.type === "round");
    if (hasRound) {
      patchDecor({ backdropItems: [] });
    } else {
      const newItem = makeBackdropItem("round");
      patchDecor({ backdropItems: [newItem] });
      setOpenCustomizeIds(prev => { const n = new Set(prev); n.add(newItem.id); return n; });
    }
  }

  // Toggle non-arch/non-round types (rect, shimmer) -removes round if present
  function toggleOtherType(type: BackdropShapeId) {
    const hasThis = d.backdropItems.some(i => i.type === type);
    if (hasThis) {
      patchDecor({ backdropItems: d.backdropItems.filter(i => i.type !== type) });
    } else {
      if (d.backdropItems.length >= MAX_BACKDROP_ITEMS) return;
      const withoutRound = d.backdropItems.filter(i => i.type !== "round");
      const newItem = makeBackdropItem(type);
      patchDecor({ backdropItems: [...withoutRound, newItem] });
      setOpenCustomizeIds(prev => { const n = new Set(prev); n.add(newItem.id); return n; });
    }
  }

  // Apply a curated backdrop set template — replaces current backdropItems
  // with the template's exact panels (max 2, controlled render layouts).
  function applySetupTemplate(templateId: string) {
    // Arch pieces start UNSIZED — the user must explicitly pick a size before
    // the row is complete. Default dims stay 100x200 for render safety.
    const makeArchUnsized = (id: string) => ({ ...makeBackdropItem("arch"), sizeId: undefined, id });
    let panels: BackdropItem[];
    switch (templateId) {
      case "single_arch":        panels = [makeArchUnsized("arch-1")]; break;
      case "single_round":       panels = [makeBackdropItem("round")]; break;
      case "double_arch":        panels = [makeArchUnsized("arch-1"), makeArchUnsized("arch-2")]; break;
      // arch_open_frame / shimmer_open_frame / single_shimmer / arch_shimmer
      // removed from product — no longer selectable, so no case needed;
      // legacy ids resolve via getSetupLayoutTemplate()'s
      // LEGACY_TEMPLATE_ID_REMAP if ever passed in.
      default: return;
    }
    patchDecor({ backdropItems: panels });
    setOpenCustomizeIds(new Set(panels.map(p => p.id)));
  }

  const activeSetupTemplateId = inferSetupLayoutTemplateIdFromBackdropItems(d.backdropItems);

  // Readable type labels for summaries
  const TYPE_LABEL: Record<string, string> = { arch: "Arch Backdrop", rect: "Rectangular Backdrop", round: "Round Backdrop", shimmer_wall: "Shimmer Wall", open_arch_frame: "Open Arch Frame" };

  // Collapsible customize row -shows summary + button, expands on demand
  function BackdropCustomizeRow({ item, itemIdx }: { item: BackdropItem; itemIdx: number }) {
    const sizeLabelMap = Object.fromEntries([...ARCH_SIZES, ...RECT_SIZES].map(s => [s.id, s.label]));
    const sizeStr = item.sizeId ? (sizeLabelMap[item.sizeId] ?? `${item.widthCm} × ${item.heightCm} cm`) : `${item.widthCm} × ${item.heightCm} cm`;
    // Friendly, non-technical summary — "Arch Backdrop · Medium / Standard"
    const summaryLabel = `${TYPE_LABEL[item.type] ?? item.type} · ${sizeStr}`;
    const isOpen = openCustomizeIds.has(item.id);
    return (
      <div style={{ marginTop: 12, borderRadius: 12, border: "1.5px solid #F1D8E2", background: "white", overflow: "hidden" }}>
        {/* Summary row -full-width, readable */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#EC4D8D", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ color: "white", fontSize: 12, fontWeight: 900, lineHeight: 1 }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#15182E", letterSpacing: "-0.1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{summaryLabel}</span>
          </div>
          <button type="button" onClick={() => toggleCustomize(item.id)}
            style={{ fontSize: 11, fontWeight: 700, color: isOpen ? "#EC4D8D" : "#15182E", background: "transparent", border: isOpen ? "1px solid #EC4D8D" : "1px solid #D1D5DB", borderRadius: 999, padding: "4px 12px", cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap", flexShrink: 0 }}>
            {isOpen ? "Done" : "Customize"}
          </button>
        </div>
        {/* Expanded customization panel */}
        {isOpen && (
          <div style={{ borderTop: "1px solid #F1D8E2", background: "#FAFAFA" }}>
            {ItemCustomization({ item, itemIdx })}
          </div>
        )}
      </div>
    );
  }

  function ItemCustomization({ item, itemIdx }: { item: BackdropItem; itemIdx: number }) {
    // Build the label: "Backdrop N -Type -Size"
    const typeLabel: Record<string, string> = { arch: "Arch Backdrop", rect: "Rectangular Backdrop", round: "Round Backdrop", shimmer_wall: "Shimmer Wall" };
    const sizeLabelMap = Object.fromEntries([...ARCH_SIZES, ...RECT_SIZES].map(s => [s.id, s.label]));
    const sizeStr = item.sizeId ? (sizeLabelMap[item.sizeId] ?? `${item.widthCm} x ${item.heightCm} cm`) : `${item.widthCm} x ${item.heightCm} cm`;
    const selectionLabel = `Backdrop ${itemIdx + 1} - ${typeLabel[item.type] ?? item.type} - ${sizeStr}`;

    return (
      <div>
        <div style={{ padding: "14px 14px 14px" }}>
        {/* Color */}
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#12162F", display: "block", marginBottom: 6 }}>Backdrop color</span>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            {theme.backdropColors.map((hex) => (
              <button key={hex} type="button" onClick={() => patchItem(itemIdx, { color: hex })}
                style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: hex, border: item.color === hex ? `2.5px solid ${accent}` : "2px solid rgba(0,0,0,0.12)", cursor: "pointer", transition: "all 0.15s" }} title={hex} />
            ))}
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#888", cursor: "pointer" }}>
              Custom
              <input type="color" value={item.color || d.backdropColor || "#FFFFFF"}
                onChange={(e) => patchItem(itemIdx, { color: e.target.value })}
                style={{ width: 20, height: 20, border: "none", background: "transparent", cursor: "pointer", padding: 0 }} />
            </label>
          </div>
        </div>

        {/* Add-ons */}
        <span style={{ fontSize: 11, fontWeight: 600, color: "#555", display: "block", marginBottom: 6 }}>Add-ons for this backdrop</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {/* Customized text */}
          <div onClick={() => patchItemText(itemIdx, { enabled: !item.text.enabled })}
            style={{ cursor: "pointer", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10,
              border: item.text.enabled ? `2px solid ${accent}` : "1.5px solid rgba(0,0,0,0.08)",
              background: item.text.enabled ? accent + "0E" : "white", transition: "all 0.15s" }}>
            <span style={{ fontSize: 18 }}></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: item.text.enabled ? accent : "#1A1A2E" }}>Customized text</div>
              <div style={{ fontSize: 11, color: "#999" }}>A name or short message printed on the backdrop</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
              background: item.text.enabled ? accent : "rgba(0,0,0,0.06)", color: item.text.enabled ? "white" : "#555" }}>+AED 80</span>
          </div>
          {item.text.enabled && (
            <div style={{ padding: "10px 12px", background: "#FAFAFA", borderRadius: 10, border: "1px solid rgba(0,0,0,0.06)" }}>
              <textarea rows={2} value={item.text.value}
                onChange={(e) => patchItemText(itemIdx, { value: e.target.value })}
                placeholder="Type the name or message..."
                style={{ width: "100%", resize: "none", borderRadius: 8, border: "1px solid rgba(0,0,0,0.10)", padding: "8px 10px", fontSize: 13, outline: "none" }} />
            </div>
          )}

          {/* Theme Graphic */}
          <div onClick={() => {
            const enabling = !item.graphic.enabled;
            if (enabling && !item.graphic.assetId) {
              const catalogEntry = getThemeCatalogEntry(config.theme);
              const presets = catalogEntry?.graphicPresets ?? FALLBACK_GRAPHIC_PRESETS;
              const first = presets[0];
              patchItemGraphic(itemIdx, { enabled: true, theme: first.id, source: "preset", assetId: first.assetId });
            } else {
              patchItemGraphic(itemIdx, { enabled: enabling });
            }
          }}
            style={{ cursor: "pointer", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10,
              border: item.graphic.enabled ? `2px solid ${accent}` : "1.5px solid rgba(0,0,0,0.08)",
              background: item.graphic.enabled ? accent + "0E" : "white", transition: "all 0.15s" }}>
            <span style={{ fontSize: 18 }}></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: item.graphic.enabled ? accent : "#1A1A2E" }}>Theme Graphic</div>
              <div style={{ fontSize: 11, color: "#999" }}>Add a printed theme illustration</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
              background: item.graphic.enabled ? accent : "rgba(0,0,0,0.06)", color: item.graphic.enabled ? "white" : "#555" }}>+AED 150</span>
          </div>
          {item.graphic.enabled && (() => {
            const catalogEntry = getThemeCatalogEntry(config.theme);
            const presets = catalogEntry?.graphicPresets ?? FALLBACK_GRAPHIC_PRESETS;
            return (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingLeft: 4, paddingTop: 4 }}>
                {presets.map(p => (
                  <button key={p.id} type="button" title={p.desc}
                    onClick={(e) => { e.stopPropagation(); patchItemGraphic(itemIdx, { theme: p.id, source: "preset", assetId: p.assetId }); }}
                    style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                      border: item.graphic.assetId === p.assetId ? `1.5px solid ${accent}` : "1.5px solid rgba(0,0,0,0.12)",
                      background: item.graphic.assetId === p.assetId ? accent + "12" : "white",
                      color: item.graphic.assetId === p.assetId ? accent : "#555" }}>
                    {p.label}
                  </button>
                ))}
              </div>
            );
          })()}

        </div>
        </div>
      </div>
    );
  }

  return (
    <div className={jakarta.className}>
      {/* == PAGE HEADING — Claude Design ====================== */}
      <div style={{ margin: "4px 2px 20px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", color: DC.rose, textTransform: "uppercase", marginBottom: 6 }}>Decor</div>
        <h1 style={{ margin: 0, fontFamily: SERIF, fontWeight: 600, fontSize: 25, color: DC.plum, lineHeight: 1.1 }}>Build your dream backdrop</h1>
        <p style={{ margin: "7px 0 0", fontSize: 12.5, color: DC.muted, maxWidth: 540, lineHeight: 1.55 }}>
          Four quick steps. Everything is pre-styled to your {theme.name} theme — adjust only what you want.
        </p>
      </div>

      {/* == 1 · PICK YOUR SETUP =============================== */}
      <div style={{ background: "white", border: `1px solid ${DC.cardBd}`, borderRadius: 18, padding: 18, marginBottom: 14, boxShadow: DC.cardShadow }}>
      <div>
        {/* Curated setup layouts — playful visual cards */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            {numBadge(1)}
            <div>
              <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 18, color: DC.plum, lineHeight: 1.15 }}>Pick your setup</div>
              <div style={{ fontSize: 11.5, color: DC.muted }}>Start with a layout — we&apos;ll arrange the pieces for you.</div>
              {d.backdropItems.length === 0 && nextCue("Start here — tap a layout")}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(128px, 1fr))", gap: 10 }}>
            {SETUP_LAYOUT_TEMPLATES.map((tpl) => {
              const active = activeSetupTemplateId === tpl.id;
              return (
                <button key={tpl.id} type="button" onClick={() => applySetupTemplate(tpl.id)}
                  style={{ position: "relative", padding: "14px 8px 10px", borderRadius: 18, cursor: "pointer", textAlign: "center", transition: "all 0.18s",
                    border: active ? DC.selBorder : `1.5px solid ${DC.cardBd}`,
                    background: DC.innerBg,
                    boxShadow: active ? DC.selShadow : "none",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  {tpl.badge && !active && (
                    <span style={{ position: "absolute", top: 7, right: 7, background: DC.amberBg, color: DC.amberFg,
                      fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>{tpl.badge}</span>
                  )}
                  <SetupMiniPreview shapes={tpl.miniPreview} />
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: DC.plum, lineHeight: 1.25 }}>{tpl.name}</div>
                  <div style={{ fontSize: 10.5, color: "#A78E99", lineHeight: 1.35 }}>{tpl.description}</div>
                  {active && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 999, background: DC.rose, color: "white", fontSize: 9.5, fontWeight: 700 }}>✓ Your setup</span>
                  )}
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
              You can select up to 2 backdrop pieces for a controlled render.
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
            { type: "arch" as const, label: "Arch Backdrop", badge: "Most popular", click: () => { const hasArch = d.backdropItems.some(i=>i.type==="arch"); if(!hasArch) toggleArchSize(ARCH_SIZES[1]); else patchDecor({ backdropItems: d.backdropItems.filter(i=>i.type!=="arch") }); } },
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
      </div>{/* == end 1 · Pick your setup == */}

      {/* == 2 · SIZE YOUR PIECES ============================== */}
      <div style={{ background: "white", border: `1px solid ${DC.cardBd}`, borderRadius: 18, padding: 18, marginBottom: 14, boxShadow: DC.cardShadow }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          {numBadge(2)}
          <div>
            <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 18, color: DC.plum, lineHeight: 1.15 }}>Size your pieces</div>
            <div style={{ fontSize: 11.5, color: DC.muted }}>Choose a size for each piece — add-ons unlock once it&apos;s sized.</div>
            {d.backdropItems.length > 0 && d.backdropItems.some((i) => !i.sizeId) && nextCue("Pick a size next")}
          </div>
        </div>

        {/* Arch size selector -shown when arch is selected */}
        {d.backdropItems.some(i => i.type === "arch") && (
          <div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {d.backdropItems.map((item, itemIdx) => {
                if (item.type !== "arch") return null;
                const archNumber = d.backdropItems.filter((i, k) => i.type === "arch" && k <= itemIdx).length;
                const archCount  = d.backdropItems.filter(i => i.type === "arch").length;
                const sized = !!item.sizeId;
                const friendlyName = archCount > 1 ? (archNumber === 1 ? "Main arch" : "Second arch") : "Arch backdrop";
                const sizedLabel = ARCH_SIZES.find(s => s.id === item.sizeId)?.label;
                return (
                  <div key={item.id} style={{ background: DC.innerBg, borderRadius: 18, padding: 16,
                    border: `1.5px solid ${sized ? DC.cardBd : DC.dashedBd}` }}>
                    <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                      {/* Piece thumb — Claude Design */}
                      <svg width="56" height="64" viewBox="0 0 56 64" style={{ flex: "none" }} aria-hidden="true">
                        <defs><linearGradient id={`pieceArch-${item.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F3A9C6"/><stop offset="100%" stopColor="#E27BA4"/></linearGradient></defs>
                        <path d="M 10,60 L 10,26 A 18,18 0 0 1 46,26 L 46,60 Z" fill={`url(#pieceArch-${item.id})`} />
                      </svg>
                      <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 8 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: DC.plum }}>{friendlyName}</div>
                          <div style={{ fontSize: 11.5, color: DC.muted }}>
                            {sized ? sizedLabel : "Choose a size"}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {ARCH_SIZES.map((size) => {
                            const isSel = item.sizeId === size.id;
                            return (
                              <button key={size.id} type="button"
                                onClick={() => patchItem(itemIdx, { sizeId: size.id, widthCm: size.widthCm, heightCm: size.heightCm })}
                                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, padding: "6px 13px", borderRadius: 13, cursor: "pointer", transition: "all 0.15s",
                                  background: isSel ? DC.chipBg : "white",
                                  border: `1.5px solid ${isSel ? DC.dashedBd : DC.cardBd}` }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: isSel ? DC.roseDeep : DC.plum }}>{size.label.replace(" / Standard", "")}{size.id === "medium" ? " ★" : ""}</span>
                                <span style={{ fontSize: 9.5, color: isSel ? DC.roseDeep : DC.faint }}>{size.widthCm} × {size.heightCm} cm</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    {sized
                      ? BackdropCustomizeRow({ item, itemIdx })
                      : <div style={{ marginTop: 8, fontSize: 11, color: DC.faint, fontStyle: "italic" }}>Choose a size to unlock text and graphic add-ons</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Rect size selector */}
        {d.backdropItems.some(i => i.type === "rect") && (() => {
          const rectItems = d.backdropItems.filter(i => i.type === "rect");
          const rectItem = rectItems[0];
          const itemIdx = rectItem ? d.backdropItems.findIndex(i => i.id === rectItem.id) : -1;
          return rectItem ? (
            <div style={{ marginTop: 16, padding: "14px 16px", background: "#FFF7FB", borderRadius: 12, border: "1px solid #F1D8E2" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#73778A", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>Choose size</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                {RECT_SIZES.map(size => {
                  const isSel = rectItem.sizeId === size.id;
                  return (
                    <button key={size.id} type="button"
                      onClick={() => patchDecor({ backdropItems: d.backdropItems.map(i => i.id === rectItem.id ? { ...i, sizeId: size.id, widthCm: size.widthCm, heightCm: size.heightCm } : i) })}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 14px", borderRadius: 10, cursor: "pointer",
                        border: isSel ? "2px solid #EC4D8D" : "1.5px solid #ECEAF1",
                        background: "white", boxShadow: isSel ? "0 2px 10px rgba(236,77,141,0.12)" : "none", transition: "all 0.15s" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: isSel ? "#EC4D8D" : "#15182E" }}>{size.label}</div>
                        <div style={{ fontSize: 11, color: "#73778A", marginTop: 1 }}>{size.widthCm} x{size.heightCm} cm</div>
                      </div>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", border: isSel ? "none" : "1.5px solid #ECEAF1", background: isSel ? "#EC4D8D" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {isSel && <span style={{ color: "white", fontSize: 12, fontWeight: 900 }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span>}
                      </div>
                    </button>
                  );
                })}
              </div>
              {BackdropCustomizeRow({ item: rectItem, itemIdx })}
            </div>
          ) : null;
        })()}

        {/* Round customization */}
        {d.backdropItems.some(i => i.type === "round") && (() => {
          const roundItem = d.backdropItems.find(i => i.type === "round");
          const itemIdx = roundItem ? d.backdropItems.findIndex(i => i.id === roundItem.id) : -1;
          return roundItem && itemIdx >= 0 ? BackdropCustomizeRow({ item: roundItem, itemIdx }) : null;
        })()}

        {/* Shimmer color picker intentionally removed (2026-07-12) — shimmer
            wall is no longer a selectable product path. Left unconditional
            (not gated on a shimmer_wall item existing) so it stays hidden
            even if a stale/legacy backdropItems array somehow still has one;
            buildSceneModel also sanitizes shimmer_wall items server-side. */}

        {d.backdropItems.length === 0 && (
          <div style={{ textAlign: "center", padding: "8px 0 4px", fontSize: 13, color: "#AAA", fontStyle: "italic" }}>Choose a backdrop above to get started</div>
        )}
      </div>{/* -"--"- end unified backdrop card -"--"- */}

      {/* Old expandable cards removed -unified above. Dead placeholder: */}
      {false && <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* ARCH BACKDROP */}
          {(() => {
            const archItems = d.backdropItems.filter(i => i.type === "arch");
            const hasArch = archItems.length > 0;
            return (
              <div style={{ border: hasArch ? `2.5px solid ${accent}` : "1.5px solid rgba(0,0,0,0.10)", borderRadius: 14, overflow: "hidden", background: hasArch ? accent + "08" : "white", transition: "all 0.15s" }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: hasArch ? accent + "20" : "#F3F0FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>-"</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: hasArch ? accent : "#1A1A2E" }}>Arch Backdrop</div>
                    <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Rounded event backdrop -select 1--"3 sizes</div>
                  </div>
                  {hasArch && <span style={{ fontSize: 18, color: accent }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span>}
                </div>
                {/* Size options -always visible */}
                <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", padding: "10px 14px 14px", background: "rgba(0,0,0,0.01)" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {ARCH_SIZES.map((size) => {
                      const archItem = d.backdropItems.find(i => i.type === "arch" && i.sizeId === size.id);
                      const isSelected = !!archItem;
                      const itemIdx = isSelected ? d.backdropItems.findIndex(i => i.id === archItem?.id) : -1;
                      return (
                        <div key={size.id}>
                          <button type="button"
                            onClick={() => toggleArchSize(size)}
                            disabled={!isSelected && d.backdropItems.length >= MAX_BACKDROP_ITEMS}
                            style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                              padding: "10px 14px", borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
                              border: isSelected ? `2px solid ${accent}` : "1.5px solid rgba(0,0,0,0.08)",
                              background: isSelected ? accent + "12"
                                : size.id === "small"  ? "#FFF8F4"
                                : size.id === "medium" ? "#FFF0F5"
                                : size.id === "large"  ? "#F5F0FF"
                                : "white",
                              opacity: !isSelected && d.backdropItems.length >= MAX_BACKDROP_ITEMS ? 0.4 : 1 }}>
                            <div style={{ textAlign: "left" }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? accent : "#1A1A2E" }}>{size.label}</div>
                              <div style={{ fontSize: 11, color: "#999" }}>{size.widthCm} x{size.heightCm} cm</div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                                background: isSelected ? accent : "rgba(0,0,0,0.06)", color: isSelected ? "white" : "#555" }}>
                                {isSelected && itemIdx === 0 ? "Included" : "+AED 350"}
                              </span>
                              {isSelected && <span style={{ color: accent, fontSize: 14 }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span>}
                            </div>
                          </button>
                          {/* Inline customization for this arch item */}
                          {isSelected && archItem && itemIdx >= 0 && ItemCustomization({ item: archItem, itemIdx })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* RECTANGULAR CARD */}
          {(() => {
            const rectItems = d.backdropItems.filter(i => i.type === "rect");
            const hasRectCard = rectItems.length > 0;
            const firstRectItem = rectItems[0];
            return (
              <div style={{
                border: hasRectCard ? `2.5px solid ${accent}` : "1.5px solid rgba(0,0,0,0.10)",
                background: hasRectCard ? accent + "12" : "white",
                borderRadius: 14,
                overflow: "hidden",
                boxShadow: hasRectCard ? `0 2px 12px ${accent}22` : "none",
                transition: "all 0.15s",
              }}>
                <div
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer" }}
                  onClick={() => {
                    if (!hasRectCard) {
                      if (d.backdropItems.length >= MAX_BACKDROP_ITEMS) return;
                      patchDecor({ backdropItems: [...d.backdropItems, makeBackdropItem("rect")] });
                    }
                  }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                    background: hasRectCard ? accent + "20" : "#FFF8F0",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
                  }}>-</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: hasRectCard ? accent : "#1A1A2E" }}>Rectangular Backdrop</div>
                    <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Classic straight backdrop</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                      background: hasRectCard ? accent : "rgba(0,0,0,0.06)",
                      color: hasRectCard ? "white" : "#555",
                    }}>
                      {rectItems.length > 0 && d.backdropItems.indexOf(rectItems[0]) === 0 ? "Included" : "+AED 350"}
                    </span>
                    {hasRectCard && <span style={{ fontSize: 16 }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span>}
                  </div>
                </div>

                {hasRectCard && (
                  <div style={{ borderTop: `1px solid ${accent}30`, padding: "12px 16px", background: accent + "06" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 8 }}>Choose size:</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {RECT_SIZES.map((size) => {
                        const isSelected = firstRectItem?.sizeId === size.id;
                        return (
                          <button
                            key={size.id}
                            type="button"
                            onClick={() => {
                              const updated = d.backdropItems.map(item =>
                                item.type === "rect" && item.id === firstRectItem?.id
                                  ? { ...item, sizeId: size.id, widthCm: size.widthCm, heightCm: size.heightCm }
                                  : item
                              );
                              patchDecor({ backdropItems: updated });
                            }}
                            style={{
                              display: "flex", justifyContent: "space-between", alignItems: "center",
                              padding: "10px 14px", borderRadius: 10, border: isSelected ? `2px solid ${accent}` : "1.5px solid rgba(0,0,0,0.10)",
                              background: isSelected ? accent + "12" : "white", cursor: "pointer", transition: "all 0.15s",
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? accent : "#1A1A2E" }}>{size.label}</div>
                              <div style={{ fontSize: 11, color: "#999" }}>{size.widthCm} x{size.heightCm} cm</div>
                            </div>
                            {isSelected && <span style={{ color: accent, fontWeight: 700, fontSize: 16 }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span>}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => patchDecor({ backdropItems: d.backdropItems.filter(i => i.id !== firstRectItem?.id) })}
                      style={{ marginTop: 10, fontSize: 11, color: "#999", background: "none", border: "none", cursor: "pointer" }}
                    >
                      Remove this backdrop
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ROUND BACKDROP */}
          {(() => {
            const roundItems = d.backdropItems.filter(i => i.type === "round");
            const hasRound = roundItems.length > 0;
            const roundItem = roundItems[0];
            const itemIdx = hasRound ? d.backdropItems.findIndex(i => i.id === roundItem?.id) : -1;
            return (
              <div style={{ border: hasRound ? `2.5px solid ${accent}` : "1.5px solid rgba(0,0,0,0.10)", borderRadius: 14, overflow: "hidden", background: hasRound ? accent + "08" : "white", transition: "all 0.15s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer" }}
                  onClick={toggleRound}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: hasRound ? accent + "20" : "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>--</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: hasRound ? accent : "#1A1A2E" }}>Round Backdrop</div>
                    <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Soft circular backdrop - used alone - 200 x 200 cm</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: hasRound ? accent : "rgba(0,0,0,0.06)", color: hasRound ? "white" : "#555" }}>
                      {hasRound && itemIdx === 0 ? "Included" : "+AED 350"}
                    </span>
                    {hasRound && <span style={{ fontSize: 16 }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span>}
                  </div>
                </div>
                {/* Inline customization */}
                {hasRound && roundItem && itemIdx >= 0 && (
                  <div style={{ padding: "0 14px 14px" }}>
                    {ItemCustomization({ item: roundItem, itemIdx })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* SHIMMER WALL CARD */}
          {(() => {
            const shimmerItems = d.backdropItems.filter(i => i.type === "shimmer_wall");
            const hasShimmer = shimmerItems.length > 0;
            return (
              <div style={{
                border: hasShimmer ? `2.5px solid ${accent}` : "1.5px solid rgba(0,0,0,0.10)",
                background: hasShimmer ? accent + "12" : "white",
                borderRadius: 14,
                overflow: "hidden",
                boxShadow: hasShimmer ? `0 2px 12px ${accent}22` : "none",
                transition: "all 0.15s",
              }}>
                <div
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer" }}
                  onClick={() => {
                    if (!hasShimmer) {
                      if (d.backdropItems.length >= MAX_BACKDROP_ITEMS) return;
                      patchDecor({ backdropItems: [...d.backdropItems, makeBackdropItem("shimmer_wall")] });
                    }
                  }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                    background: hasShimmer ? accent + "20" : "#F0F9FF",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
                  }}></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: hasShimmer ? accent : "#1A1A2E" }}>Shimmer Wall</div>
                    <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Sparkly sequin wall -200 x200 cm</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                      background: hasShimmer ? accent : "rgba(0,0,0,0.06)",
                      color: hasShimmer ? "white" : "#555",
                    }}>
                      {hasShimmer && d.backdropItems.indexOf(shimmerItems[0]) === 0 ? "Included" : "+AED 430"}
                    </span>
                    {hasShimmer && <span style={{ fontSize: 16 }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span>}
                  </div>
                </div>

                {hasShimmer && (
                  <div style={{ borderTop: `1px solid ${accent}30`, padding: "12px 16px", background: accent + "06" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 8 }}>Choose shimmer color:</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {SHIMMER_COLORS.map((sc) => {
                        const isActive = (d.shimmerColor ?? "silver") === sc.id;
                        return (
                          <button
                            key={sc.id}
                            type="button"
                            onClick={() => patchDecor({ shimmerColor: sc.id as ShimmerColorId })}
                            style={{
                              padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: isActive ? 700 : 500,
                              border: isActive ? `2px solid ${accent}` : "1.5px solid rgba(0,0,0,0.12)",
                              background: isActive ? accent + "15" : "white",
                              color: isActive ? accent : "#333", cursor: "pointer", transition: "all 0.15s",
                            }}
                          >
                            {sc.label}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => patchDecor({ backdropItems: d.backdropItems.filter(i => i.type !== "shimmer_wall") })}
                      style={{ marginTop: 10, fontSize: 11, color: "#999", background: "none", border: "none", cursor: "pointer" }}
                    >
                      Remove shimmer wall
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>}

      {/* PER-BACKDROP CUSTOMIZATION -REMOVED: inline per card now */}
      {false && d.backdropItems.length > 0 && (
        <>
        <div style={card}>
          {secLabel("Customize each backdrop")}
          {secSub("Color and add-ons for each backdrop")}

          {d.backdropItems.map((item, idx) => {
            const typeLabel = BACKDROP_SHAPES.find((s) => s.id === item.type)?.label ?? item.type;
            const sizeLabel =
              item.type === "arch"
                ? (ARCH_SIZES.find((s) => s.id === item.sizeId)?.label ?? "")
                : item.type === "rect"
                  ? (RECT_SIZES.find((s) => s.id === item.sizeId)?.label ?? "")
                  : item.widthCm
                    ? `${item.widthCm} x${item.heightCm} cm`
                    : "";

            return (
              <div key={item.id} style={{ border: `1.5px solid ${accent}28`, borderRadius: 14, padding: 14, marginBottom: 10, background: "#FAFAFA" }}>
                {/* Header */}
                <div style={{ fontSize: 12, fontWeight: 700, color: accent, marginBottom: 12 }}>
                  Backdrop {idx + 1} -{typeLabel}{sizeLabel ? ` -${sizeLabel}` : ""}
                </div>

                {/* Color */}
                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#555", display: "block", marginBottom: 6 }}>Color</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {theme.backdropColors.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => patchItem(idx, { color: hex })}
                        className={`h-8 w-8 rounded-full border shadow-sm transition ${
                          item.color === hex ? "ring-2 ring-accent ring-offset-2" : "border-black/15"
                        }`}
                        style={{ backgroundColor: hex }}
                        title={hex}
                      />
                    ))}
                    <label className="flex h-8 cursor-pointer items-center gap-1 rounded-full border border-dashed border-black/25 px-2.5 text-[11px] text-black/55">
                      Custom
                      <input
                        type="color"
                        value={item.color || d.backdropColor || "#FFFFFF"}
                        onChange={(e) => patchItem(idx, { color: e.target.value })}
                        className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0"
                      />
                    </label>
                    {item.color && (
                      <button
                        type="button"
                        onClick={() => patchItem(idx, { color: "" })}
                        style={{ fontSize: 10, color: "#BBB", background: "none", border: "none", cursor: "pointer" }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Add-ons for this backdrop */}
                <div style={{ marginBottom: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#555", display: "block", marginBottom: 8 }}>Add-ons for this backdrop</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

                    {/* Name Text card */}
                    <div
                      onClick={() => patchItemText(idx, { enabled: !item.text.enabled })}
                      style={{
                        cursor: "pointer", borderRadius: 12, padding: "12px 14px",
                        border: item.text.enabled ? `2px solid ${accent}` : "1.5px solid rgba(0,0,0,0.10)",
                        background: item.text.enabled ? accent + "10" : "white",
                        display: "flex", alignItems: "center", gap: 12, transition: "all 0.15s",
                      }}
                    >
                      <div style={{ fontSize: 22 }}></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: item.text.enabled ? accent : "#1A1A2E" }}>Customized text</div>
                        <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>A name or short message printed on the backdrop</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: item.text.enabled ? accent : "rgba(0,0,0,0.06)", color: item.text.enabled ? "white" : "#555" }}>+AED 80</span>
                        {item.text.enabled && <span style={{ fontSize: 14 }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span>}
                      </div>
                    </div>
                    {item.text.enabled && (
                    <div className="space-y-2 pl-1">
                      <textarea
                        rows={2}
                        value={item.text.value}
                        onChange={(e) => patchItemText(idx, { value: e.target.value })}
                        placeholder="Enter text for this panel"
                        className="w-full resize-none rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {FONT_STYLES.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => patchItemText(idx, { fontStyle: f.id as FontStyle })}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                              item.text.fontStyle === f.id ? "bg-accent text-white" : "bg-white text-black/60 border border-black/15"
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {TEXT_COLORS.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => patchItemText(idx, { color: c.id as TextColor })}
                            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition ${
                              item.text.color === c.id ? "border-accent bg-accent-soft/60" : "border-black/15 bg-white text-black/60"
                            }`}
                          >
                            <span className="h-3 w-3 rounded-full border border-black/10"
                              style={{ backgroundColor: c.id === "accent" ? theme.accent : c.swatch }} />
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                    {/* Theme Graphic card */}
                    <div
                      onClick={() => {
                        const enabling = !item.graphic.enabled;
                        if (enabling && !item.graphic.assetId) {
                          const catalogEntry = getThemeCatalogEntry(config.theme);
                          const presets = catalogEntry?.graphicPresets ?? FALLBACK_GRAPHIC_PRESETS;
                          const first = presets[0];
                          patchItemGraphic(idx, { enabled: true, theme: first.id, source: "preset", assetId: first.assetId });
                        } else {
                          patchItemGraphic(idx, { enabled: enabling });
                        }
                      }}
                      style={{
                        cursor: "pointer", borderRadius: 12, padding: "12px 14px",
                        border: item.graphic.enabled ? `2px solid ${accent}` : "1.5px solid rgba(0,0,0,0.10)",
                        background: item.graphic.enabled ? accent + "10" : "white",
                        display: "flex", alignItems: "center", gap: 12, transition: "all 0.15s",
                      }}
                    >
                      <div style={{ fontSize: 22 }}></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: item.graphic.enabled ? accent : "#1A1A2E" }}>Theme Graphic</div>
                        <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>Add a printed theme illustration</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: item.graphic.enabled ? accent : "rgba(0,0,0,0.06)", color: item.graphic.enabled ? "white" : "#555" }}>+AED 150</span>
                        {item.graphic.enabled && <span style={{ fontSize: 14 }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span>}
                      </div>
                    </div>
                    {/* Graphic preset sub-options when enabled */}
                    {item.graphic.enabled && (() => {
                      const catalogEntry = getThemeCatalogEntry(config.theme);
                      const presets = catalogEntry?.graphicPresets ?? FALLBACK_GRAPHIC_PRESETS;
                      return (
                        <div className="flex flex-wrap gap-1.5 pl-1 pt-2 pb-1">
                          {presets.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              title={p.desc}
                              onClick={(e) => { e.stopPropagation(); patchItemGraphic(idx, { theme: p.id, source: "preset", assetId: p.assetId }); }}
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                                item.graphic.assetId === p.assetId ? "border-accent bg-accent text-white" : "border-black/15 bg-white text-black/60"
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      );
                    })()}

                  </div>{/* -"--"- end add-ons div */}
                </div>
              </div>
            );
          })}

          {/* Shared text layout controls -visible only when any panel has text on */}
          {d.backdropItems.some((i) => i.text.enabled) && (
            <div style={{ marginTop: 6, padding: 12, background: accent + "06", borderRadius: 12, border: `1px solid ${accent}20` }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#555", display: "block", marginBottom: 10 }}>Text Layout</span>
              <div className="space-y-3">
                <div>
                  <span className="mb-1 block text-[11px] font-medium text-black/50">Alignment</span>
                  <div className="flex gap-1.5">
                    {(["left", "center", "right"] as TextAlign[]).map((a) => (
                      <button key={a} type="button" onClick={() => setText({ align: a })}
                        className={`rounded px-3 py-1 text-xs font-medium transition capitalize ${
                          t.align === a ? "bg-accent text-white" : "bg-white text-black/60 border border-black/15"
                        }`}>{a}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-black/50">Font size</span>
                    <span className="text-[11px] text-black/40">{t.fontSize}</span>
                  </div>
                  <input type="range" min={1} max={10} step={1} value={t.fontSize}
                    onChange={(e) => setText({ fontSize: Number(e.target.value) })} className="w-full accent-accent" />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-black/50">Line spacing</span>
                    <span className="text-[11px] text-black/40">{(t.lineHeight / 100).toFixed(1)}--</span>
                  </div>
                  <input type="range" min={100} max={240} step={10} value={t.lineHeight}
                    onChange={(e) => setText({ lineHeight: Number(e.target.value) })} className="w-full accent-accent" />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-black/50">Vertical position</span>
                    <span className="text-[11px] text-black/40">{t.verticalOffset}%</span>
                  </div>
                  <input type="range" min={0} max={90} step={5} value={t.verticalOffset}
                    onChange={(e) => setText({ verticalOffset: Number(e.target.value) })} className="w-full accent-accent" />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-black/50">Horizontal position</span>
                    <span className="text-[11px] text-black/40">{t.horizontalOffset}%</span>
                  </div>
                  <input type="range" min={0} max={100} step={5} value={t.horizontalOffset}
                    onChange={(e) => setText({ horizontalOffset: Number(e.target.value) })} className="w-full accent-accent" />
                </div>
              </div>
            </div>
          )}
        </div>
        </>
      )}

      {/* == 3 · STYLE YOUR SETUP ============================== */}
      <div style={{ background: "white", border: `1px solid ${DC.cardBd}`, borderRadius: 18, padding: 18, marginBottom: 14, boxShadow: DC.cardShadow }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          {numBadge(3)}
          <div>
            <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 18, color: DC.plum, lineHeight: 1.15 }}>Add your balloons</div>
            <div style={{ fontSize: 11.5, color: DC.muted }}>Choose a garland — or skip it — then fine-tune the colors.</div>
            {d.backdropItems.length > 0 && d.balloonStyle === "none" && nextCue("Optional — add a garland")}
          </div>
        </div>

      {/* Garland choice — balloons are opt-in (2026-07-20). They used to be
          pre-added by the package's defaultDecor with no way to decline. */}
      <div style={{ ...card, marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: DC.faint, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 9 }}>
          Balloon garland
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {BALLOON_STYLES.map((b) => {
            const active = d.balloonStyle === b.id;
            return (
              <button key={b.id} type="button" onClick={() => patchDecor({ balloonStyle: b.id })} aria-pressed={active}
                style={{
                  textAlign: "left", cursor: "pointer", borderRadius: 12, padding: "9px 11px",
                  border: active ? "1.5px solid #D8548A" : "1px solid #ECE7E4",
                  background: "white",
                  boxShadow: active ? "0 0 0 3px #FBE9EF" : "none",
                }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: active ? DC.roseDeep : DC.plum, lineHeight: 1.2 }}>
                  {b.id === "none" ? "No balloons" : b.label}
                </div>
                <div style={{ fontSize: 10.5, color: DC.faint, marginTop: 2 }}>
                  {b.price > 0 ? `+AED ${b.price}` : "Skip"}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* SEMPERTEX PICKER -default: chips only; expanded: full browser */}
      <div style={{ ...card, opacity: d.balloonStyle === "none" ? 0.5 : 1 }}>
        {/* Garland note */}
        <div style={{ marginBottom: 14, padding: "8px 14px", background: DC.chipBg, borderRadius: 12, fontSize: 11, color: DC.roseDeep, fontWeight: 600 }}>
          {d.balloonStyle === "none"
            ? "Pick a garland above to choose balloon colors."
            : "These are the exact Sempertex shades our team will inflate on the day."}
        </div>

        {/* Selected chips row -always visible */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: DC.faint, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Balloon colors · Sempertex ({effectiveSempertexSelection.length}/5)
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" onClick={resetToThemePalette}
                style={{ fontSize: 11, fontWeight: 600, color: "#73778A", background: "transparent", border: "1px solid #ECEAF1", borderRadius: 999, padding: "3px 10px", cursor: "pointer", opacity: sempertexManual ? 1 : 0.45 }}>
                Reset to theme
              </button>
              <button type="button" onClick={() => setShowSempertexBrowser(v => !v)}
                style={{ fontSize: 11, fontWeight: 700, color: showSempertexBrowser ? "#EC4D8D" : "#15182E", background: "transparent", border: showSempertexBrowser ? "1px solid #EC4D8D" : "1px solid #D1D5DB", borderRadius: 999, padding: "3px 12px", cursor: "pointer" }}>
                {showSempertexBrowser ? "Done" : "Change colors"}
              </button>
            </div>
          </div>

          {/* Chips — rendered directly from effectiveSempertexSelection (single source of truth) */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, minHeight: 34 }}>
            {effectiveSempertexSelection.length === 0 && (
              <span style={{ fontSize: 12, color: "#A1A3B4", fontStyle: "italic" }}>No colors selected -click "Change colors" to pick.</span>
            )}
            {effectiveSempertexSelection.map(c => (
              <button key={c.id} type="button" onClick={() => toggleSempertex(c.id)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px 4px 6px", borderRadius: 999, border: "1.5px solid #F7A7C8", background: "#FFF7FB", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#15182E" }}>
                <span style={{ width: 14, height: 14, borderRadius: "50%", background: c.hex, border: "1px solid rgba(0,0,0,0.12)", flexShrink: 0, display: "inline-block" }} />
                {c.code} -{c.colorName}
                <span style={{ marginLeft: 2, color: "#EC4D8D", fontWeight: 900 }}>-</span>
              </button>
            ))}
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
      </div>

      {/* BACKDROP PRINT -moved to Customize each backdrop */}
      {false && <div style={card}>
        {secLabel("Add text or design")}
        {secSub("Add a printed graphic or text to your backdrop")}
        <div className="grid grid-cols-2 gap-2">
          {BACKDROP_PRINTS.map((opt) => {
            const selected = print.type === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPrint(opt.id)}
                style={{
                  position: "relative",
                  border: selected ? `2px solid ${accent}` : "1.5px solid rgba(0,0,0,0.1)",
                  background: selected ? accent + "10" : "white",
                  borderRadius: 14, padding: 12, textAlign: "left", transition: "all 0.15s",
                }}
              >
                {selected && (
                  <span style={{
                    position: "absolute", top: 5, right: 5, width: 16, height: 16,
                    borderRadius: "50%", background: accent, color: "white",
                    fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700,
                  }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                )}
                <div style={{ fontSize: 12, fontWeight: 600, color: selected ? accent : "#1A1A2E" }}>{opt.label}</div>
                <div style={{ marginTop: 2, fontSize: 11, color: "rgba(0,0,0,0.5)" }}>{opt.desc}</div>
                {opt.price > 0 && (
                  <span style={{
                    marginTop: 6, fontSize: 11, fontWeight: 700, display: "inline-block",
                    color: accent, background: accent + "18", padding: "2px 8px", borderRadius: 20,
                  }}>+AED {opt.price}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Theme print suggestion + graphic style chips */}
        {print.type === "theme_print" && (
          <>
            <p className="mt-2 rounded-xl bg-accent-soft/40 px-3 py-2 text-[11px] text-black/60">
              <span className="font-medium">Suggested for {theme.name}:</span>{" "}
              {THEME_PRINT_SUGGESTIONS[config.theme] ?? "Themed decorative illustration"}
            </p>
            <div className="mt-2">
              <span className="mb-1.5 block text-[11px] font-medium text-black/50">Graphic style</span>
              <div className="flex flex-wrap gap-1.5">
                {GRAPHIC_STYLES.map((s) => {
                  const active = (print.graphicStyle ?? "illustrated") === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      title={s.desc}
                      onClick={() => setGraphicStyle(s.id as GraphicStyle)}
                      className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${
                        active
                          ? "border-accent bg-accent text-white shadow-sm"
                          : "border-black/15 bg-white text-black/60 hover:border-accent/50 hover:text-accent"
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-[10px] text-black/35">
                {GRAPHIC_STYLES.find((s) => s.id === (print.graphicStyle ?? "illustrated"))?.desc}
              </p>
            </div>
          </>
        )}

        {/* Name input (reuses backdropText.name) */}
        {print.type === "name_only" && (
          <div className="mt-2">
            <input
              type="text"
              value={t.name}
              onChange={(e) => setText({ name: e.target.value })}
              placeholder="Child's name (e.g. Sofia)"
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </div>
        )}

        {/* File upload */}
        {print.type === "custom_upload" && (
          <div className="mt-2 rounded-xl border border-dashed border-black/20 p-3">
            <label className="block cursor-pointer">
              <span className="text-[11px] font-medium text-black/60">
                Upload your reference design or inspiration image
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPrintFile(e.target.files?.[0] ?? null)}
                className="mt-1.5 block w-full text-xs text-black/50 file:mr-2 file:rounded-full file:border-0 file:bg-accent-soft file:px-3 file:py-1 file:text-[11px] file:font-medium file:text-accent"
              />
              {printFile != null && (
                <span className="mt-1 block text-[11px] text-accent">{(printFile as File).name}</span>
              )}
            </label>
            <p className="mt-1.5 text-[11px] text-black/40">
              Our design team will finalize the print layout.
            </p>
          </div>
        )}
      </div>}

      </div>{/* -"--"- end BALLOONS section -"--"- */}

      {/* == 4 · ADD EXTRA MAGIC =============================== */}
      <div style={{ background: "white", border: `1px solid ${DC.cardBd}`, borderRadius: 18, padding: 18, marginBottom: 14, boxShadow: DC.cardShadow }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          {numBadge(4)}
          <div>
            <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 18, color: DC.plum, lineHeight: 1.15 }}>Add extra magic</div>
            <div style={{ fontSize: 11.5, color: DC.muted }}>Optional extras — standees and cake plinths.</div>
          </div>
        </div>

      {/* CHARACTER STANDEES */}
<div style={card}>
  {secLabel("Character standees")}
  {secSub("Pick who joins the party — each standee is a 150 cm feature piece.")}

  <div className="space-y-3">
    {/* 1 — Choose characters (multi-select, NOTHING preselected) */}
    <div className="rounded-[16px] border border-black/10 bg-white p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: DC.roseDeep }}>1 · Choose characters</div>
          <div className="text-[11px]" style={{ color: DC.muted }}>Tap a character to add it — each standee is 150 cm, +AED 180.</div>
        </div>
        {selectedCutoutAssets.length > 0 && (
          <button
            type="button"
            onClick={clearAllStandees}
            className="shrink-0 rounded-full border border-black/15 bg-white px-2.5 py-1 text-[10px] font-bold text-black/50 transition hover:border-accent/50 hover:text-accent"
          >
            No standees — clear all
          </button>
        )}
      </div>

      <div className={`grid grid-cols-2 gap-2 ${cutoutPresetOptions.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
        {cutoutPresetOptions.map((preset) => {
          const selected = selectedCutoutAssets.some((a) => a.assetId === preset.assetId);

          return (
            <button
              key={preset.assetId}
              type="button"
              onClick={() => toggleCutoutAsset({ assetId: preset.assetId, label: preset.label, previewUrl: (preset as any).previewUrl || undefined })}
              className={`relative rounded-[16px] border p-2.5 text-left transition ${
                selected
                  ? "border-accent bg-accent/10 shadow-sm"
                  : "border-black/10 bg-white hover:border-accent/40"
              }`}
            >
              {selected && (
                <span className="absolute -right-1.5 -top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white shadow-md">
                  <svg width="11" height="11" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
              )}
              {(preset as any).previewUrl ? (
                <div className={`mb-2 flex h-28 items-center justify-center overflow-hidden rounded-[12px] ${selected ? "bg-accent/10" : "bg-[#FDF3F8]"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={(preset as any).previewUrl}
                    alt={preset.label}
                    className="h-full w-full object-contain"
                  />
                </div>
              ) : null}
              <div className="text-[12px] font-extrabold text-[#12162F]">{preset.label}</div>
              <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-black/50">
                {(preset as any).description ?? (preset as any).promptDescription ?? (preset as any).desc ?? preset.label}
              </div>
            </button>
          );
        })}
      </div>

      {selectedCutoutAssets.length === 0 && (
        <div className="mt-2 rounded-[12px] bg-black/[0.03] px-3 py-2 text-[11px] font-medium text-black/40">
          No characters selected yet. Choose one or more designs above.
        </div>
      )}
    </div>

    {/* 2 — Your standee squad. Sizes were removed (2026-07-20): standees now
        ship in one standard 150cm height, so choosing the character is the
        entire decision and there is nothing left to configure per asset. */}
    {cutoutTotalCount(normalizedCut) > 0 && (() => {
      const single = CUTOUT_STANDEE_OPTIONS.find((o) => o.size === "large")!;
      const lines = selectedCutoutAssets.map((asset) => ({
        text:  `${asset.label} · ${single.heightCm} cm`,
        price: `AED ${single.unitPrice * (asset.quantities.large ?? 0)}`,
      }));
      return (
        <div style={{ background: "white", border: `1.5px dashed ${DC.dashedBd}`, borderRadius: 16, padding: "13px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: DC.roseDeep }}>2 · Your standee squad</div>
          {lines.map((line) => (
            <div key={line.text} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 12.5, color: DC.plum }}><span aria-hidden style={{ color: DC.rose }}>·</span> {line.text}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: DC.plum }}>{line.price}</span>
            </div>
          ))}
          <div style={{ fontSize: 10.5, color: DC.faint }}>They&apos;ll appear in your render after you regenerate · Total +AED {cutoutPrice(normalizedCut)}</div>
        </div>
      );
    })()}
  </div>
</div>

      {/* PLINTHS */}
      <div style={card}>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, color: DC.plum }}>Cake plinths</div>
          <div style={{ fontSize: 11.5, color: DC.muted }}>Elegant columns that put your cake center-stage beside the backdrop.</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: DC.faint, textTransform: "uppercase", marginRight: 2 }}>How many?</span>
          {[0, 1, 2, 3].map((n) => {
            const active = d.plinths === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setPlinthCount(n)}
                style={{
                  width: 36, height: 36, borderRadius: "50%", fontSize: 13, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s",
                  background: active ? DC.rose : "white",
                  border: `1.5px solid ${active ? DC.rose : DC.cardBd}`,
                  color: active ? "white" : DC.faint,
                  boxShadow: active ? "0 6px 14px rgba(216,84,138,.3)" : "none",
                }}
              >
                {n === 0 ? "0" : n}
              </button>
            );
          })}
        </div>
        {d.plinths > 0 && (
          <div className="mt-3 space-y-2">
            {Array.from({ length: d.plinths }).map((_, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: "white", border: `1.5px solid ${DC.cardBd}`, borderRadius: 14, padding: "9px 13px" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: DC.plum, minWidth: 56 }}>Plinth {i + 1}</span>
                <div className="flex flex-wrap gap-1.5">
                  {PLINTH_SIZES.map((s) => {
                    const sel = d.plinthSizes[i] === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setPlinthSize(i, s.id)}
                        style={{
                          padding: "5px 13px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                          background: sel ? DC.chipBg : "white",
                          border: `1.5px solid ${sel ? DC.dashedBd : DC.cardBd}`,
                          color: sel ? DC.roseDeep : DC.muted,
                        }}
                      >
                        {PLINTH_SHORT[s.id] ?? s.label} <span style={{ opacity: 0.7 }}>+{s.price}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      </div>{/* -"--"- end EXTRAS section -"--"- */}
    </div>
  );
}









