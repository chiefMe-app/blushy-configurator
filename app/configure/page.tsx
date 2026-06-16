"use client";

import { useMemo, useState } from "react";
import {
  EVENT_TYPES,
  THEMES,
  PACKAGES,
  BACKDROP_SHAPES,
  BALLOON_STYLES,
  PLINTH_SIZES,
  CUTOUT_SETS,
  FONT_STYLES,
  TEXT_COLORS,
  ADDONS,
  CAKE_TABLE_PRICE,
  defaultConfig,
  themeById,
  packageById,
  priceBreakdown,
  formatAED,
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
  type BalloonStyleId,
  type BackdropShapeId,
  type PlinthSize,
  type CutoutPosition,
  type FontStyle,
  type TextColor,
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
  "Package",
  "Theme",
  "Decor",
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
  /** Selecting a package re-seeds decor defaults but keeps theme colors. */
  function setPackage(id: PackageId) {
    const pkg = packageById(id);
    setConfig((c) => ({
      ...c,
      package: id,
      decor: pkg
        ? {
            ...pkg.defaultDecor,
            backdropColor: c.decor.backdropColor,
            balloonColors: c.decor.balloonColors,
          }
        : c.decor,
    }));
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
        onRegenerate={preview.regenerate}
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
              <StepShell title="Choose a package" subtitle="Sets your decor starting point.">
                <div className="grid grid-cols-1 gap-4">
                  {PACKAGES.map((p) => (
                    <PackageCard
                      key={p.id}
                      pkg={p}
                      selected={config.package === p.id}
                      onClick={() => setPackage(p.id)}
                    />
                  ))}
                </div>
              </StepShell>
            )}

            {step === 2 && (
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

            {step === 3 && (
              <StepShell
                title="Customize your decor"
                subtitle="Pre-filled from your package — adjust anything."
              >
                <DecorStep config={config} patchDecor={patchDecor} />
              </StepShell>
            )}

            {step === 4 && (
              <StepShell title="Add experiences" subtitle="Optional extras for the day.">
                <div className="space-y-6">
                  <CutoutsSection config={config} patchDecor={patchDecor} />

                  <div>
                    <h3 className="mb-3 text-sm font-semibold">Experiences & services</h3>
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
                  </div>
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

function DecorStep({
  config,
  patchDecor,
}: {
  config: BuilderConfig;
  patchDecor: (p: Partial<DecorConfig>) => void;
}) {
  const d = config.decor;
  const theme = themeById(config.theme)!;
  const t = d.backdropText;

  function setText(patch: Partial<DecorConfig["backdropText"]>) {
    patchDecor({ backdropText: { ...t, ...patch } });
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

  return (
    <div className="space-y-5">
      <ChoiceRow<string>
        label="Backdrop count"
        value={String(d.backdropCount)}
        options={[
          { id: "1", label: "1" },
          { id: "2", label: "2" },
          { id: "3", label: "3" },
        ]}
        onChange={(v) => patchDecor({ backdropCount: Number(v) })}
      />

      <ChoiceRow<BackdropShapeId>
        label="Backdrop shape"
        value={d.backdropShape}
        options={BACKDROP_SHAPES}
        onChange={(v) => patchDecor({ backdropShape: v })}
        priceOf={(id) => BACKDROP_SHAPES.find((s) => s.id === id)?.price ?? 0}
      />

      <ChoiceRow<BalloonStyleId>
        label="Balloon style"
        value={d.balloonStyle}
        options={BALLOON_STYLES}
        onChange={(v) => patchDecor({ balloonStyle: v })}
        priceOf={(id) => BALLOON_STYLES.find((b) => b.id === id)?.price ?? 0}
      />

      {/* A) Backdrop color */}
      <div>
        <span className="mb-1.5 block text-xs font-medium text-black/55">Backdrop color</span>
        <div className="flex flex-wrap items-center gap-2">
          {theme.backdropColors.map((hex) => (
            <button
              key={hex}
              type="button"
              onClick={() => patchDecor({ backdropColor: hex })}
              className={swatch(d.backdropColor.toLowerCase() === hex.toLowerCase())}
              style={{ backgroundColor: hex }}
              title={hex}
            />
          ))}
          <label className="flex h-9 cursor-pointer items-center gap-1 rounded-full border border-dashed border-black/25 px-3 text-xs text-black/55">
            Custom
            <input
              type="color"
              value={d.backdropColor}
              onChange={(e) => patchDecor({ backdropColor: e.target.value })}
              className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
            />
          </label>
        </div>
      </div>

      {/* B) Balloon colors */}
      <div>
        <span className="mb-1.5 block text-xs font-medium text-black/55">
          Balloon colors — select up to 5
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {theme.balloonColors.map((hex) => (
            <button
              key={hex}
              type="button"
              onClick={() => toggleBalloon(hex)}
              className={swatch(d.balloonColors.includes(hex))}
              style={{ backgroundColor: hex }}
              title={hex}
            />
          ))}
          {/* Any custom-added colors not in the theme palette */}
          {d.balloonColors
            .filter((c) => !theme.balloonColors.includes(c))
            .map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => toggleBalloon(hex)}
                className={swatch(true)}
                style={{ backgroundColor: hex }}
                title={hex}
              />
            ))}
          <label className="flex h-9 cursor-pointer items-center gap-1 rounded-full border border-dashed border-black/25 px-3 text-xs text-black/55">
            Custom
            <input
              type="color"
              onChange={(e) => toggleBalloon(e.target.value)}
              className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
            />
          </label>
        </div>
        <p className="mt-1.5 text-[11px] text-black/45">
          Sempertex palette — exact shades confirmed with your stylist.
        </p>
      </div>

      {/* Backdrop text */}
      <div>
        <span className="mb-1.5 block text-xs font-medium text-black/55">Text on backdrop</span>
        <div className="flex flex-wrap gap-2">
          {[
            { v: "none", l: "None" },
            { v: "birthday", l: "Happy Birthday [Name]" },
            { v: "custom", l: "Custom text" },
          ].map((o) => {
            const active =
              o.v === "none" ? !t.enabled : t.enabled && t.type === o.v;
            return (
              <button
                key={o.v}
                type="button"
                onClick={() =>
                  o.v === "none"
                    ? setText({ enabled: false })
                    : setText({ enabled: true, type: o.v as "birthday" | "custom" })
                }
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  active ? "bg-accent text-white" : "bg-white text-black/60 border border-black/15"
                }`}
              >
                {o.l}
              </button>
            );
          })}
        </div>

        {t.enabled && (
          <div className="mt-3 space-y-3 rounded-xl border border-accent/20 bg-accent-soft/30 p-3">
            {t.type === "birthday" ? (
              <input
                type="text"
                value={t.name}
                onChange={(e) => setText({ name: e.target.value })}
                placeholder="Name (e.g. Sofia)"
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
              />
            ) : (
              <input
                type="text"
                value={t.customText}
                onChange={(e) => setText({ customText: e.target.value })}
                placeholder="Your custom text"
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
              />
            )}

            <div>
              <span className="mb-1 block text-[11px] font-medium text-black/50">Font style</span>
              <div className="flex flex-wrap gap-2">
                {FONT_STYLES.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setText({ fontStyle: f.id as FontStyle })}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      t.fontStyle === f.id
                        ? "bg-accent text-white"
                        : "bg-white text-black/60 border border-black/15"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="mb-1 block text-[11px] font-medium text-black/50">Text color</span>
              <div className="flex flex-wrap gap-2">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setText({ color: c.id as TextColor })}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                      t.color === c.id ? "border-accent bg-accent-soft/60" : "border-black/15 bg-white text-black/60"
                    }`}
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-black/10"
                      style={{ backgroundColor: c.id === "accent" ? theme.accent : c.swatch }}
                    />
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Plinths + per-unit sizes */}
      <div>
        <ChoiceRow<string>
          label="Plinths"
          value={String(d.plinths)}
          options={[0, 1, 2, 3].map((n) => ({ id: String(n), label: String(n) }))}
          onChange={(v) => setPlinthCount(Number(v))}
        />
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
                      {s.label}
                      <span className={d.plinthSizes[i] === s.id ? "text-white/80" : "text-black/40"}>
                        {" "}
                        +{s.price}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ChoiceRow<string>
        label="Cake / dessert table styling"
        value={d.cakeTable ? "yes" : "no"}
        options={[
          { id: "no", label: "No" },
          { id: "yes", label: "Yes" },
        ]}
        onChange={(v) => patchDecor({ cakeTable: v === "yes" })}
        priceOf={(id) => (id === "yes" ? CAKE_TABLE_PRICE : 0)}
      />
    </div>
  );
}

/** Themed cutouts & props — lives in the Add-ons step, edits decor.cutouts. */
function CutoutsSection({
  config,
  patchDecor,
}: {
  config: BuilderConfig;
  patchDecor: (p: Partial<DecorConfig>) => void;
}) {
  const cut = config.decor.cutouts;
  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold">Themed Cutouts &amp; Props</h3>
      <p className="mb-3 text-xs text-black/50">Character cutouts to match your theme.</p>
      <div className="space-y-3">
        {CUTOUT_SETS.map((set) => {
          const selected = cut.size === set.size;
          return (
            <div
              key={set.size}
              className={`rounded-2xl border p-4 transition ${
                selected ? "border-accent bg-accent-soft/50 shadow-sm" : "border-black/10 bg-white"
              }`}
            >
              <button
                type="button"
                onClick={() =>
                  patchDecor({
                    cutouts: {
                      size: selected ? "none" : set.size,
                      position: cut.position,
                    },
                  })
                }
                className="flex w-full items-start justify-between gap-3 text-left"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">{set.label}</span>
                  <span className="mt-0.5 text-xs text-black/50">{set.desc}</span>
                  <span className="mt-1 text-xs font-medium text-accent">+AED {set.price}</span>
                </div>
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
                    selected ? "border-accent bg-accent text-white" : "border-black/20 text-transparent"
                  }`}
                >
                  ✓
                </span>
              </button>

              {selected && (
                <div className="mt-3 border-t border-accent/15 pt-3">
                  <span className="mb-1.5 block text-[11px] font-medium text-black/55">
                    Position
                  </span>
                  <div className="flex gap-2">
                    {[
                      { v: "floor", l: "Standing on floor" },
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
  );
}
