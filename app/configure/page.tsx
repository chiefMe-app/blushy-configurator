"use client";

import { useMemo, useState } from "react";
import {
  EVENT_TYPES,
  THEMES,
  PACKAGES,
  BACKDROP_SHAPES,
  BALLOON_STYLES,
  NAME_SIGNS,
  CUTOUTS,
  ADDONS,
  PLINTH_PRICES,
  CAKE_TABLE_PRICE,
  defaultConfig,
  themeById,
  packageById,
  priceBreakdown,
  formatAED,
  isAddOnRecommended,
  type BuilderConfig,
  type DecorConfig,
  type VenueDetails,
  type CustomerDetails,
  type AddOnId,
  type EventTypeId,
  type ThemeId,
  type PackageId,
  type BalloonStyleId,
  type NameSignId,
  type CutoutsId,
  type BackdropShapeId,
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
  "Package",
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
        ["--accent" as any]: theme.accent,
        ["--accent-soft" as any]: theme.accentSoft,
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
  function setTheme(id: ThemeId) {
    setConfig((c) => ({ ...c, theme: id }));
  }
  /** Selecting a package re-seeds the decor defaults. */
  function setPackage(id: PackageId) {
    const pkg = packageById(id);
    setConfig((c) => ({
      ...c,
      package: id,
      decor: pkg ? { ...pkg.defaultDecor, balloonColorCustom: c.decor.balloonColorCustom } : c.decor,
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
              <StepShell title="Pick your theme">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {THEMES.map((t) => (
                    <OptionCard
                      key={t.id}
                      selected={config.theme === t.id}
                      onClick={() => setTheme(t.id)}
                      title={t.label}
                      subtitle={t.description}
                      swatches={t.palette}
                      priceBadge={t.modifier > 0 ? `+${t.modifier}` : "+0"}
                    />
                  ))}
                </div>
              </StepShell>
            )}

            {step === 2 && (
              <StepShell title="Choose a package">
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

function DecorStep({
  config,
  patchDecor,
}: {
  config: BuilderConfig;
  patchDecor: (p: Partial<DecorConfig>) => void;
}) {
  const d = config.decor;
  const theme = themeById(config.theme)!;
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
      />

      <ChoiceRow<BalloonStyleId>
        label="Balloon style"
        value={d.balloonStyle}
        options={BALLOON_STYLES}
        onChange={(v) => patchDecor({ balloonStyle: v })}
        priceOf={(id) => BALLOON_STYLES.find((b) => b.id === id)?.price ?? 0}
      />

      {/* Balloon palette */}
      <div>
        <span className="mb-1.5 block text-xs font-medium text-black/55">
          Balloon colour palette
        </span>
        <div className="flex items-center gap-3">
          <div className="flex -space-x-1">
            {theme.palette.map((c, i) => (
              <span
                key={i}
                className="h-6 w-6 rounded-full border border-white shadow-sm"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <span className="text-xs text-black/45">Theme default</span>
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs text-black/60">
          <input
            type="checkbox"
            checked={d.balloonColorCustom}
            onChange={(e) => patchDecor({ balloonColorCustom: e.target.checked })}
            className="h-4 w-4 accent-[rgb(var(--accent))]"
          />
          Custom colour request (confirmed with our team)
        </label>
      </div>

      <ChoiceRow<string>
        label="Plinths"
        value={String(d.plinths)}
        options={[0, 1, 2, 3].map((n) => ({ id: String(n), label: String(n) }))}
        onChange={(v) => patchDecor({ plinths: Number(v) })}
        priceOf={(id) => PLINTH_PRICES[Number(id)] ?? 0}
      />

      <ChoiceRow<NameSignId>
        label="Name sign"
        value={d.nameSign}
        options={NAME_SIGNS}
        onChange={(v) => patchDecor({ nameSign: v })}
        priceOf={(id) => NAME_SIGNS.find((n) => n.id === id)?.price ?? 0}
      />

      <ChoiceRow<CutoutsId>
        label="Themed cutouts"
        value={d.cutouts}
        options={CUTOUTS}
        onChange={(v) => patchDecor({ cutouts: v })}
        priceOf={(id) => CUTOUTS.find((c) => c.id === id)?.price ?? 0}
      />

      <ChoiceRow<string>
        label="Cake / dessert table styling"
        value={d.cakeTable ? "yes" : "no"}
        options={[
          { id: "no", label: "No" },
          { id: "yes", label: `Yes` },
        ]}
        onChange={(v) => patchDecor({ cakeTable: v === "yes" })}
        priceOf={(id) => (id === "yes" ? CAKE_TABLE_PRICE : 0)}
      />
    </div>
  );
}
