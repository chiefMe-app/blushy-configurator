"use client";

import { Plus_Jakarta_Sans } from "next/font/google";
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["500", "600", "700", "800"] });

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
import { getThemeCatalogEntry, FALLBACK_GRAPHIC_PRESETS } from "@/lib/themeCatalog";
import SetupPreview, { useSetupPreview } from "@/components/SetupPreview";
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
    <main style={accentStyle} className={`min-h-screen ${jakarta.className}`}>
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            {/* Clean sparkle mark -no circle, just the star SVG */}
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ flexShrink: 0 }}>
              <path d="M14 3L16.5 10.5L24 13L16.5 15.5L14 23L11.5 15.5L4 13L11.5 10.5L14 3Z" fill="#EC4D8D"/>
              <circle cx="5" cy="5" r="1.2" fill="#F7A7C8"/>
              <circle cx="23" cy="22" r="1.2" fill="#F7A7C8"/>
              <circle cx="23" cy="5" r="0.8" fill="#EC4D8D" opacity="0.4"/>
            </svg>
            <div style={{ lineHeight: 1 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#15182E", letterSpacing: "-0.5px", lineHeight: 1.05 }}>Blushy</div>
              <div style={{ fontSize: 8, fontWeight: 800, color: "#EC4D8D", letterSpacing: "0.18em", textTransform: "uppercase", marginTop: 2 }}>Birthday Builder</div>
            </div>
          </div>

          {/* Step navigation -centered pills */}
          <nav className="hidden lg:flex items-center gap-1">
            {STEPS.map((s, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <button
                  key={i}
                  onClick={() => i <= step && setStep(i)}
                  style={{
                    display: "flex", alignItems: "center", gap: 5, padding: "5px 12px",
                    borderRadius: 999, fontSize: 12, fontWeight: active ? 700 : 500,
                    background: active ? "#FF6B9D" : done ? "#FFF0F5" : "transparent",
                    color: active ? "white" : done ? "#FF6B9D" : "rgba(0,0,0,0.4)",
                    border: active ? "none" : done ? "1.5px solid #FFB8D1" : "1.5px solid rgba(0,0,0,0.1)",
                    cursor: i <= step ? "pointer" : "default",
                    transition: "all 0.15s",
                  }}
                >
                  <span style={{
                    width: 18, height: 18, borderRadius: "50%", fontSize: 10, fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: active ? "rgba(255,255,255,0.25)" : done ? "#FF6B9D" : "rgba(0,0,0,0.08)",
                    color: active ? "white" : done ? "white" : "rgba(0,0,0,0.4)",
                  }}>
                    {done ? "v" : i + 1}
                  </span>
                  {s}
                </button>
              );
            })}
          </nav>

          {/* Total */}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "#A1A3B4", fontWeight: 800, letterSpacing: "0.10em" }}>ESTIMATED TOTAL</div>
            <TotalBadge config={config} />
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "20px 28px 0", display: "flex", gap: 26, alignItems: "flex-start" }}>
        {/* Left: preview rail - fixed 356px */}
        <div style={{ width: 356, flexShrink: 0 }}>
          <div className="lg:sticky" style={{ top: 72 }}>
            <div className="space-y-3">
              {/* Preview card -overflow hidden keeps confetti contained */}
              <div style={{ position: "relative", overflow: "hidden", minHeight: 408, borderRadius: 20, border: "1.5px solid #F1D8E2", boxShadow: "0 14px 32px rgba(39,40,68,0.06)", background: "linear-gradient(150deg, #FFF7FB 0%, #FBF2FF 50%, #FFF9F5 100%)" }}>
                {/* Confetti - pointer-events none, confined inside overflow:hidden */}
                <div aria-hidden style={{ pointerEvents: "none", position: "absolute", inset: 0 }}>
                  {/* Dots */}
                  <div style={{ position: "absolute", top: 16, left: 26, width: 8, height: 8, borderRadius: "50%", background: "#FFB8D1", opacity: 0.6 }} />
                  <div style={{ position: "absolute", top: 52, right: 22, width: 6, height: 6, borderRadius: "50%", background: "#C4B5FD", opacity: 0.5 }} />
                  <div style={{ position: "absolute", bottom: 32, left: 40, width: 5, height: 5, borderRadius: "50%", background: "#FCA5A5", opacity: 0.45 }} />
                  <div style={{ position: "absolute", top: 190, right: 16, width: 7, height: 7, borderRadius: "50%", background: "#86EFAC", opacity: 0.4 }} />
                  <div style={{ position: "absolute", bottom: 95, right: 30, width: 5, height: 5, borderRadius: "50%", background: "#FBBF24", opacity: 0.35 }} />
                  {/* Rectangles / confetti */}
                  <div style={{ position: "absolute", top: 92, left: 16, width: 12, height: 4, borderRadius: 2, background: "#93C5FD", opacity: 0.42, transform: "rotate(-28deg)" }} />
                  <div style={{ position: "absolute", top: 135, right: 28, width: 5, height: 14, borderRadius: 2, background: "#FBBF84", opacity: 0.38, transform: "rotate(22deg)" }} />
                  <div style={{ position: "absolute", bottom: 68, right: 20, width: 11, height: 4, borderRadius: 2, background: "#A5B4FC", opacity: 0.4, transform: "rotate(-15deg)" }} />
                  <div style={{ position: "absolute", bottom: 108, left: 20, width: 8, height: 3, borderRadius: 2, background: "#F9A8D4", opacity: 0.45, transform: "rotate(12deg)" }} />
                  <div style={{ position: "absolute", top: 248, left: 14, width: 6, height: 10, borderRadius: 2, background: "#C4B5FD", opacity: 0.35, transform: "rotate(-10deg)" }} />
                  {/* Small sparkle SVGs */}
                  <svg style={{ position: "absolute", top: 38, left: 52, opacity: 0.35 }} width="10" height="10" viewBox="0 0 10 10"><path d="M5 1l.9 2.8L8.8 5 5.9 6.2 5 9l-.9-2.8L1.2 5l2.9-1.2z" fill="#EC4D8D"/></svg>
                  <svg style={{ position: "absolute", bottom: 48, left: 18, opacity: 0.3 }} width="10" height="10" viewBox="0 0 10 10"><path d="M5 1l.9 2.8L8.8 5 5.9 6.2 5 9l-.9-2.8L1.2 5l2.9-1.2z" fill="#A78BFA"/></svg>
                  <svg style={{ position: "absolute", top: 310, right: 18, opacity: 0.3 }} width="8" height="8" viewBox="0 0 10 10"><path d="M5 1l.9 2.8L8.8 5 5.9 6.2 5 9l-.9-2.8L1.2 5l2.9-1.2z" fill="#F472B6"/></svg>
                </div>
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
        <div style={{ flex: 1, minWidth: 680, paddingBottom: 96 }}>

          <div>
            {step === 0 && (
              <div>
                {/* Intro band */}
                <div style={{ background: "white", border: "1.5px solid #F1D8E2", borderRadius: 18, padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14, boxShadow: "0 2px 10px rgba(39,40,68,0.04)" }}>
                  {/* Sparkle icon */}
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M14 4L16 11L23 13L16 15L14 22L12 15L5 13L12 11Z" fill="#EC4D8D" opacity="0.8"/>
                    <circle cx="6" cy="6" r="1.2" fill="#F7A7C8"/>
                    <circle cx="22" cy="21" r="1.2" fill="#F7A7C8"/>
                  </svg>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#15182E" }}>Let's bring your celebration to life</div>
                    <div style={{ fontSize: 12, color: "#73778A", marginTop: 2 }}>Choose the event so we can tailor ideas and styling just for you.</div>
                  </div>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 18, flexShrink: 0 }}>
                    {([
                      [<svg key="a" width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#EC4D8D" strokeWidth="1.5"/><path d="M5 8l2 2 4-4" stroke="#EC4D8D" strokeWidth="1.5" strokeLinecap="round"/></svg>, "Personalized ideas"],
                       [<svg key="b" width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="#FFE8F0"/><path d="M8 4v4l3 2" stroke="#EC4D8D" strokeWidth="1.5" strokeLinecap="round"/></svg>, "Saves you time"],
                       [<svg key="c" width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="#FFE8F0"/><path d="M8 5l1 3H12l-2.5 1.8.9 3L8 11.3l-2.4 1.5.9-3L4 8h3z" fill="#EC4D8D"/></svg>, "Stress-free planning"],
                    ] as [React.ReactNode, string][]).map(([icon, text]) => (
                      <div key={text} style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", justifyContent: "center" }}>{icon}</div>
                        <div style={{ fontSize: 10, color: "#73778A", fontWeight: 600, marginTop: 2, whiteSpace: "nowrap" }}>{text}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section heading */}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#15182E", letterSpacing: "-0.4px" }}>What are we celebrating?</div>
                  <div style={{ fontSize: 13, color: "#73778A", marginTop: 4, fontWeight: 500 }}>Pick the event that best describes your celebration. You can always change it later.</div>
                </div>

                {/* Event cards -3 col desktop, premium pastel */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                  {EVENT_TYPES.map((e) => {
                    const sel = config.eventType === e.id;
                    return (
                      <button key={e.id} type="button" onClick={() => setEventType(e.id)}
                        style={{
                          position: "relative", textAlign: "center", cursor: "pointer",
                          borderRadius: 18, padding: "28px 16px 22px",
                          border: sel ? "2px solid #F7A7C8" : "1.5px solid #ECEAF1",
                          background: sel ? "linear-gradient(145deg,#FFF7FB 0%,#FFFFFF 100%)" : "white",
                          boxShadow: sel ? "0 8px 28px rgba(236,77,141,0.10)" : "0 2px 8px rgba(39,40,68,0.04)",
                          transition: "all 0.18s",
                        }}>
                        {sel && (
                          <span style={{ position: "absolute", top: 10, right: 10, width: 22, height: 22, borderRadius: "50%", background: "#EC4D8D", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </span>
                        )}
                        {/* Event icon - inline SVG per type */}
                        <div style={{ fontSize: 36, marginBottom: 10, display: "flex", justifyContent: "center" }}>
                          {e.id === "birthday" && <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="8" y="20" width="24" height="14" rx="4" fill="#FBCFE8"/><rect x="12" y="15" width="16" height="7" rx="2" fill="#F9A8D4"/><path d="M15 15c0-3 2-5 2-5s2 2 2 5" stroke="#EC4D8D" strokeWidth="1.5" strokeLinecap="round"/><path d="M21 15c0-3 2-5 2-5s2 2 2 5" stroke="#EC4D8D" strokeWidth="1.5" strokeLinecap="round"/><circle cx="20" cy="12" r="2" fill="#EC4D8D"/></svg>}
                          {e.id === "baby_shower" && <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><ellipse cx="20" cy="22" rx="9" ry="11" fill="#BAE6FD"/><path d="M20 11c-4-6-10-4-10 0 0 3 3 5 6 4" stroke="#7DD3FC" strokeWidth="1.5" strokeLinecap="round"/><circle cx="20" cy="11" r="2" fill="#7DD3FC"/></svg>}
                          {e.id === "bridal_shower" && <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="10" stroke="#F9A8D4" strokeWidth="2.5" fill="none"/><circle cx="20" cy="20" r="4" stroke="#EC4D8D" strokeWidth="2" fill="none"/><rect x="18" y="8" width="4" height="4" rx="1" fill="#EC4D8D"/></svg>}
                          {e.id === "boutique_wedding" && <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><path d="M20 8 L22 14 L28 14 L23 18 L25 24 L20 20 L15 24 L17 18 L12 14 L18 14 Z" fill="#FBCFE8" stroke="#EC4D8D" strokeWidth="1"/></svg>}
                          {e.id === "corporate_mini" && <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="10" y="14" width="20" height="18" rx="2" fill="#E0F2FE"/><rect x="15" y="10" width="10" height="6" rx="1" fill="#BAE6FD"/><rect x="14" y="22" width="4" height="4" rx="1" fill="#7DD3FC"/><rect x="22" y="22" width="4" height="4" rx="1" fill="#7DD3FC"/><rect x="14" y="18" width="4" height="3" rx="1" fill="#7DD3FC"/><rect x="22" y="18" width="4" height="3" rx="1" fill="#7DD3FC"/></svg>}
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: sel ? "#EC4D8D" : "#15182E", marginBottom: 4 }}>{e.label}</div>
                        <div style={{ fontSize: 12, color: "#73778A" }}>{e.description}</div>
                        {e.id === "birthday" && !sel && (
                          <div style={{ marginTop: 10, fontSize: 10, fontWeight: 700, color: "#EC4D8D", background: "#FFE8F0", padding: "2px 10px", borderRadius: 20, display: "inline-block" }}>Most popular</div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Bottom hint */}
                <div style={{ marginTop: 20, padding: "12px 16px", background: "#FFF7F0", borderRadius: 12, fontSize: 12, color: "#73778A", display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><circle cx="8" cy="8" r="7" fill="#FED7AA"/><rect x="7" y="6" width="2" height="6" rx="1" fill="#EA580C"/><circle cx="8" cy="4.5" r="1" fill="#EA580C"/></svg>
                  Not sure? You can update your event anytime, and we'll re-tailor the suggestions for you.
                </div>
              </div>
            )}

            {step === 1 && (
              <StepShell title="Pick your theme">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {THEMES.map((t) => {
                    const sel = config.themeSelected && config.theme === t.id;
                    // Per-theme SVG icon - pure inline SVG, no emoji
                    const THEME_ICONS: Record<string, React.ReactNode> = {
                      frozen: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><line x1="11" y1="2" x2="11" y2="20" stroke="#7DD3FC" strokeWidth="2" strokeLinecap="round"/><line x1="2" y1="11" x2="20" y2="11" stroke="#7DD3FC" strokeWidth="2" strokeLinecap="round"/><line x1="4.5" y1="4.5" x2="17.5" y2="17.5" stroke="#BAE6FD" strokeWidth="1.5" strokeLinecap="round"/><line x1="17.5" y1="4.5" x2="4.5" y2="17.5" stroke="#BAE6FD" strokeWidth="1.5" strokeLinecap="round"/><circle cx="11" cy="11" r="2" fill="#38BDF8"/></svg>,
                      unicorn: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M11 3l1.2 3.6L16 8l-3.8 1.4L11 13l-1.2-3.6L6 8l3.8-1.4z" fill="#C084FC"/><circle cx="4" cy="4" r="1.5" fill="#F9A8D4"/><circle cx="18" cy="17" r="1.5" fill="#86EFAC"/><circle cx="17" cy="5" r="1" fill="#FDE68A"/></svg>,
                      dinosaur: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><ellipse cx="11" cy="13" rx="6" ry="5" fill="#86EFAC"/><path d="M7 8 Q11 4 15 8" stroke="#4ADE80" strokeWidth="1.5" fill="none" strokeLinecap="round"/><circle cx="9" cy="11" r="1" fill="#15803D"/><circle cx="13" cy="11" r="1" fill="#15803D"/></svg>,
                      safari: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="7" fill="#FDE68A"/><path d="M11 4v3M11 15v3M4 11h3M15 11h3" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round"/><circle cx="11" cy="11" r="2.5" fill="#D97706"/></svg>,
                      princess: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M5 14h12l-2-6-4 4-4-4-2 6z" fill="#F9A8D4"/><path d="M7 10V6l4 3 4-3v4" stroke="#EC4D8D" strokeWidth="1.2" fill="none" strokeLinejoin="round"/><circle cx="11" cy="5" r="1.5" fill="#EC4D8D"/><circle cx="6" cy="9" r="1" fill="#FBCFE8"/><circle cx="16" cy="9" r="1" fill="#FBCFE8"/></svg>,
                      superhero: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M11 3l2.5 6 6 .5-4.5 4 1.5 6L11 17l-5.5 2.5 1.5-6-4.5-4 6-.5z" fill="#FDE68A" stroke="#D97706" strokeWidth="0.8"/></svg>,
                      barbie: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M11 4l1.5 4.5H20l-5.5 4 2 5.5L11 15l-5.5 3 2-5.5L2 8.5h7.5z" fill="#FF69B4" opacity="0.8"/></svg>,
                      bluey: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="7" fill="#93C5FD"/><circle cx="8" cy="9" r="1.5" fill="#1D4ED8"/><circle cx="14" cy="9" r="1.5" fill="#1D4ED8"/><path d="M8 14 Q11 17 14 14" stroke="#1D4ED8" strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>,
                      pokemon: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="8" stroke="#EF4444" strokeWidth="2.5"/><rect x="3" y="9.5" width="16" height="3" fill="white"/><rect x="3" y="9.5" width="16" height="3" fill="#EF4444" opacity="0.5"/><circle cx="11" cy="11" r="2.5" fill="white" stroke="#EF4444" strokeWidth="1.5"/></svg>,
                      stitch: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="12" r="7" fill="#60A5FA"/><ellipse cx="8" cy="9" rx="1.5" ry="2" fill="#1D4ED8"/><ellipse cx="14" cy="9" rx="1.5" ry="2" fill="#1D4ED8"/><path d="M8 15 Q11 18 14 15" stroke="#1D4ED8" strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>,
                      mermaid: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4 18 Q11 12 18 18" stroke="#2DD4BF" strokeWidth="2.5" strokeLinecap="round" fill="none"/><path d="M6 14 Q11 8 16 14" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.7"/><circle cx="11" cy="7" r="3" fill="#67E8F9" opacity="0.8"/></svg>,
                      space: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="14" cy="10" r="5" fill="#818CF8"/><circle cx="14" cy="10" r="3" fill="#312E81"/><ellipse cx="14" cy="10" rx="8" ry="2.5" stroke="#A5B4FC" strokeWidth="1.2" fill="none"/><circle cx="5" cy="5" r="1" fill="#FDE68A"/><circle cx="18" cy="17" r="1.2" fill="#FDE68A"/><circle cx="4" cy="16" r="0.8" fill="white" opacity="0.7"/></svg>,
                      football: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="8" fill="#4ADE80"/><path d="M3 11h16M11 3v16" stroke="white" strokeWidth="1.2" opacity="0.5"/></svg>,
                      lego: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="4" y="8" width="14" height="10" rx="2" fill="#EF4444"/><circle cx="8" cy="8" r="2" fill="#DC2626"/><circle cx="14" cy="8" r="2" fill="#DC2626"/></svg>,
                      kpop: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M11 4l1.2 3.6L16 8l-3.8 1.4L11 13l-1.2-3.6L6 8l3.8-1.4z" fill="#E879F9"/><circle cx="4" cy="15" r="1.5" fill="#C084FC"/><circle cx="18" cy="15" r="1.5" fill="#F472B6"/><circle cx="11" cy="18" r="1" fill="#A78BFA"/></svg>,
                      encanto: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="4" fill="#FDE68A"/><path d="M11 3 Q14 7 11 11 Q8 7 11 3z" fill="#4ADE80"/><path d="M11 11 Q15 8 19 11 Q15 14 11 11z" fill="#F97316"/><path d="M11 19 Q14 15 11 11 Q8 15 11 19z" fill="#EC4899"/><path d="M11 11 Q7 8 3 11 Q7 14 11 11z" fill="#A78BFA"/></svg>,
                      cocomelon: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="12" r="7" fill="#86EFAC"/><path d="M8 10 Q11 8 14 10" stroke="#15803D" strokeWidth="1.5" strokeLinecap="round" fill="none"/><path d="M8 14 Q11 16 14 14" stroke="#15803D" strokeWidth="1.2" strokeLinecap="round" fill="none"/></svg>,
                      teddy_bear: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="13" r="6" fill="#D4A574"/><circle cx="6" cy="7" r="3" fill="#C8956C"/><circle cx="16" cy="7" r="3" fill="#C8956C"/><circle cx="9" cy="12" r="1" fill="#7B3F00"/><circle cx="13" cy="12" r="1" fill="#7B3F00"/><path d="M9 15 Q11 17 13 15" stroke="#7B3F00" strokeWidth="1.2" strokeLinecap="round" fill="none"/></svg>,
                      pineapple_tropical: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><ellipse cx="11" cy="14" rx="5" ry="6" fill="#FDE68A"/><path d="M9 8 Q11 4 13 8" stroke="#4ADE80" strokeWidth="1.5" fill="none" strokeLinecap="round"/><path d="M7 7 Q11 3 15 7" stroke="#86EFAC" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>,
                      blush_garden: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="4" fill="#F9A8D4"/><circle cx="11" cy="6" r="2.5" fill="#FBCFE8"/><circle cx="16" cy="11" r="2.5" fill="#FBCFE8"/><circle cx="11" cy="16" r="2.5" fill="#FBCFE8"/><circle cx="6" cy="11" r="2.5" fill="#FBCFE8"/></svg>,
                      luxury_neutral: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="5" y="14" width="12" height="4" rx="1.5" fill="#D4B896"/><rect x="7" y="10" width="8" height="5" rx="1" fill="#EDE0D0"/><path d="M11 3l1.5 6-1.5 1-1.5-1z" fill="#FFD54F" stroke="#D97706" strokeWidth="0.5"/></svg>,
                    };
                    const icon = THEME_ICONS[t.id] ?? <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M11 4l1.2 3.6L16 8l-3.8 1.4L11 13l-1.2-3.6L6 8l3.8-1.4z" fill="#F9A8D4"/></svg>;
                    return (
                      <button key={t.id} type="button" onClick={() => setTheme(t.id)} aria-pressed={sel}
                        className={`relative flex w-full flex-col gap-2 rounded-2xl border p-4 text-left transition ${sel ? "border-accent bg-accent-soft/60 shadow-sm" : "border-black/10 bg-white hover:border-accent/40"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span>{icon}</span>
                            <span className="text-sm font-semibold">{t.name}</span>
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${sel ? "bg-accent text-white" : "bg-black/5 text-black/60"}`}>
                            {t.priceModifier > 0 ? `+AED ${t.priceModifier}` : "Included"}
                          </span>
                        </div>
                        {t.balloonColors.length > 0 && (
                          <div className="flex -space-x-1">
                            {t.balloonColors.slice(0, 5).map((c, i) => <span key={i} className="h-5 w-5 rounded-full border border-white shadow-sm" style={{ backgroundColor: c }}/>)}
                          </div>
                        )}
                        <span className="text-xs leading-snug text-black/50">{t.desc}</span>
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
        disabled={isReview && !canSubmit}
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
      <h2 className="text-lg font-semibold">{title}</h2>
      {subtitle && <p className="mb-4 mt-0.5 text-xs text-black/50">{subtitle}</p>}
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
const cutoutPresetOptions = getThemeGraphicPresets(config.theme);
const selectedCutoutPresetId =
  normalizedCut.presetAssetId ?? cutoutPresetOptions[0]?.assetId ?? `${config.theme}-01`;

function patchCutouts(next: Partial<typeof normalizedCut>) {
  patchDecor({
    cutouts: {
      ...normalizedCut,
      ...next,
    },
  });
}

function setCutoutQuantity(size: CutoutStandeeItem["size"], quantity: number) {
  const currentItems =
    normalizedCut.items?.length ? normalizedCut.items : emptyCutoutStandees();

  const nextItems = currentItems.map((item) =>
    item.size === size
      ? { ...item, quantity: Math.max(0, Math.min(9, quantity)) }
      : item,
  );

  const total = nextItems.reduce((sum, item) => sum + item.quantity, 0);

  patchDecor({
    cutouts: {
      ...normalizedCut,
      mode: total > 0 ? "standees" : "none",
      size: "none",
      position: "floor",
      source: "preset",
      presetAssetId: selectedCutoutPresetId,
      items: nextItems,
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
  const card: React.CSSProperties = {
    background: "white",
    borderRadius: 16,
    padding: "14px 14px",
    marginBottom: 10,
    boxShadow: "0 1px 4px rgba(18,22,47,0.05), 0 4px 16px rgba(18,22,47,0.04)",
    border: "1px solid #ECEAF1",
  };
  const numBadge = (n: number) => (
    <div style={{
      width: 28, height: 28, borderRadius: "50%", background: "#EC4F91",
      color: "white", fontSize: 13, fontWeight: 800, letterSpacing: "-0.3px",
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      boxShadow: "0 4px 10px rgba(236,79,145,0.30)",
    }}>{n}</div>
  );
  const secLabel = (text: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
      <span style={{ width: 3, height: 16, borderRadius: 2, background: accent, display: "inline-block", flexShrink: 0 }} />
      <span style={{ fontSize: 14, fontWeight: 800, color: "#12162F", letterSpacing: "-0.3px" }}>{text}</span>
    </div>
  );
  const secSub = (text: string) => (
    <p style={{ fontSize: 12, color: "#727386", marginTop: 2, marginBottom: 10, fontWeight: 500 }}>{text}</p>
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
      if (d.backdropItems.filter(i => i.type !== "round").length >= 3) return;
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
      if (d.backdropItems.length >= 3) return;
      const withoutRound = d.backdropItems.filter(i => i.type !== "round");
      const newItem = makeBackdropItem(type);
      patchDecor({ backdropItems: [...withoutRound, newItem] });
      setOpenCustomizeIds(prev => { const n = new Set(prev); n.add(newItem.id); return n; });
    }
  }

  // Readable type labels for summaries
  const TYPE_LABEL: Record<string, string> = { arch: "Arch Backdrop", rect: "Rectangular Backdrop", round: "Round Backdrop", shimmer_wall: "Shimmer Wall" };

  // Collapsible customize row -shows summary + button, expands on demand
  function BackdropCustomizeRow({ item, itemIdx }: { item: BackdropItem; itemIdx: number }) {
    const sizeLabelMap = Object.fromEntries([...ARCH_SIZES, ...RECT_SIZES].map(s => [s.id, s.label]));
    const sizeStr = item.sizeId ? (sizeLabelMap[item.sizeId] ?? `${item.widthCm} x ${item.heightCm} cm`) : `${item.widthCm} x ${item.heightCm} cm`;
    const summaryLabel = `Backdrop ${itemIdx + 1} - ${TYPE_LABEL[item.type] ?? item.type} - ${sizeStr}`;
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
            <ItemCustomization item={item} itemIdx={itemIdx} />
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
          {/* Name Text */}
          <div onClick={() => patchItemText(itemIdx, { enabled: !item.text.enabled })}
            style={{ cursor: "pointer", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10,
              border: item.text.enabled ? `2px solid ${accent}` : "1.5px solid rgba(0,0,0,0.08)",
              background: item.text.enabled ? accent + "0E" : "white", transition: "all 0.15s" }}>
            <span style={{ fontSize: 18 }}></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: item.text.enabled ? accent : "#1A1A2E" }}>Name Text</div>
              <div style={{ fontSize: 11, color: "#999" }}>Add child's name or short message</div>
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

          {/* Custom Design */}
          <div onClick={() => setPrint(print.type === "custom_upload" ? "none" : "custom_upload")}
            style={{ cursor: "pointer", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10,
              border: print.type === "custom_upload" ? `2px solid ${accent}` : "1.5px solid rgba(0,0,0,0.08)",
              background: print.type === "custom_upload" ? accent + "0E" : "white", transition: "all 0.15s" }}>
            <span style={{ fontSize: 18 }}></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: print.type === "custom_upload" ? accent : "#1A1A2E" }}>Custom Design</div>
              <div style={{ fontSize: 11, color: "#999" }}>Upload your own design</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
              background: print.type === "custom_upload" ? accent : "rgba(0,0,0,0.06)", color: print.type === "custom_upload" ? "white" : "#555" }}>+AED 200</span>
          </div>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className={jakarta.className}>
      {/* == BACKDROP SECTION ================================== */}
      <div style={{ background: "white", border: "1.5px solid #F1D8E2", borderRadius: 18, padding: "16px 14px", marginBottom: 18, boxShadow: "0 4px 20px rgba(39,40,68,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          {numBadge(1)}
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#12162F", letterSpacing: "-0.3px" }}>Pick your backdrop</div>
            <div style={{ fontSize: 13, color: "#727386", marginTop: 3, fontWeight: 500 }}>Choose the perfect backdrop style and size for your celebration.</div>
          </div>
        </div>

      {/* -"--"- UNIFIED BACKDROP SELECTOR -"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"- */}
      <div style={{ background: "white", borderRadius: 16, padding: "16px", marginBottom: 0, border: "1px solid #F1D8E2" }}>
        {/* 4 type cards in a row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {[
            { type: "arch" as const, label: "Arch Backdrop", badge: "Most popular", click: () => { const hasArch = d.backdropItems.some(i=>i.type==="arch"); if(!hasArch) toggleArchSize(ARCH_SIZES[1]); else patchDecor({ backdropItems: d.backdropItems.filter(i=>i.type!=="arch") }); } },
            { type: "rect" as const, label: "Rectangular Backdrop", badge: null, click: () => toggleOtherType("rect") },
            { type: "round" as const, label: "Round Backdrop", badge: null, click: () => toggleRound() },
            { type: "shimmer_wall" as const, label: "Shimmer Wall", badge: "Glam pick", click: () => toggleOtherType("shimmer_wall") },
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

        {/* Arch size selector -shown when arch is selected */}
        {d.backdropItems.some(i => i.type === "arch") && (
          <div style={{ marginTop: 16, padding: "14px 16px", background: "#FFF7FB", borderRadius: 12, border: "1px solid #F1D8E2" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#73778A", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>Choose size</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {ARCH_SIZES.map((size) => {
                const archItem = d.backdropItems.find(i => i.type === "arch" && i.sizeId === size.id);
                const isSelected = !!archItem;
                const itemIdx = isSelected ? d.backdropItems.findIndex(i => i.id === archItem?.id) : -1;
                const isMedium = size.id === "medium";
                return (
                  <div key={size.id}>
                    <button type="button" onClick={() => toggleArchSize(size)}
                      disabled={!isSelected && d.backdropItems.length >= 3}
                      style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "11px 14px", borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
                        border: isSelected ? "2px solid #EC4D8D" : "1.5px solid #ECEAF1",
                        background: isSelected ? "white" : "white",
                        boxShadow: isSelected ? "0 2px 10px rgba(236,77,141,0.12)" : "none",
                        opacity: !isSelected && d.backdropItems.length >= 3 ? 0.4 : 1 }}>
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? "#EC4D8D" : "#15182E" }}>{size.label}</div>
                        <div style={{ fontSize: 11, color: "#73778A", marginTop: 1 }}>{size.widthCm} x{size.heightCm} cm</div>
                      </div>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", border: isSelected ? "none" : "1.5px solid #ECEAF1", background: isSelected ? "#EC4D8D" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {isSelected && <span style={{ color: "white", fontSize: 12, fontWeight: 900 }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span>}
                      </div>
                    </button>
                    {isSelected && archItem && itemIdx >= 0 && (
                      <BackdropCustomizeRow item={archItem} itemIdx={itemIdx} />
                    )}
                    {isMedium && !d.backdropItems.some(i => i.type === "arch") && (
                      <div style={{ marginTop: 6, padding: "8px 12px", background: "#F8F0FF", borderRadius: 10, border: "1px solid #D8B4FE", display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ fontSize: 14 }}></span>
                        <div style={{ fontSize: 11, color: "#666" }}><span style={{ fontWeight: 700, color: "#7C3AED" }}>Pro tip:</span> Medium is our most popular size.</div>
                      </div>
                    )}
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
              <BackdropCustomizeRow item={rectItem} itemIdx={itemIdx} />
            </div>
          ) : null;
        })()}

        {/* Round customization */}
        {d.backdropItems.some(i => i.type === "round") && (() => {
          const roundItem = d.backdropItems.find(i => i.type === "round");
          const itemIdx = roundItem ? d.backdropItems.findIndex(i => i.id === roundItem.id) : -1;
          return roundItem && itemIdx >= 0 ? <BackdropCustomizeRow item={roundItem} itemIdx={itemIdx} /> : null;
        })()}

        {/* Shimmer color selector + customization */}
        {d.backdropItems.some(i => i.type === "shimmer_wall") && (() => {
          const shimmerItem = d.backdropItems.find(i => i.type === "shimmer_wall");
          const itemIdx = shimmerItem ? d.backdropItems.findIndex(i => i.id === shimmerItem.id) : -1;
          return (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 8 }}>Shimmer color</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {SHIMMER_COLORS.map(sc => {
                  const isActive = (d.shimmerColor ?? "silver") === sc.id;
                  return (
                    <button key={sc.id} type="button" onClick={() => patchDecor({ shimmerColor: sc.id as ShimmerColorId })}
                      style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: isActive ? 700 : 500,
                        border: isActive ? "2px solid #FF6B9D" : "1.5px solid rgba(0,0,0,0.12)",
                        background: isActive ? "#FFF0F5" : "white", color: isActive ? "#FF6B9D" : "#333", cursor: "pointer" }}>
                      {sc.label}
                    </button>
                  );
                })}
              </div>
              {shimmerItem && itemIdx >= 0 && <BackdropCustomizeRow item={shimmerItem} itemIdx={itemIdx} />}
            </div>
          );
        })()}

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
                            disabled={!isSelected && d.backdropItems.length >= 3}
                            style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                              padding: "10px 14px", borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
                              border: isSelected ? `2px solid ${accent}` : "1.5px solid rgba(0,0,0,0.08)",
                              background: isSelected ? accent + "12"
                                : size.id === "small"  ? "#FFF8F4"
                                : size.id === "medium" ? "#FFF0F5"
                                : size.id === "large"  ? "#F5F0FF"
                                : "white",
                              opacity: !isSelected && d.backdropItems.length >= 3 ? 0.4 : 1 }}>
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
                          {isSelected && archItem && itemIdx >= 0 && (
                            <ItemCustomization item={archItem} itemIdx={itemIdx} />
                          )}
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
                      if (d.backdropItems.length >= 3) return;
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
                    <ItemCustomization item={roundItem} itemIdx={itemIdx} />
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
                      if (d.backdropItems.length >= 3) return;
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
                        <div style={{ fontSize: 13, fontWeight: 700, color: item.text.enabled ? accent : "#1A1A2E" }}>Name Text</div>
                        <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>Add child's name or short message</div>
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

                    {/* Custom Design card -global setting, surfaced per-backdrop */}
                    <div
                      onClick={() => setPrint(print.type === "custom_upload" ? "none" : "custom_upload")}
                      style={{
                        cursor: "pointer", borderRadius: 12, padding: "12px 14px",
                        border: print.type === "custom_upload" ? `2px solid ${accent}` : "1.5px solid rgba(0,0,0,0.10)",
                        background: print.type === "custom_upload" ? accent + "10" : "white",
                        display: "flex", alignItems: "center", gap: 12, transition: "all 0.15s",
                      }}
                    >
                      <div style={{ fontSize: 22 }}></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: print.type === "custom_upload" ? accent : "#1A1A2E" }}>Custom Design</div>
                        <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>Upload your own design</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: print.type === "custom_upload" ? accent : "rgba(0,0,0,0.06)", color: print.type === "custom_upload" ? "white" : "#555" }}>+AED 200</span>
                        {print.type === "custom_upload" && <span style={{ fontSize: 14 }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span>}
                      </div>
                    </div>
                    {print.type === "custom_upload" && (
                      <div className="rounded-xl border border-dashed border-black/20 p-3">
                        <label className="block cursor-pointer">
                          <span className="text-[11px] font-medium text-black/60">Upload design or inspiration image</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => setPrintFile(e.target.files?.[0] ?? null)}
                            className="mt-1 block w-full text-xs text-black/50 file:mr-2 file:rounded-full file:border-0 file:bg-accent-soft file:px-3 file:py-1 file:text-[11px] file:font-medium file:text-accent"
                          />
                          {printFile != null && <span className="mt-1 block text-[11px] text-accent">{(printFile as File).name}</span>}
                        </label>
                      </div>
                    )}
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
      </div>{/* -"--"- end BACKDROP section -"--"- */}

      {/* == BALLOONS SECTION ================================== */}
      <div style={{ background: "#EFF8FF", border: "1px solid #BFDBFE", borderRadius: 18, padding: "12px 10px", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          {numBadge(2)}
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#12162F", letterSpacing: "-0.3px" }}>Sempertex balloon colors</div>
            <div style={{ fontSize: 13, color: "#727386", marginTop: 3, fontWeight: 500 }}>We selected a palette for your theme. You can adjust up to 5 shades.</div>
          </div>
        </div>

      {/* SEMPERTEX PICKER -default: chips only; expanded: full browser */}
      <div style={card}>
        {/* Garland note */}
        <div style={{ marginBottom: 14, padding: "8px 14px", background: "#F0F9FF", borderRadius: 10, border: "1px solid #BAE6FD", fontSize: 12, color: "#0369A1", fontWeight: 600 }}>
          * Garland style is included in your package -this step only selects production colors.
        </div>

        {/* Selected chips row -always visible */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#73778A", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {sempertexManual ? `Selected colors (${effectiveSempertexSelection.length}/5)` : `Theme palette selected (${effectiveSempertexSelection.length}/5)`}
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

      {/* == EXTRAS SECTION ==================================== */}
      <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 18, padding: "12px 10px", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          {numBadge(3)}
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#12162F", letterSpacing: "-0.3px" }}>Add extra magic</div>
            <div style={{ fontSize: 13, color: "#727386", marginTop: 3, fontWeight: 500 }}>Enhance your setup with props and finishing touches.</div>
          </div>
        </div>

      {/* CHARACTER STANDEES */}
<div style={card}>
  {secLabel("Character standees")}
  {secSub("Freestanding printed foam-board cutouts for your setup")}

  <div className="space-y-3">
    <button
      type="button"
      onClick={() =>
        patchDecor({
          cutouts: {
            size: "none",
            mode: "none",
            position: "floor",
            source: "preset",
            presetAssetId: selectedCutoutPresetId,
            items: emptyCutoutStandees(),
          },
        })
      }
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        border: cutoutTotalCount(normalizedCut) === 0 ? `2px solid ${accent}` : "1.5px solid rgba(0,0,0,0.1)",
        background: cutoutTotalCount(normalizedCut) === 0 ? accent + "10" : "white",
        borderRadius: 14,
        padding: 12,
        textAlign: "left",
        transition: "all 0.15s",
      }}
    >
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: cutoutTotalCount(normalizedCut) === 0 ? accent : "#1A1A2E" }}>
          No standees
        </div>
        <div className="text-[11px] text-black/50">Skip freestanding cutouts for this setup</div>
      </div>
      <span style={checkBadge(cutoutTotalCount(normalizedCut) === 0)}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
    </button>

    <div className="rounded-[16px] border border-black/10 bg-white p-3">
      <div className="mb-3">
        <div className="text-[12px] font-extrabold text-[#12162F]">Choose standalone cutout sizes</div>
        <div className="text-[11px] text-black/50">
          Add 150 cm, 100 cm, and 60 cm foam-board standees. Price updates per item.
        </div>
      </div>

      <div className="space-y-2">
        {CUTOUT_STANDEE_OPTIONS.map((option) => {
          const item =
            normalizedCut.items?.find((i) => i.size === option.size) ??
            { ...option, quantity: 0 };

          return (
            <div
              key={option.size}
              className="flex items-center justify-between gap-3 rounded-[14px] border border-black/10 bg-white px-3 py-3"
            >
              <div>
                <div className="text-[12px] font-bold text-[#12162F]">{option.label}</div>
                <div className="text-[11px] text-black/50">{option.heightCm} cm tall standalone character cutout</div>
                <div className="mt-1 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-600">
                  +AED {option.unitPrice} each
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCutoutQuantity(option.size, item.quantity - 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-black/15 bg-white text-lg font-bold text-black/60"
                >
                  −
                </button>
                <div className="w-7 text-center text-sm font-extrabold text-[#12162F]">{item.quantity}</div>
                <button
                  type="button"
                  onClick={() => setCutoutQuantity(option.size, item.quantity + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-black/15 bg-white text-lg font-bold text-black/60"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {cutoutTotalCount(normalizedCut) > 0 && (
        <div className="mt-3 rounded-[12px] bg-accent/10 px-3 py-2 text-[12px] font-bold text-accent">
          {cutoutTotalCount(normalizedCut)} standee(s) selected · +AED {cutoutPrice(normalizedCut)}
        </div>
      )}
    </div>

    {cutoutTotalCount(normalizedCut) > 0 && (
      <div className="rounded-[16px] border border-black/10 bg-white p-3">
        <div className="mb-2">
          <div className="text-[12px] font-extrabold text-[#12162F]">Choose character style</div>
          <div className="text-[11px] text-black/50">Theme-matched preset options. Later these can become real uploaded assets.</div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {cutoutPresetOptions.map((preset) => {
            const selected = selectedCutoutPresetId === preset.assetId;

            return (
              <button
                key={preset.assetId}
                type="button"
                onClick={() =>
                  patchCutouts({
                    mode: "standees",
                    size: "none",
                    position: "floor",
                    source: "preset",
                    presetAssetId: preset.assetId,
                  })
                }
                className={`rounded-[14px] border p-3 text-left transition ${
                  selected
                    ? "border-accent bg-accent/10"
                    : "border-black/10 bg-white hover:border-accent/40"
                }`}
              >
                <div className="text-[12px] font-extrabold text-[#12162F]">{preset.label}</div>
                <div className="mt-1 line-clamp-3 text-[11px] leading-snug text-black/50">
                  {(preset as any).description ?? (preset as any).promptDescription ?? (preset as any).desc ?? preset.label}
                </div>
                {selected && (
                  <div className="mt-2 inline-flex rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-white">
                    Selected
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    )}
  </div>
</div>

      {/* PLINTHS */}
      <div style={card}>
        {secLabel("Cake stands")}
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3].map((n) => {
            const active = d.plinths === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setPlinthCount(n)}
                style={active
                  ? { background: accent, color: "white", border: `2px solid ${accent}`, borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 500, transition: "all 0.15s" }
                  : { background: "white", color: "rgba(0,0,0,0.6)", border: "1.5px solid rgba(0,0,0,0.15)", borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 500, transition: "all 0.15s" }}
              >
                {n}
              </button>
            );
          })}
        </div>
        {d.plinths > 0 && (
          <div className="mt-3 space-y-2">
            {Array.from({ length: d.plinths }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-[11px] text-black/50">Plinth {i + 1}</span>
                <div className="flex flex-wrap gap-1.5">
                  {PLINTH_SIZES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setPlinthSize(i, s.id)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                        d.plinthSizes[i] === s.id
                          ? "bg-accent text-white"
                          : "bg-white text-black/60 border border-black/15"
                      }`}
                    >
                      {PLINTH_SHORT[s.id] ?? s.label}
                      <span className={d.plinthSizes[i] === s.id ? "text-white/80" : "text-black/40"}>
                        {" "}+{s.price}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CAKE TABLE */}
      <div style={card}>
        {secLabel("Dessert table")}
        <div className="flex flex-wrap gap-2">
          {[
            { id: "no", label: "No" },
            { id: "yes", label: "Yes" },
          ].map((o) => {
            const active = (d.cakeTable ? "yes" : "no") === o.id;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => patchDecor({ cakeTable: o.id === "yes" })}
                style={active
                  ? { background: accent, color: "white", border: `2px solid ${accent}`, borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 500, transition: "all 0.15s" }
                  : { background: "white", color: "rgba(0,0,0,0.6)", border: "1.5px solid rgba(0,0,0,0.15)", borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 500, transition: "all 0.15s" }}
              >
                {o.label}
                {o.id === "yes" && <span style={chip(`+${CAKE_TABLE_PRICE}`, active)}>+{CAKE_TABLE_PRICE}</span>}
              </button>
            );
          })}
        </div>
      </div>
      </div>{/* -"--"- end EXTRAS section -"--"- */}
    </div>
  );
}









