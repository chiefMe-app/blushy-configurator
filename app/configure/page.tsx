"use client";

import { Plus_Jakarta_Sans } from "next/font/google";
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["500", "600", "700", "800"] });

import { useMemo, useState } from "react";
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
   * Selecting a service package only updates the service level — it never
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
      // Route logs payload if no table is configured — still treat as success.
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
            🎉
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
              📱 We will contact you on WhatsApp to confirm venue, availability and final quote.
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
    <main style={accentStyle} className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-black/5 bg-warmwhite/90 px-4 py-3 backdrop-blur">
        <div>
          <h1 className="text-base font-bold leading-none">Blushy Birthday Builder</h1>
          <p className="text-[11px] text-black/45">Design your party setup in minutes</p>
        </div>
        <TotalBadge config={config} />
      </header>

      <div className="mx-auto max-w-6xl lg:flex lg:gap-8 lg:px-6 lg:py-6">
        {/* Left: preview (sticky on desktop) */}
        <div className="px-4 pt-4 lg:w-1/2 lg:px-0 lg:pt-0">
          <div className="lg:sticky lg:top-24">{Preview}</div>
        </div>

        {/* Right: steps */}
        <div className="px-4 pb-32 pt-5 lg:w-1/2 lg:px-0 lg:pb-24 lg:pt-0">
          <StepNavigation steps={STEPS} current={step} onSelect={setStep} />

          <div className="mt-6">
            {step === 0 && (
              <StepShell title="What are we celebrating?">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {EVENT_TYPES.map((e) => (
                    <OptionCard
                      key={e.id}
                      selected={config.eventType === e.id}
                      onClick={() => setEventType(e.id)}
                      emoji={e.emoji}
                      title={e.label}
                      subtitle={e.description}
                    />
                  ))}
                </div>
              </StepShell>
            )}

            {step === 1 && (
              <StepShell title="Pick your theme">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {THEMES.map((t) => (
                    <OptionCard
                      key={t.id}
                      selected={config.theme === t.id}
                      onClick={() => setTheme(t.id)}
                      emoji={t.emoji}
                      title={t.name}
                      subtitle={t.desc}
                      swatches={t.balloonColors}
                      priceBadge={t.priceModifier > 0 ? `+AED ${t.priceModifier}` : "Included"}
                    />
                  ))}
                </div>
              </StepShell>
            )}

            {step === 2 && (
              <StepShell title="Customize your decor">
                <DecorStep config={config} patchDecor={patchDecor} />
              </StepShell>
            )}

            {step === 3 && (
              <StepShell
                title="Choose your service package"
                subtitle="Your design is ready — now choose how you want to use it."
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
                                <span className="mt-[3px] text-accent">✓</span>
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
                                <span className="mt-[3px] text-accent">✓</span>
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

function DecorStep({
  config,
  patchDecor,
}: {
  config: BuilderConfig;
  patchDecor: (p: Partial<DecorConfig>) => void;
}) {
  const [printFile, setPrintFile] = useState<File | null>(null);
  const [showAdvancedPanel, setShowAdvancedPanel] = useState(false);

  const d = config.decor;
  const theme = themeById(config.theme)!;
  const t = d.backdropText;
  const cut = d.cutouts;
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
    padding: 16,
    marginBottom: 12,
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  };
  const numBadge = (n: number) => (
    <div style={{
      width: 28, height: 28, borderRadius: "50%", background: "#FF6B9D",
      color: "white", fontSize: 14, fontWeight: 800,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>{n}</div>
  );
  const secLabel = (text: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <span style={{ width: 3, height: 16, borderRadius: 2, background: accent, display: "inline-block", flexShrink: 0 }} />
      <span style={{ fontSize: 15, fontWeight: 800, color: "#1A1A2E", letterSpacing: "-0.2px" }}>{text}</span>
    </div>
  );
  const secSub = (text: string) => (
    <p style={{ fontSize: 12, color: "#888", marginTop: 2, marginBottom: 10 }}>{text}</p>
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
      } else {
        const newItem = { ...makeBackdropItem("arch"), sizeId: size.id, widthCm: size.widthCm, heightCm: size.heightCm, id: `arch-${size.id}` };
        patchDecor({ backdropItems: [...d.backdropItems, newItem] });
      }
    }
  }

  // Toggle round — exclusive (removes all others)
  function toggleRound() {
    const hasRound = d.backdropItems.some(i => i.type === "round");
    if (hasRound) {
      patchDecor({ backdropItems: [] });
    } else {
      patchDecor({ backdropItems: [makeBackdropItem("round")] });
    }
  }

  // Toggle non-arch/non-round types (rect, shimmer) — removes round if present
  function toggleOtherType(type: BackdropShapeId) {
    const hasThis = d.backdropItems.some(i => i.type === type);
    if (hasThis) {
      patchDecor({ backdropItems: d.backdropItems.filter(i => i.type !== type) });
    } else {
      if (d.backdropItems.length >= 3) return;
      const withoutRound = d.backdropItems.filter(i => i.type !== "round");
      patchDecor({ backdropItems: [...withoutRound, makeBackdropItem(type)] });
    }
  }

  function ItemCustomization({ item, itemIdx }: { item: BackdropItem; itemIdx: number }) {
    return (
      <div style={{ borderTop: `1px solid ${accent}25`, paddingTop: 12, marginTop: 10 }}>
        {/* Color */}
        <div style={{ marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#555", display: "block", marginBottom: 6 }}>Backdrop color</span>
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
            <span style={{ fontSize: 18 }}>✍️</span>
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
          <div onClick={() => patchItemGraphic(itemIdx, { enabled: !item.graphic.enabled })}
            style={{ cursor: "pointer", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10,
              border: item.graphic.enabled ? `2px solid ${accent}` : "1.5px solid rgba(0,0,0,0.08)",
              background: item.graphic.enabled ? accent + "0E" : "white", transition: "all 0.15s" }}>
            <span style={{ fontSize: 18 }}>🎨</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: item.graphic.enabled ? accent : "#1A1A2E" }}>Theme Graphic</div>
              <div style={{ fontSize: 11, color: "#999" }}>Add a printed theme illustration</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
              background: item.graphic.enabled ? accent : "rgba(0,0,0,0.06)", color: item.graphic.enabled ? "white" : "#555" }}>+AED 150</span>
          </div>

          {/* Custom Design */}
          <div onClick={() => setPrint(print.type === "custom_upload" ? "none" : "custom_upload")}
            style={{ cursor: "pointer", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10,
              border: print.type === "custom_upload" ? `2px solid ${accent}` : "1.5px solid rgba(0,0,0,0.08)",
              background: print.type === "custom_upload" ? accent + "0E" : "white", transition: "all 0.15s" }}>
            <span style={{ fontSize: 18 }}>📎</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: print.type === "custom_upload" ? accent : "#1A1A2E" }}>Custom Design</div>
              <div style={{ fontSize: 11, color: "#999" }}>Upload your own design</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
              background: print.type === "custom_upload" ? accent : "rgba(0,0,0,0.06)", color: print.type === "custom_upload" ? "white" : "#555" }}>+AED 200</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={jakarta.className}>
      {/* ══ BACKDROP SECTION ══════════════════════════════════ */}
      <div style={{ background: "#F7F1FF", border: "1px solid #D8B4FE", borderRadius: 20, padding: "14px 12px", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          {numBadge(1)}
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#1A1A2E" }}>Pick your backdrop</div>
            <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>Choose the perfect backdrop style and size for your celebration.</div>
          </div>
        </div>

      {/* BACKDROP TYPE — 4-card horizontal grid */}
      <div style={card}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
          {/* ARCH card */}
          {(() => {
            const hasArch = d.backdropItems.some(i => i.type === "arch");
            return (
              <div
                onClick={() => toggleArchSize(ARCH_SIZES[1])}
                style={{
                  border: hasArch ? "2.5px solid #FF6B9D" : "1.5px solid rgba(0,0,0,0.08)",
                  borderRadius: 16, padding: "16px 12px", textAlign: "center",
                  background: hasArch ? "#FFF0F5" : "white", cursor: "pointer",
                  position: "relative", transition: "all 0.15s", minHeight: 140,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                }}
              >
                {hasArch && <span style={{ position: "absolute", top: 8, right: 8, background: "#FF6B9D", color: "white", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>✓</span>}
                <span style={{ position: "absolute", top: 8, left: 8, background: "#FFE8F0", color: "#FF6B9D", fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20 }}>Most popular</span>
                <BackdropShapePreview type="arch" color={hasArch ? "#FF6B9D" : "#F2D4E0"} />
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 8, color: hasArch ? "#FF6B9D" : "#1A1A2E" }}>Arch</div>
              </div>
            );
          })()}
          {/* RECT card */}
          {(() => {
            const hasRect = d.backdropItems.some(i => i.type === "rect");
            return (
              <div
                onClick={() => toggleOtherType("rect")}
                style={{
                  border: hasRect ? "2.5px solid #FF6B9D" : "1.5px solid rgba(0,0,0,0.08)",
                  borderRadius: 16, padding: "16px 12px", textAlign: "center",
                  background: hasRect ? "#FFF0F5" : "white", cursor: "pointer",
                  position: "relative", transition: "all 0.15s", minHeight: 140,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                }}
              >
                {hasRect && <span style={{ position: "absolute", top: 8, right: 8, background: "#FF6B9D", color: "white", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>✓</span>}
                <BackdropShapePreview type="rect" color={hasRect ? "#FF6B9D" : "#F2D4E0"} />
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 8, color: hasRect ? "#FF6B9D" : "#1A1A2E" }}>Rect</div>
              </div>
            );
          })()}
          {/* ROUND card */}
          {(() => {
            const hasRound = d.backdropItems.some(i => i.type === "round");
            return (
              <div
                onClick={toggleRound}
                style={{
                  border: hasRound ? "2.5px solid #FF6B9D" : "1.5px solid rgba(0,0,0,0.08)",
                  borderRadius: 16, padding: "16px 12px", textAlign: "center",
                  background: hasRound ? "#FFF0F5" : "white", cursor: "pointer",
                  position: "relative", transition: "all 0.15s", minHeight: 140,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                }}
              >
                {hasRound && <span style={{ position: "absolute", top: 8, right: 8, background: "#FF6B9D", color: "white", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>✓</span>}
                <BackdropShapePreview type="round" color={hasRound ? "#FF6B9D" : "#F2D4E0"} />
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 8, color: hasRound ? "#FF6B9D" : "#1A1A2E" }}>Round</div>
              </div>
            );
          })()}
          {/* SHIMMER WALL card */}
          {(() => {
            const hasShimmer = d.backdropItems.some(i => i.type === "shimmer_wall");
            return (
              <div
                onClick={() => toggleOtherType("shimmer_wall")}
                style={{
                  border: hasShimmer ? "2.5px solid #FF6B9D" : "1.5px solid rgba(0,0,0,0.08)",
                  borderRadius: 16, padding: "16px 12px", textAlign: "center",
                  background: hasShimmer ? "#FFF0F5" : "white", cursor: "pointer",
                  position: "relative", transition: "all 0.15s", minHeight: 140,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                }}
              >
                {hasShimmer && <span style={{ position: "absolute", top: 8, right: 8, background: "#FF6B9D", color: "white", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>✓</span>}
                <span style={{ position: "absolute", top: 8, left: 8, background: "#FFE8F0", color: "#FF6B9D", fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20 }}>✨ Glam pick</span>
                <BackdropShapePreview type="shimmer_wall" color={hasShimmer ? "#FF6B9D" : "#F2D4E0"} />
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 8, color: hasShimmer ? "#FF6B9D" : "#1A1A2E" }}>Shimmer</div>
              </div>
            );
          })()}
        </div>

        {d.backdropItems.length === 0
          ? <div style={{ fontSize: 13, color: "#888", fontStyle: "italic", marginBottom: 10, padding: "8px 0" }}>Choose a backdrop to start ↑</div>
          : <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>You can mix up to 3 arch, rectangular, or shimmer pieces. Round works on its own.</div>
        }

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* ARCH BACKDROP */}
          {(() => {
            const archItems = d.backdropItems.filter(i => i.type === "arch");
            const hasArch = archItems.length > 0;
            return (
              <div style={{ border: hasArch ? `2.5px solid ${accent}` : "1.5px solid rgba(0,0,0,0.10)", borderRadius: 14, overflow: "hidden", background: hasArch ? accent + "08" : "white", transition: "all 0.15s" }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: hasArch ? accent + "20" : "#F3F0FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🔮</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: hasArch ? accent : "#1A1A2E" }}>Arch Backdrop</div>
                    <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Rounded event backdrop · select 1–3 sizes</div>
                  </div>
                  {hasArch && <span style={{ fontSize: 18, color: accent }}>✓</span>}
                </div>
                {/* Size options — always visible */}
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
                              <div style={{ fontSize: 11, color: "#999" }}>{size.widthCm} × {size.heightCm} cm</div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                                background: isSelected ? accent : "rgba(0,0,0,0.06)", color: isSelected ? "white" : "#555" }}>
                                {isSelected && itemIdx === 0 ? "Included" : "+AED 350"}
                              </span>
                              {isSelected && <span style={{ color: accent, fontSize: 14 }}>✓</span>}
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
                  }}>🟫</div>
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
                    {hasRectCard && <span style={{ fontSize: 16 }}>✓</span>}
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
                              <div style={{ fontSize: 11, color: "#999" }}>{size.widthCm} × {size.heightCm} cm</div>
                            </div>
                            {isSelected && <span style={{ color: accent, fontWeight: 700, fontSize: 16 }}>✓</span>}
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
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: hasRound ? accent + "20" : "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>⭕</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: hasRound ? accent : "#1A1A2E" }}>Round Backdrop</div>
                    <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Soft circular backdrop · used alone · 120 × 120 cm</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: hasRound ? accent : "rgba(0,0,0,0.06)", color: hasRound ? "white" : "#555" }}>
                      {hasRound && itemIdx === 0 ? "Included" : "+AED 350"}
                    </span>
                    {hasRound && <span style={{ fontSize: 16 }}>✓</span>}
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
                  }}>✨</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: hasShimmer ? accent : "#1A1A2E" }}>Shimmer Wall</div>
                    <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Sparkly sequin wall · 200 × 200 cm</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                      background: hasShimmer ? accent : "rgba(0,0,0,0.06)",
                      color: hasShimmer ? "white" : "#555",
                    }}>
                      {hasShimmer && d.backdropItems.indexOf(shimmerItems[0]) === 0 ? "Included" : "+AED 430"}
                    </span>
                    {hasShimmer && <span style={{ fontSize: 16 }}>✓</span>}
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
        </div>
      </div>

      {/* PER-BACKDROP CUSTOMIZATION — REMOVED: inline per card now */}
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
                    ? `${item.widthCm} × ${item.heightCm} cm`
                    : "";

            return (
              <div key={item.id} style={{ border: `1.5px solid ${accent}28`, borderRadius: 14, padding: 14, marginBottom: 10, background: "#FAFAFA" }}>
                {/* Header */}
                <div style={{ fontSize: 12, fontWeight: 700, color: accent, marginBottom: 12 }}>
                  Backdrop {idx + 1} — {typeLabel}{sizeLabel ? ` · ${sizeLabel}` : ""}
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
                      <div style={{ fontSize: 22 }}>✍️</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: item.text.enabled ? accent : "#1A1A2E" }}>Name Text</div>
                        <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>Add child's name or short message</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: item.text.enabled ? accent : "rgba(0,0,0,0.06)", color: item.text.enabled ? "white" : "#555" }}>+AED 80</span>
                        {item.text.enabled && <span style={{ fontSize: 14 }}>✓</span>}
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
                      onClick={() => patchItemGraphic(idx, { enabled: !item.graphic.enabled })}
                      style={{
                        cursor: "pointer", borderRadius: 12, padding: "12px 14px",
                        border: item.graphic.enabled ? `2px solid ${accent}` : "1.5px solid rgba(0,0,0,0.10)",
                        background: item.graphic.enabled ? accent + "10" : "white",
                        display: "flex", alignItems: "center", gap: 12, transition: "all 0.15s",
                      }}
                    >
                      <div style={{ fontSize: 22 }}>🎨</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: item.graphic.enabled ? accent : "#1A1A2E" }}>Theme Graphic</div>
                        <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>Add a printed theme illustration</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: item.graphic.enabled ? accent : "rgba(0,0,0,0.06)", color: item.graphic.enabled ? "white" : "#555" }}>+AED 150</span>
                        {item.graphic.enabled && <span style={{ fontSize: 14 }}>✓</span>}
                      </div>
                    </div>
                    {/* Graphic style sub-options when enabled */}
                    {item.graphic.enabled && (
                      <div className="flex flex-wrap gap-1.5 pl-1 pt-2 pb-1">
                        {GRAPHIC_STYLES.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            title={s.desc}
                            onClick={(e) => { e.stopPropagation(); patchItemGraphic(idx, { style: s.id as GraphicStyle }); }}
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                              item.graphic.style === s.id ? "border-accent bg-accent text-white" : "border-black/15 bg-white text-black/60"
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Custom Design card — global setting, surfaced per-backdrop */}
                    <div
                      onClick={() => setPrint(print.type === "custom_upload" ? "none" : "custom_upload")}
                      style={{
                        cursor: "pointer", borderRadius: 12, padding: "12px 14px",
                        border: print.type === "custom_upload" ? `2px solid ${accent}` : "1.5px solid rgba(0,0,0,0.10)",
                        background: print.type === "custom_upload" ? accent + "10" : "white",
                        display: "flex", alignItems: "center", gap: 12, transition: "all 0.15s",
                      }}
                    >
                      <div style={{ fontSize: 22 }}>📎</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: print.type === "custom_upload" ? accent : "#1A1A2E" }}>Custom Design</div>
                        <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>Upload your own design</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: print.type === "custom_upload" ? accent : "rgba(0,0,0,0.06)", color: print.type === "custom_upload" ? "white" : "#555" }}>+AED 200</span>
                        {print.type === "custom_upload" && <span style={{ fontSize: 14 }}>✓</span>}
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
                  </div>{/* ── end add-ons div */}
                </div>
              </div>
            );
          })}

          {/* Shared text layout controls — visible only when any panel has text on */}
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
                    <span className="text-[11px] text-black/40">{(t.lineHeight / 100).toFixed(1)}×</span>
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

      </div>{/* ── end BACKDROP section ── */}

      {/* ══ BALLOONS SECTION ══════════════════════════════════ */}
      <div style={{ background: "#EFF8FF", border: "1px solid #BFDBFE", borderRadius: 20, padding: "14px 12px", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          {numBadge(2)}
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#1A1A2E" }}>Add balloons</div>
            <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>Pick a style and color palette to bring your backdrop to life.</div>
          </div>
        </div>

      {/* BALLOON STYLE + COLORS — side by side */}
      <div style={card}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "start" }}>
          {/* Style cards */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 8 }}>Style</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
              {(() => {
                const BALLOON_META: Record<string, { icon: string; desc: string; badge?: string }> = {
                  none:    { icon: "🫧", desc: "Keep it minimal" },
                  half:    { icon: "🎈", desc: "Balloons on one side", badge: "Most popular" },
                  full:    { icon: "🎪", desc: "Balloons all around", badge: "Best impact" },
                  premium: { icon: "🌸", desc: "Luxury balloon styling", badge: "Luxury finish" },
                };
                const BG: Record<string, string> = { none: "#F9FAFB", half: "#EFF6FF", full: "#F5F3FF", premium: "#FFF7ED" };
                return BALLOON_STYLES.map((o) => {
                  const active = o.id === d.balloonStyle;
                  const meta = BALLOON_META[o.id] ?? { icon: "🎈", desc: "" };
                  return (
                    <div key={o.id} onClick={() => patchDecor({ balloonStyle: o.id })}
                      style={{
                        cursor: "pointer", borderRadius: 14, padding: "12px 10px", textAlign: "center", position: "relative",
                        border: active ? "2.5px solid #FF6B9D" : "1.5px solid rgba(0,0,0,0.08)",
                        background: active ? "#FFF0F5" : BG[o.id] ?? "white",
                        transition: "all 0.15s", minHeight: 90,
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
                      }}>
                      {active && <span style={{ position: "absolute", top: 6, right: 6, background: "#FF6B9D", color: "white", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>✓</span>}
                      {meta.badge && <span style={{ position: "absolute", top: 6, left: 6, background: active ? "#FF6B9D" : "#FFE8F0", color: active ? "white" : "#FF6B9D", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 20 }}>🚀 {meta.badge}</span>}
                      <span style={{ fontSize: 24, marginTop: meta.badge ? 12 : 0 }}>{meta.icon}</span>
                      <div style={{ fontSize: 12, fontWeight: 700, color: active ? "#FF6B9D" : "#1A1A2E" }}>{o.label}</div>
                      <div style={{ fontSize: 10, color: "#999" }}>{meta.desc}</div>
                      {o.price > 0 && <div style={{ fontSize: 10, fontWeight: 700, color: active ? "#FF6B9D" : "#888" }}>+AED {o.price}</div>}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
          {/* Color palette */}
          <div style={{ minWidth: 110 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 8 }}>Choose your colors</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxWidth: 130 }}>
              {theme.balloonColors.map((hex) => (
                <button key={hex} type="button" onClick={() => toggleBalloon(hex)}
                  style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: hex, cursor: "pointer", transition: "all 0.12s",
                    border: d.balloonColors.includes(hex) ? "3px solid #FF6B9D" : "2px solid rgba(0,0,0,0.12)",
                    boxShadow: d.balloonColors.includes(hex) ? "0 0 0 2px white, 0 0 0 4px #FF6B9D" : "none" }}
                  title={hex} />
              ))}
              {d.balloonColors.filter(c => !theme.balloonColors.includes(c)).map((hex) => (
                <button key={hex} type="button" onClick={() => toggleBalloon(hex)}
                  style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: hex, cursor: "pointer",
                    border: "3px solid #FF6B9D", boxShadow: "0 0 0 2px white, 0 0 0 4px #FF6B9D" }} title={hex} />
              ))}
              <label style={{ width: 28, height: 28, borderRadius: "50%", border: "2px dashed rgba(0,0,0,0.20)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16, color: "#ccc" }}>
                +<input type="color" onChange={(e) => toggleBalloon(e.target.value)} style={{ opacity: 0, position: "absolute", width: 1, height: 1 }} />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Balloon colors merged into style card above */}

      {/* Global backdrop color removed — color is now set per-backdrop inside each selected card */}

      {/* BACKDROP PRINT — moved to Customize each backdrop */}
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
                  }}>✓</span>
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

      </div>{/* ── end BALLOONS section ── */}

      {/* ══ EXTRAS SECTION ════════════════════════════════════ */}
      <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 20, padding: "14px 12px", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          {numBadge(3)}
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#1A1A2E" }}>Add extra magic</div>
            <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>Enhance your setup with props and finishing touches.</div>
          </div>
        </div>

      {/* CHARACTER CUTOUTS */}
      <div style={card}>
        {secLabel("Character standees")}
        {secSub("Theme-matched character cutouts for your setup")}
        <div className="space-y-2">
          {/* No cutouts option */}
          <button
            type="button"
            onClick={() => patchDecor({ cutouts: { size: "none", position: cut.position } })}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              border: cut.size === "none" ? `2px solid ${accent}` : "1.5px solid rgba(0,0,0,0.1)",
              background: cut.size === "none" ? accent + "10" : "white",
              borderRadius: 14, padding: 12, textAlign: "left", transition: "all 0.15s",
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: cut.size === "none" ? accent : "#1A1A2E" }}>No Cutouts</div>
              <div className="text-[11px] text-black/50">Skip cutouts for this setup</div>
            </div>
            <span style={checkBadge(cut.size === "none")}>✓</span>
          </button>

          {/* Paid cutout set options */}
          {CUTOUT_SETS.map((set) => {
            const selected = cut.size === set.size;
            return (
              <div
                key={set.size}
                style={{
                  border: selected ? `2px solid ${accent}` : "1.5px solid rgba(0,0,0,0.1)",
                  background: selected ? accent + "10" : "white",
                  borderRadius: 14, transition: "all 0.15s",
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    patchDecor({ cutouts: { size: set.size, position: cut.position } })
                  }
                  className="flex w-full items-center justify-between gap-3 p-3 text-left"
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: selected ? accent : "#1A1A2E" }}>{set.label}</div>
                    <div className="text-[11px] text-black/50">{set.desc}</div>
                    <span style={{
                      marginTop: 6, fontSize: 11, fontWeight: 700, display: "inline-block",
                      color: accent, background: accent + "18", padding: "2px 8px", borderRadius: 20,
                    }}>+AED {set.price}</span>
                  </div>
                  <span style={checkBadge(selected)}>✓</span>
                </button>

                {selected && (
                  <div className="border-t border-accent/15 px-3 pb-3 pt-2">
                    <span className="mb-1.5 block text-[11px] font-medium text-black/55">Position</span>
                    <div className="flex gap-2">
                      {[
                        { v: "floor", l: "On floor beside backdrop" },
                        { v: "backdrop", l: "Mounted on backdrop" },
                      ].map((o) => (
                        <button
                          key={o.v}
                          type="button"
                          onClick={() =>
                            patchDecor({ cutouts: { size: set.size, position: o.v as CutoutPosition } })
                          }
                          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                            cut.position === o.v
                              ? "bg-accent text-white"
                              : "bg-white text-black/60 border border-black/15"
                          }`}
                        >
                          {o.l}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
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
      </div>{/* ── end EXTRAS section ── */}
    </div>
  );
}
