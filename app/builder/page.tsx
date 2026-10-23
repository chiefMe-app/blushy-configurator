"use client";

// Fonts (Kalam, Caveat, DM Sans) are loaded once in app/layout.tsx.

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
  DEFAULT_TEXT_VALUE,
  themeTextColor,
  resolveTextColorHex,
  isCustomTextColor,
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

// Controlled render limit: at most 2 backdrop pieces per setup.
// 2026-09-09: 2 -> 3 for the Triple Arch layout. calculateExactLayout has
// always handled three panels; only the UI capped it.
const MAX_BACKDROP_ITEMS = 3;

/**
 * 2026-09-09: a real render under every option, so the customer can see what
 * they are buying instead of reading a sentence about it. Same framed tile as
 * the setup cards. Images live in public/option-samples and are generated with
 * the live pipeline at the production seed.
 */
function OptionSample({ src, alt }: { src: string; alt: string }) {
  // 2026-10-22: example renders removed at the customer's request — "example
  // renderlari kaldir, sadece ikonlar kalsin".  Kept as a no-op so the call
  // sites stay put if they come back.
  void src; void alt;
  if (true as boolean) return null;
  return (
    <figure style={{ margin: "0 0 10px", width: "100%" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        style={{ width: "100%", maxWidth: 300, aspectRatio: "4 / 3", objectFit: "cover", display: "block",
          borderRadius: 12, border: "1px solid #F3D7E1", background: "white" }}
      />
      <figcaption style={{ fontSize: 9, color: "#BFA7B3", marginTop: 3, letterSpacing: 0.2 }}>
        Example render
      </figcaption>
    </figure>
  );
}

// Elegant serif for display headings — Cormorant Garamond per the Claude Design
// handoff, with system serif fallbacks.
// 2026-10-22 redesign: headings use the handwritten Kalam face (app/layout.tsx).
const SERIF = `var(--bz-hand), 'Kalam', 'Segoe Print', cursive`;

// ── Claude Design handoff tokens ─────────────────────────────────────────
// 2026-10-22: re-pointed at the "Sparkly party" palette (app/blushy.css),
// so every existing inline-styled control picks up the new look unchanged.
const DC = {
  pageBg:    "#FFFFFF",
  cardBd:    "#F5E4E9",
  innerBg:   "#FFFFFF",
  rose:      "#FF0D66",
  roseDeep:  "#A72F62",
  plum:      "#271617",
  muted:     "#7F717C",
  faint:     "#9C8D96",
  chipBg:    "#FFEAF3",
  dashedBd:  "#FF9BC1",
  ctaGrad:   "#FF0D66",
  ctaShadow: "0 5px 0 rgba(255,13,102,.13), 0 11px 25px rgba(255,13,102,.15)",
  cardShadow: "0 8px 25px rgba(103,44,71,.035)",
  selBorder: "2px solid #FF0D66",
  selShadow: "0 4px 0 #FFE1EC",
  amberBg:   "#FFF7DF",
  amberFg:   "#8A6A12",
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
    // 2026-09-09: this only ever handled one or two pieces — with three, the
    // second and third both landed on 84 and the Triple Arch icon showed two
    // shapes instead of three.
    const cx = n === 1 ? 60 : n === 2 ? (i === 0 ? 40 : 84) : 34 + i * 26;
    const key = `${shape}-${i}`;
    if (shape === "arch" || shape === "arch_large" || shape === "arch_small") {
      const w = shape === "arch_large" ? 38 : shape === "arch_small" ? 26 : 34;
      const top = shape === "arch_large" ? 8 : shape === "arch_small" ? 26 : 12;
      const r = w / 2;
      els.push(
        <path key={key} d={`M ${cx - r},${BASE} L ${cx - r},${top + r} A ${r},${r} 0 0 1 ${cx + r},${top + r} L ${cx + r},${BASE} Z`}
          fill={`url(#gradArch)`} />
      );
    } else if (shape === "half_arch_left" || shape === "half_arch_right") {
      // An arch sliced down the middle: one quarter-round top corner facing
      // outward, the other edge straight and full height.
      const w = 22, top = 20, r = 22;
      const left = cx - w / 2, right = cx + w / 2;
      const facingLeft = shape === "half_arch_left";
      const outer = facingLeft ? left : right;
      const inner = facingLeft ? right : left;
      const sweep = facingLeft ? 1 : 0;
      els.push(
        <path key={key} d={`M ${outer},${BASE} L ${outer},${top + r} A ${r},${r} 0 0 ${sweep} ${inner},${top} L ${inner},${BASE} Z`}
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
    } else if (shape === "ring") {
      els.push(
        <circle key={key} cx={cx} cy={34} r={22} fill="none" stroke="url(#gradRound)" strokeWidth={9} />
      );
    } else if (shape === "banner") {
      // Square 2x2m banner — a flat panel on a slim frame.
      els.push(
        <g key={key}>
          <rect x={cx - 21} y={18} width={42} height={42} rx={2} fill="url(#gradShim)" />
          <line x1={cx - 21} y1={BASE} x2={cx - 21} y2={BASE + 4} stroke="#C9A9C4" strokeWidth={2} />
          <line x1={cx + 21} y1={BASE} x2={cx + 21} y2={BASE + 4} stroke="#C9A9C4" strokeWidth={2} />
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
import Sprinkles from "@/components/design/Sprinkles";
import VenueDetailsForm from "@/components/VenueDetailsForm";
import ReviewSummary from "@/components/ReviewSummary";

const STEPS = [
  "Event",
  "Theme",
  "Decor",
  "Package",
  "Add-ons",
  "Venue",
  "Review",
];

// 2026-10-22 redesign: the heading, eyebrow and progress line of each step,
// from the design reference.
const STEP_COPY: { heading: [string, string]; description: string; eyebrow: string; progress: string }[] = [
  { heading: ["What are we", "celebrating?"], description: "Start with the occasion — then we will guide the sparkle from there.", eyebrow: "LET’S CELEBRATE", progress: "Let’s get this party started!" },
  { heading: ["Pick your party", "magic!"], description: "Tap a theme to set the mood for the whole celebration.", eyebrow: "CHOOSE YOUR VIBE", progress: "Finding your party personality" },
  { heading: ["Build your", "sparkly backdrop."], description: "Shape it, style it and add the pretty bits — no overwhelm required.", eyebrow: "LET’S DECORATE", progress: "Time for balloon magic!" },
  { heading: ["How hands-on", "shall we be?"], description: "Choose the kind of support that fits your party plans.", eyebrow: "YOUR WAY, ALWAYS", progress: "Good choices, good vibes" },
  { heading: ["Sprinkle in", "some extras!"], description: "Optional experiences to make the day even sweeter.", eyebrow: "THE LITTLE DETAILS", progress: "Just a little more sparkle" },
  { heading: ["Where’s the", "party?"], description: "A few simple details and you are almost ready.", eyebrow: "ALMOST THERE", progress: "Nearly done!" },
  { heading: ["Your party looks", "so good!"], description: "Review your picks and send your sparkly plan for a final quote.", eyebrow: "THE BIG REVEAL", progress: "Ready to celebrate!" },
];

// The Decor step's four tabs (the reference's compact decor builder).
const DECOR_TABS: { num: string; name: string; kicker: string; title: string; sub: string }[] = [
  { num: "01", name: "Backdrop", kicker: "START HERE", title: "Pick your backdrop ✦", sub: "Choose the shape. We’ll take care of the pretty bits." },
  { num: "02", name: "Style", kicker: "MAKE IT YOURS", title: "Little details, big wow!", sub: "Let’s make your backdrop feel personal in just a few taps." },
  { num: "03", name: "Balloons", kicker: "COLOUR MAGIC", title: "Let’s add balloons!", sub: "Choose the garland and its Sempertex colours." },
  { num: "04", name: "Extras", kicker: "LAST LITTLE TOUCHES", title: "Extra party magic", sub: "Characters, florals, signs and plinths — only the pieces you love." },
];

// Hand-painted theme icons from the design reference (public/design/themes).
const THEME_ICON: Partial<Record<string, string>> = {
  frozen: "/design/themes/frozen.png", unicorn: "/design/themes/unicorn.png", dinosaur: "/design/themes/dinosaur.png",
  safari: "/design/themes/safari.png", princess: "/design/themes/princess.png", superhero: "/design/themes/superhero.png",
  barbie: "/design/themes/barbie.png", bluey: "/design/themes/bluey.png", pokemon: "/design/themes/pokemon.png",
  stitch: "/design/themes/stitch.png", mermaid: "/design/themes/mermaid.png", space: "/design/themes/space.png",
  football: "/design/themes/football.png", lego: "/design/themes/lego.png", kpop: "/design/themes/k-pop.png",
  encanto: "/design/themes/encanto.png", cocomelon: "/design/themes/cocomelon.png", teddy_bear: "/design/themes/teddy-bear.png",
  pineapple_tropical: "/design/themes/tropical.png", blush_garden: "/design/themes/blush-garden.png", luxury_neutral: "/design/themes/luxury-neutral.png",
};

// Illustrated backdrop icons from the design reference (public/design/backdrops),
// by setup template id.
const SETUP_ICON: Partial<Record<string, string>> = {
  single_arch: "/design/backdrops/single-arch.png", single_round: "/design/backdrops/single-round.png",
  single_banner: "/design/backdrops/banner-backdrop.png", single_shimmer: "/design/backdrops/shimmer-wall.png",
  arch_shimmer: "/design/backdrops/arch-shimmer.png", balloon_ring: "/design/backdrops/balloon-ring.png",
  arch_open_frame: "/design/backdrops/arch-open-frame.png", double_arch: "/design/backdrops/double-arch.png",
  triple_arch: "/design/backdrops/triple-arch.png",
};

// 2026-10-23: each theme's own example photo of a setup, shown (labelled as an
// example) in the empty preview until the customer generates a real render.
// Frozen only for now — the customer's photos, one per setup. Themes without
// photos keep the plain empty state.
const THEME_SETUP_PREVIEW: Partial<Record<string, Partial<Record<string, string>>>> = {
  frozen: {
    single_arch: "/design/theme-previews/frozen/single-arch.webp",
    single_round: "/design/theme-previews/frozen/single-round.webp",
    single_banner: "/design/theme-previews/frozen/banner.webp",
    single_shimmer: "/design/theme-previews/frozen/shimmer-wall.webp",
    arch_shimmer: "/design/theme-previews/frozen/arch-shimmer.webp",
    triple_arch: "/design/theme-previews/frozen/triple-arch.webp",
    double_arch: "/design/theme-previews/frozen/double-arch.webp",
    balloon_ring: "/design/theme-previews/frozen/balloon-ring.webp",
    arch_open_frame: "/design/theme-previews/frozen/arch-open-frame.webp",
  },
};

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
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const copy = STEP_COPY[step];
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
              <img src="/design/balloon-dog-outline.webp" alt="Illustrated dalmatian holding a bunch of balloons" />
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
            <h1>{copy.heading[0]} <span>{copy.heading[1]}</span></h1>
            <p>{copy.description}</p>
            <svg className="bz-wiggle" viewBox="0 0 155 24" aria-hidden="true"><path d="M3 14Q15 3 27 14T51 14T75 14T99 14T123 14T147 14" /></svg>
          </div>
          <div className="bz-step-progress"><span>STEP {step + 1} OF {STEPS.length}</span><span>{copy.progress}</span></div>
          <div className="bz-progress"><span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>

          <div className="bz-content">
            {step === 0 && (
              <div>
                <div className="bz-tip"><span className="icon">✳</span><span>Psst... tap Birthday to start the fun!</span><span className="arrow">↙</span></div>
                <div className="bz-choice-grid">
                  {EVENT_TYPES.map((e) => {
                    const sel = config.eventType === e.id;
                    // Only Birthday is live; the others stay on the roadmap,
                    // exactly as before.
                    const available = e.id === "birthday";
                    if (available) {
                      return (
                        <button key={e.id} type="button" onClick={() => setEventType(e.id)} aria-pressed={sel}
                          className={`bz-choice bz-birthday ${sel ? "selected" : ""}`}>
                          <span className="art">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/design/confetti-cake.gif" alt="" />
                          </span>
                          <span>
                            <h3><span className="pink">Birthday,</span> <span className="lilac">please!</span></h3>
                            <p><span className="mint">Confetti</span>, <span className="blue">candles</span> &amp; all the good stuff.</p>
                          </span>
                          {sel && <span className="tick">✓</span>}
                        </button>
                      );
                    }
                    return (
                      <button key={e.id} type="button" className="bz-choice" disabled aria-disabled="true">
                        <span className="bz-coming">SOON</span>
                        <h3 style={{ fontSize: 19, marginTop: 14 }}>{e.label}</h3>
                        <p>{e.description}</p>
                      </button>
                    );
                  })}
                </div>
                <div className="bz-help">✦ <strong>Birthday parties are live!</strong> Other celebrations will join the fun later.</div>
              </div>
            )}

            {step === 1 && (
              <div>
                <div className="bz-tip"><span className="icon">✳</span><span>Pick a party world — it sets the balloons, graphics and styling.</span><span className="arrow">↙</span></div>
                <div className="bz-sectionline"><h2>Choose your party world</h2><span className="bz-pill-mini">{config.themeSelected ? "SELECTED" : "PICK ONE"}</span></div>
                <div className="bz-theme-grid">
                  {THEMES.map((t) => {
                    const sel = config.themeSelected && config.theme === t.id;
                    return (
                      <button key={t.id} type="button" onClick={() => setTheme(t.id)} aria-pressed={sel}
                        className={`bz-choice bz-theme ${sel ? "selected" : ""}`}>
                        {sel && <span className="tick">✓</span>}
                        <span className="art">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={THEME_ICON[t.id] ?? "/design/themes/blush-garden.png"} alt="" loading="lazy" />
                        </span>
                        <h3>{t.name}</h3>
                        {/* The theme's real Sempertex balloon colours — product data. */}
                        {t.balloonColors.length > 0 && (
                          <span className="palette" aria-hidden="true">
                            {t.balloonColors.slice(0, 5).map((c, i) => <i key={i} style={{ background: c }} />)}
                          </span>
                        )}
                        <small className={`cost ${t.priceModifier > 0 ? "" : "included"}`}>
                          {t.priceModifier > 0 ? `+AED ${t.priceModifier}` : "Included"}
                        </small>
                      </button>
                    );
                  })}
                </div>
                <div className="bz-help">
                  {config.themeSelected
                    ? <>✨ <strong>{theme.name} selected!</strong> Tap any icon to switch themes.</>
                    : <>✦ <strong>Choose a theme to continue.</strong> You can change it anytime.</>}
                </div>
              </div>
            )}

            {step === 2 && (
              <DecorStep config={config} patchDecor={patchDecor} decorTab={decorTab} setDecorTab={setDecorTab}
                onGenerate={triggerDecorGenerateRender} renderReady={decorRenderReady}
                hasRender={finalRenderState.hasRender} generating={finalRenderState.generating}
                onContinue={() => goToStep(3)} />
            )}

            {step === 3 && (
              <StepShell
                title="Choose your service package"
                subtitle="Your design is ready — now choose how you want to use it."
              >
                <div className="bz-tip"><span className="icon">✳</span><span>Packages don’t change your design — they define what you receive and how the setup is handled.</span><span className="arrow">↙</span></div>

                {/* Design Packages */}
                <div className="mb-6">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#7f717c" }}>
                    Design Packages
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    {SERVICE_PACKAGES.filter((p) => p.group === "design").map((p) => {
                      const selected = config.servicePackageId === p.id;
                      return (
                        <button key={p.id} type="button" onClick={() => setServicePackage(p.id)} aria-pressed={selected}
                          className={`bz-choice ${selected ? "selected" : ""}`} style={{ width: "100%" }}>
                          {selected && <span className="tick">✓</span>}
                          <div className="flex items-baseline justify-between gap-2 pr-6">
                            <h3 style={{ fontSize: 21, margin: 0 }}>{p.name}</h3>
                            <span className="bz-hand" style={{ fontSize: 20, color: "#ff0d66", whiteSpace: "nowrap" }}>AED {formatAED(p.price)}</span>
                          </div>
                          <ul className="mt-2 space-y-1.5">
                            {p.includes.map((line) => (
                              <li key={line} className="flex items-start gap-2 text-xs" style={{ color: "#4e4147" }}>
                                <span className="mt-[3px]" style={{ color: "#ff0d66" }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
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
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#7f717c" }}>
                    Execution Packages
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    {SERVICE_PACKAGES.filter((p) => p.group === "execution").map((p) => {
                      const selected = config.servicePackageId === p.id;
                      return (
                        <button key={p.id} type="button" onClick={() => setServicePackage(p.id)} aria-pressed={selected}
                          className={`bz-choice ${selected ? "selected" : ""}`} style={{ width: "100%" }}>
                          {selected && <span className="tick">✓</span>}
                          <div className="flex items-baseline justify-between gap-2 pr-6">
                            <h3 style={{ fontSize: 21, margin: 0 }}>{p.name}</h3>
                            <span className="bz-hand" style={{ fontSize: 20, color: "#ff0d66", whiteSpace: "nowrap" }}>AED {formatAED(p.price)}</span>
                          </div>
                          <ul className="mt-2 space-y-1.5">
                            {p.includes.map((line) => (
                              <li key={line} className="flex items-start gap-2 text-xs" style={{ color: "#4e4147" }}>
                                <span className="mt-[3px]" style={{ color: "#ff0d66" }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
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
                <div className="bz-tip"><span className="icon">✳</span><span>A little extra sparkle? Totally optional!</span><span className="arrow">↙</span></div>
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
                <div className="bz-tip"><span className="icon">✳</span><span>Almost ready! Tell us where the celebration happens.</span><span className="arrow">↙</span></div>
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
                <div className="bz-tip"><span className="icon">✳</span><span>Ta-da! Here’s what you’ve created 🎉</span><span className="arrow">↙</span></div>
                <div className="space-y-4">
                  {/* Includes the detailed price breakdown (PriceSummary, the existing pricing engine). */}
                  <ReviewSummary config={config} />

                  {!canSubmit && (
                    <p className="text-center text-xs" style={{ color: "#7f717c" }}>
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
      <h2 className="bz-step-title" style={{ font: "400 25px/1.25 var(--bz-hand)", color: "#271617", margin: "0 0 6px" }}>{title}</h2>
      {subtitle && <p className="bz-step-sub" style={{ color: "#7f717c", fontSize: 13, margin: "0 0 14px" }}>{subtitle}</p>}
      <div className={subtitle ? "" : "mt-3"}>{children}</div>
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
// Real product names (2026-09-03) — the three cylinders sold are L/XL/XXL.
// Keys are the stored size ids, which stay small/medium/large.
const PLINTH_SHORT: Record<string, string> = {
  small: "L",
  medium: "XL",
  large: "XXL",
  xl: "XXL",
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
  decorTab,
  setDecorTab,
  onGenerate,
  renderReady,
  hasRender,
  generating,
  onContinue,
}: {
  config: BuilderConfig;
  patchDecor: (p: Partial<DecorConfig>) => void;
  /** 2026-10-22 redesign: which of the four tabs is open. */
  decorTab: number;
  setDecorTab: (n: number) => void;
  /** The page's existing Generate Render trigger (SetupPreview's own). */
  onGenerate: () => void;
  renderReady: boolean;
  hasRender: boolean;
  generating: boolean;
  onContinue: () => void;
}) {
  const [printFile, setPrintFile] = useState<File | null>(null);
  const [showAdvancedPanel, setShowAdvancedPanel] = useState(false);
  const [openCustomizeIds, setOpenCustomizeIds] = useState<Set<string>>(new Set());
  // Manual shape cards are secondary — hidden behind "Change pieces manually"
  const [showManualPieces, setShowManualPieces] = useState(false);
  // 2026-10-23 Style redesign: which backdrop piece the Style tab is styling.
  const [stylePieceId, setStylePieceId] = useState<string | null>(null);
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

  // A lone arch is only sold Large (see the size chips further down). If a
  // scene arrives on Medium or Small — a saved draft, or a second arch that was
  // just removed — bring it up to Large so the state matches what is offered.
  useEffect(() => {
    // 2026-09-09: not on a Triple Arch. It has exactly one `arch` item — the
    // centre board — and the customer set that one to 200cm, but this effect
    // saw a lone arch and kept forcing it back to the 220cm Large.
    if (config.decor.backdropItems.some((i: BackdropItem) => i.type === "half_arch")) return;
    const arches = config.decor.backdropItems.filter((i: BackdropItem) => i.type === "arch");
    if (arches.length !== 1) return;
    const only = arches[0];
    const large = ARCH_SIZES.find((s) => s.id === "large");
    if (!large) return;
    // 2026-09-10: also refresh a board that is already Large but carries stale
    // dimensions — the Large board changed from 120x220 to 100x220 and a saved
    // draft would otherwise keep rendering at the old width forever.
    if (only.sizeId === "large" && only.widthCm === large.widthCm && only.heightCm === large.heightCm) return;
    patchDecor({
      backdropItems: config.decor.backdropItems.map((i: BackdropItem) =>
        i.id === only.id
          ? { ...i, sizeId: large.id, widthCm: large.widthCm, heightCm: large.heightCm }
          : i),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.decor.backdropItems]);

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
  // 2026-09-09: the customer set the ladder — one plinth is the XXL, two are
  // XXL + XL, three are XXL + XL + L. Picking a count now fills in that set
  // rather than defaulting everything to XL. The per-plinth buttons are still
  // there, so any of the three sizes can still be chosen afterwards.
  const PLINTH_LADDER: PlinthSize[] = ["large", "medium", "small"]; // XXL, XL, L
  function setPlinthCount(n: number) {
    const sizes: PlinthSize[] = PLINTH_LADDER.slice(0, n);
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

  // UI chrome is Blushy pink whatever the theme (the theme accent is product data).
  const accent = "#FF0D66";
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
      case "single_round": {
        // 2026-10-20, customer request: Single Round comes with "Happy Birthday"
        // printed in silver and the Elsa Solo standee already on — the
        // customer removes either below if they do not want it.
        const round = makeBackdropItem("round");
        panels = [{ ...round, text: { ...round.text, enabled: true, value: DEFAULT_TEXT_VALUE, color: themeTextColor(config.theme) } }];
        const elsa = (themeCutoutPresets ?? []).find((pr) => /elsa solo/i.test(pr.label));
        if (elsa && selectedCutoutAssets.length === 0) {
          patchDecor({
            cutouts: {
              ...normalizedCut,
              size: "none",
              position: "floor",
              source: "preset",
              presetAssetId: undefined,
              mode: "standees",
              selectedAssets: [{
                assetId: elsa.assetId,
                label: elsa.label,
                previewUrl: elsa.previewUrl,
                quantities: { ...emptyCutoutQuantities(), large: 1 },
              }],
            },
          });
        }
        break;
      }
      // 2026-09-05: the Banner card was in the setup list but clicking it did
      // nothing — this switch had no case for it, so it fell to `default:
      // return`. A banner has one fixed size (2x2m), so unlike an arch it needs
      // no size step and is created ready to use.
      case "single_banner": {
        // 2026-10-21, customer request: the banner comes already printed with
        // the theme (its first theme graphic), and with NO standee — the
        // Elsa that Single Round turns on is taken back off here if it is
        // the only one selected. Either can be changed below.
        const banner = makeBackdropItem("banner");
        const presets = getThemeCatalogEntry(config.theme)?.graphicPresets ?? FALLBACK_GRAPHIC_PRESETS;
        // The pattern print when the theme has one (Frozen: Snowflake Pattern),
        // the customer's chosen look — not the Elsa & Anna characters.
        const first = (presets as { label: string }[]).find((pr) => /snowflake|pattern/i.test(pr.label)) as typeof presets[number] | undefined ?? presets[0];
        panels = [first
          ? { ...banner, graphic: { ...banner.graphic, enabled: true, theme: first.id, source: "preset", assetId: first.assetId } }
          : banner];
        if (selectedCutoutAssets.length === 1 && /elsa solo/i.test(selectedCutoutAssets[0].label ?? "")) {
          clearAllStandees();
        }
        break;
      }
      case "arch_open_frame":    panels = [makeArchUnsized("arch-1"), makeBackdropItem("open_arch_frame")]; break;
      case "single_shimmer":     panels = [makeBackdropItem("shimmer_wall")]; break;
      case "arch_shimmer":       panels = [makeArchUnsized("arch-1"), makeBackdropItem("shimmer_wall")]; break;
      case "balloon_ring":
        panels = [makeBackdropItem("balloon_ring")];
        // The ring is made of balloons, so a "none" tier carried over from a
        // previous setup would leave the scene empty.
        if (d.balloonStyle === "none") patchDecor({ balloonStyle: "full" });
        break;
      // 2026-10-22: created sized, Large then Medium — "large ve medium
      // backdroplar default gelsin, user secmesin". It used to stall on "pick
      // a size" for both boards.
      case "double_arch":
        panels = [{ ...makeBackdropItem("arch", "large"), id: "arch-1" }, { ...makeBackdropItem("arch", "medium"), id: "arch-2" }];
        break;
      // 2026-09-09: the first three-piece layout. Selection order is
      // left-to-right, so the two half arches bracket the centre board.
      case "triple_arch":
        // 2026-09-09: the centre board is the 200cm Medium, not the 220cm
        // Large, and it is created already sized — the side half arches have no
        // size step, so leaving the centre unsized stalled the whole setup on
        // "pick a size".
        panels = [
          { ...makeBackdropItem("half_arch"), id: "half-1" },
          { ...makeBackdropItem("arch", "medium"), id: "arch-1" },
          { ...makeBackdropItem("half_arch"), id: "half-2" },
        ];
        break;
      // arch_open_frame / shimmer_open_frame / single_shimmer / arch_shimmer
      // removed from product — no longer selectable, so no case needed;
      // legacy ids resolve via getSetupLayoutTemplate()'s
      // LEGACY_TEMPLATE_ID_REMAP if ever passed in.
      default: return;
    }
    // 2026-10-22: every setup with a board comes with "Happy Birthday" on it,
    // on the board its reference puts it on, in the theme's lettering colour
    // ("default olarak gelsin backdrop olan setuplarda ... yazinin rengi theme
    // e gore degismeli"). The customer can switch it off below. The ring has
    // no board, so no lettering.
    const textOn = (() => {
      const idx = (t: string) => panels.findIndex((p) => p.type === t);
      switch (templateId) {
        case "single_arch": case "single_round": case "single_banner": case "single_shimmer": return 0;
        case "double_arch": return 1;
        case "triple_arch": return 1;
        case "arch_shimmer": return idx("shimmer_wall");
        case "arch_open_frame": return idx("arch");
        default: return -1;
      }
    })();
    // 2026-10-22: on a shimmer wall the words are a lit LED neon sign, as in
    // the customer's shimmer references ("shimmer wall oldugu zaman hep led
    // yazsin happy birthday"): the Neon LED option is ticked, on the shimmer
    // wall, and the wall carries no printed lettering. Unticking the option
    // removes it.
    const neonOnShimmer = textOn >= 0 && panels[textOn]?.type === "shimmer_wall";
    if (textOn >= 0 && panels[textOn] && !neonOnShimmer) {
      panels = panels.map((p, i) => i === textOn && !p.text.enabled
        ? { ...p, text: { ...p.text, enabled: true, value: p.text.value.trim() || DEFAULT_TEXT_VALUE, color: themeTextColor(config.theme) } }
        : p);
    }
    if (neonOnShimmer) {
      panels = panels.map((p) => p.type === "shimmer_wall" ? { ...p, text: { ...p.text, enabled: false } } : p);
      patchDecor({ backdropItems: panels, neonSign: { enabled: true, text: DEFAULT_TEXT_VALUE, panelIndex: textOn } });
    } else {
      patchDecor({ backdropItems: panels });
    }
    setOpenCustomizeIds(new Set(panels.map(p => p.id)));
  }

  const activeSetupTemplateId = inferSetupLayoutTemplateIdFromBackdropItems(d.backdropItems);

  // Readable type labels for summaries
  const TYPE_LABEL: Record<string, string> = { arch: "Arch Backdrop", half_arch: "Half Arch", rect: "Rectangular Backdrop", round: "Round Backdrop", banner: "Banner Backdrop", balloon_ring: "Balloon Ring", shimmer_wall: "Shimmer Wall", open_arch_frame: "Open Arch Frame" };

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
        {/* 2026-09-05: a shimmer wall has no painted backdrop colour — its
            colour IS the sequin finish, so that picker takes this slot instead
            of the backdrop swatches. */}
        {item.type === "shimmer_wall" ? (
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#12162F", display: "block", marginBottom: 6 }}>Shimmer wall color</span>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
              {SHIMMER_COLORS.map((sc) => {
                const active = (d.shimmerColor ?? "silver") === sc.id;
                return (
                  <button key={sc.id} type="button" onClick={() => patchDecor({ shimmerColor: sc.id })}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20,
                      fontSize: 11, fontWeight: 600, cursor: "pointer",
                      border: active ? `1.5px solid ${accent}` : "1.5px solid rgba(0,0,0,0.12)",
                      background: active ? accent + "12" : "white", color: active ? accent : "#555" }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, flexShrink: 0,
                      background: SHIMMER_COLOR_HEX[sc.id], border: "1px solid rgba(0,0,0,0.15)" }} />
                    {sc.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : item.type === "balloon_ring" ? (
          /* 2026-09-09: a ring has no board colour, but it does have two
             dressings — fully wrapped, or a bare gold hoop with the garland on
             one side (the style in Blushy's own Instagram post). */
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#12162F", display: "block", marginBottom: 6 }}>Ring style</span>
            {/* 2026-09-09: each dressing shows a render of itself, so the
                difference between a wrapped hoop and a bare gold one is
                visible rather than described. */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
              {BALLOON_RING_STYLES.map((rs) => {
                const active = (d.balloonRingStyle ?? "full") === rs.id;
                return (
                  <button key={rs.id} type="button"
                    // Choosing the bare hoop also drops the balloon tier to "No
                    // balloons", and choosing a wrapped hoop puts a garland back —
                    // otherwise the quote and the render disagree.
                    onClick={() => patchDecor(rs.id === "none"
                      ? { balloonRingStyle: rs.id, balloonStyle: "none" }
                      : { balloonRingStyle: rs.id, balloonStyle: d.balloonStyle === "none" ? "full" : d.balloonStyle })}
                    style={{ textAlign: "left", padding: 8, borderRadius: 14, cursor: "pointer",
                      border: active ? `1.5px solid ${accent}` : "1.5px solid rgba(0,0,0,0.12)",
                      background: active ? accent + "12" : "white" }}>
                    {/* 2026-10-22: example render removed. */}
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: active ? accent : "#1A1A2E" }}>{rs.label}</div>
                    <div style={{ fontSize: 10, color: "#9A8E96" }}>{rs.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#12162F", display: "block", marginBottom: 6 }}>Backdrop color</span>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              {backdropSwatchesForTheme(theme).map((hex) => (
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
        )}
        {/* Add-ons */}
        <span style={{ fontSize: 11, fontWeight: 600, color: "#555", display: "block", marginBottom: 6 }}>Add-ons for this backdrop</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {/* 2026-09-05: a shimmer wall is a sequin surface — nothing is printed
              on it, so it offers neither customized text nor a theme graphic. */}
          {/* 2026-09-05: a Balloon Ring has no board at all, so like the shimmer
              wall it offers neither customized text nor a theme graphic. */}
          {/* 2026-09-08: an open arch frame is a plain painted band with a
              balloon-filled opening — nothing is printed on it either, so it
              offers only the colour picker above. */}
          {item.type !== "shimmer_wall" && item.type !== "balloon_ring" && item.type !== "open_arch_frame" && (<>
          {/* Customized text */}
          <div onClick={() => patchItemText(itemIdx, { enabled: !item.text.enabled, ...(!item.text.enabled && !item.text.value.trim() ? { value: DEFAULT_TEXT_VALUE, color: themeTextColor(config.theme) } : {}) })}
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
            <div style={{ padding: "10px 12px", background: "#FAFAFA", borderRadius: 10, border: "1px solid rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: 10 }}>
              <textarea rows={2} value={item.text.value}
                onChange={(e) => patchItemText(itemIdx, { value: e.target.value })}
                placeholder="Type the name or message..."
                style={{ width: "100%", resize: "none", borderRadius: 8, border: "1px solid rgba(0,0,0,0.10)", padding: "8px 10px", fontSize: 13, outline: "none" }} />
              <div>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: "#888", display: "block", marginBottom: 5 }}>Font</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {FONT_STYLES.map((f) => {
                    const sel = item.text.fontStyle === f.id;
                    return (
                      <button key={f.id} type="button"
                        onClick={(e) => { e.stopPropagation(); patchItemText(itemIdx, { fontStyle: f.id as FontStyle }); }}
                        style={{ padding: "4px 11px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                          border: sel ? `1.5px solid ${accent}` : "1.5px solid rgba(0,0,0,0.12)",
                          background: sel ? accent + "12" : "white", color: sel ? accent : "#555",
                          fontFamily: f.id === "script" ? "'Segoe Script','Brush Script MT',cursive"
                            : f.id === "elegant" ? "Georgia,'Times New Roman',serif" : "inherit",
                          fontStyle: f.id === "script" ? "italic" : "normal" }}>
                        {f.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: "#888", display: "block", marginBottom: 5 }}>Text color</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {TEXT_COLORS.map((c) => {
                    const sel = item.text.color === c.id;
                    return (
                      <button key={c.id} type="button"
                        onClick={(e) => { e.stopPropagation(); patchItemText(itemIdx, { color: c.id as TextColor }); }}
                        style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                          border: sel ? `1.5px solid ${accent}` : "1.5px solid rgba(0,0,0,0.12)",
                          background: sel ? accent + "12" : "white", color: sel ? accent : "#555" }}>
                        <span style={{ width: 12, height: 12, borderRadius: "50%", border: "1px solid rgba(0,0,0,0.15)",
                          background: c.id === "accent" ? accent : c.swatch }} />
                        {c.label}
                      </button>
                    );
                  })}
                  {/* Anything outside the four presets. Customer request
                      2026-09-03: "the colour options for text are very limited,
                      let us make it so any colour can be chosen." The swatch
                      shows the picked colour and stays highlighted while a
                      custom hex is active. */}
                  <label
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                      border: isCustomTextColor(item.text.color) ? `1.5px solid ${accent}` : "1.5px solid rgba(0,0,0,0.12)",
                      background: isCustomTextColor(item.text.color) ? accent + "12" : "white",
                      color: isCustomTextColor(item.text.color) ? accent : "#555" }}
                    onClick={(e) => e.stopPropagation()}>
                    <span style={{ width: 12, height: 12, borderRadius: "50%", border: "1px solid rgba(0,0,0,0.15)",
                      background: resolveTextColorHex(item.text.color, accent) }} />
                    Custom
                    <input type="color"
                      value={resolveTextColorHex(item.text.color, accent)}
                      onChange={(e) => patchItemText(itemIdx, { color: e.target.value.toUpperCase() })}
                      style={{ width: 0, height: 0, padding: 0, border: 0, opacity: 0, position: "absolute" }} />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Theme Graphic — a Banner is designed by the customer instead */}
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
          </>)}

        </div>
        </div>
      </div>
    );
  }

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
      <div className="bz-decor-panel-head">
        <div>
          <span className="bz-decor-kicker">{DECOR_TABS[decorTab].kicker}</span>
          <h2>{DECOR_TABS[decorTab].title}</h2>
          <p>{DECOR_TABS[decorTab].sub}</p>
        </div>
        <span className="bz-decor-count">{DECOR_TABS[decorTab].num} / 04</span>
      </div>

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
                <button key={tpl.id} type="button" onClick={() => applySetupTemplate(tpl.id)} aria-pressed={active}
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
          script:  { family: "var(--bz-logo), 'Segoe Script', cursive", weight: 600, size: 27, short: "Script" },
          block:   { family: "var(--bz-sans), 'Arial Black', sans-serif", weight: 800, size: 20, short: "Bold" },
          elegant: { family: "Georgia, 'Times New Roman', serif", weight: 400, size: 21, short: "Serif" },
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
              <div className="bz-st-pieces" role="group" aria-label="Which piece are you styling?">
                <span className="lbl">Styling</span>
                {items.map((it, i) => (
                  <button key={it.id} type="button" aria-pressed={i === itemIdx}
                    className={`bz-st-piece ${i === itemIdx ? "on" : ""}`} onClick={() => setStylePieceId(it.id)}>
                    {pieceName(it, i)}
                    {isPrintable(it) && it.text.enabled && <span className="dot" title="Has lettering">Aa</span>}
                  </button>
                ))}
              </div>
            )}

            {/* 1 — Size */}
            <section className={`bz-st-sec ${needsSize ? "attn" : ""}`}>
              <Head n={1} title="Pick your size"
                sub={sizeOpts.length === 1 ? "This piece comes in one size — nothing to choose here." : "Choose the size that fits your space."} />
              <div className="bz-st-opts sizes">
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
              <section className="bz-st-sec">
                <Head n={nMsg} title="Add your message" sub="Make it yours with a name or sweet message." />
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
                      <textarea rows={2} value={item.text.value} aria-label="Your message"
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
              <section className="bz-st-sec">
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
                        <span className="sample" style={{ background: boardHex, color: textHex, fontFamily: face.family, fontWeight: face.weight, fontSize: face.size }}>
                          {sampleText}
                        </span>
                        <strong>{face.short}</strong>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 4 — Colours */}
            {showColors && (
              <section className="bz-st-sec">
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
              <section className="bz-st-sec">
                <Head n={nGraphic} title="Add a theme graphic" optional sub="Include a printed illustration to make it extra special." />
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
                              if (firstRectItem?.id) {
                                setOpenCustomizeIds(prev => { const n = new Set(prev); n.add(firstRectItem.id); return n; });
                              }
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
                    {backdropSwatchesForTheme(theme).map((hex) => (
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
                    {/* A shimmer wall is a sequin surface — nothing is printed on
                        it, so neither card is offered for one. */}
                    {item.type !== "shimmer_wall" && (<>

                    {/* Name Text card */}
                    <div
                      onClick={() => patchItemText(idx, { enabled: !item.text.enabled, ...(!item.text.enabled && !item.text.value.trim() ? { value: DEFAULT_TEXT_VALUE, color: themeTextColor(config.theme) } : {}) })}
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
                    </>)}

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

      {/* == 3 · BALLOONS (tab 03) ============================= */}
      {decorTab === 2 && (
      <div>
        {d.backdropItems.length > 0 && d.balloonStyle === "none" && <div style={{ marginBottom: 10 }}>{nextCue("Optional — add a garland")}</div>}

      {/* Garland choice — balloons are opt-in (2026-07-20). They used to be
          pre-added by the package's defaultDecor with no way to decline. */}
      <div style={{ ...card, marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: DC.faint, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 9 }}>
          Balloon garland
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                style={{
                  textAlign: "left", cursor: "pointer", borderRadius: 12, padding: "9px 11px",
                  border: active ? "1.5px solid #D8548A" : "1px solid #ECE7E4",
                  background: "white",
                  boxShadow: active ? "0 0 0 3px #FBE9EF" : "none",
                }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: active ? DC.roseDeep : DC.plum, lineHeight: 1.2 }}>
                  {b.id === "none" ? "No balloons" : "Organic Garland"}
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

      </div>
      )}{/* -"--"- end Balloons tab -"--"- */}

      {/* == 4 · EXTRAS (tab 04) =============================== */}
      {decorTab === 3 && (
      <div>

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

      {/* FLORALS — 2026-09-05. Applies to every setup; only does anything when
          a garland is selected, so it says so rather than hiding itself. */}
      <div style={card}>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, color: DC.plum }}>Florals in the garland</div>
          <div style={{ fontSize: 11.5, color: DC.muted }}>
            Eucalyptus, dried grasses and soft blooms tucked between the balloons.
          </div>
        </div>
        <OptionSample src="/option-samples/florals.jpg" alt="Balloon garland with florals" />
        <button
          type="button"
          onClick={() => patchDecor({ garlandFlorals: !d.garlandFlorals })}
          disabled={d.balloonStyle === "none"}
          style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%",
            padding: "11px 13px", borderRadius: 12, cursor: d.balloonStyle === "none" ? "not-allowed" : "pointer",
            opacity: d.balloonStyle === "none" ? 0.5 : 1,
            border: `1.5px solid ${d.garlandFlorals ? DC.rose : DC.cardBd}`,
            background: d.garlandFlorals ? DC.rose + "12" : "white", transition: "all 0.15s",
          }}
        >
          <span style={{
            width: 20, height: 20, borderRadius: 6, flexShrink: 0,
            border: `1.5px solid ${d.garlandFlorals ? DC.rose : DC.cardBd}`,
            background: d.garlandFlorals ? DC.rose : "white",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {d.garlandFlorals && (
              <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </span>
          <span style={{ flex: 1, textAlign: "left", fontSize: 12.5, fontWeight: 600, color: DC.plum }}>
            Add florals &amp; greenery
          </span>
        </button>
        {d.balloonStyle === "none" && (
          <div style={{ fontSize: 10.5, color: DC.faint, marginTop: 6 }}>Pick a balloon garland first.</div>
        )}
      </div>

      {/* NEON SIGN — 2026-09-05. Goes in the open centre of a balloon ring, or
          on the backdrop face for every other setup. */}
      <div style={card}>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, color: DC.plum }}>Neon LED sign</div>
          <div style={{ fontSize: 11.5, color: DC.muted }}>
            {d.backdropItems.some((i) => i.type === "balloon_ring")
              ? "Glowing script hung in the middle of the balloon ring."
              : "Glowing script mounted on the backdrop."}
          </div>
        </div>
        <OptionSample src="/option-samples/neon.jpg" alt="Backdrop with a neon LED sign" />
        <button
          type="button"
          onClick={() => patchDecor({ neonSign: { text: d.neonSign?.text ?? "Happy Birthday", panelIndex: d.neonSign?.panelIndex ?? 0, enabled: !(d.neonSign?.enabled) } })}
          style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%",
            padding: "11px 13px", borderRadius: 12, cursor: "pointer",
            border: `1.5px solid ${d.neonSign?.enabled ? DC.rose : DC.cardBd}`,
            background: d.neonSign?.enabled ? DC.rose + "12" : "white", transition: "all 0.15s",
          }}
        >
          <span style={{
            width: 20, height: 20, borderRadius: 6, flexShrink: 0,
            border: `1.5px solid ${d.neonSign?.enabled ? DC.rose : DC.cardBd}`,
            background: d.neonSign?.enabled ? DC.rose : "white",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {d.neonSign?.enabled && (
              <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </span>
          <span style={{ flex: 1, textAlign: "left", fontSize: 12.5, fontWeight: 600, color: DC.plum }}>
            Add a neon sign
          </span>
        </button>
        {d.neonSign?.enabled && (
          <div style={{ marginTop: 10 }}>
            <div className="flex flex-wrap gap-1.5" style={{ marginBottom: 8 }}>
              {NEON_SIGN_PRESETS.map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  onClick={() => patchDecor({ neonSign: { enabled: true, text: phrase, panelIndex: d.neonSign?.panelIndex ?? 0 } })}
                  style={{
                    padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                    border: `1.5px solid ${d.neonSign?.text === phrase ? DC.rose : "rgba(0,0,0,0.12)"}`,
                    background: d.neonSign?.text === phrase ? DC.rose + "12" : "white",
                    color: d.neonSign?.text === phrase ? DC.rose : "#555",
                  }}
                >
                  {phrase}
                </button>
              ))}
            </div>
            {/* 2026-09-05: on a two-piece setup the customer picks which board
                carries the sign.
                2026-09-08: an open arch frame is not offered — it is a narrow
                band around a balloon-filled hole, with no board face for a sign
                to hang on. If it is the only other piece, the chooser is hidden
                and the sign stays on the solid board. */}
            {(() => {
              const neonEligible = d.backdropItems
                .map((it, i) => ({ it, i }))
                .filter(({ it }) => it.type !== "open_arch_frame");
              if (neonEligible.length < 2) return null;
              return (
                <div style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: "#666", display: "block", marginBottom: 5 }}>
                    Which backdrop?
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {neonEligible.map(({ it, i }) => {
                      const active = (d.neonSign?.panelIndex ?? 0) === i;
                      const label = `${i === 0 ? "Left" : "Right"} · ${TYPE_LABEL[it.type] ?? it.type}`;
                      return (
                        <button key={it.id} type="button"
                          onClick={() => patchDecor({ neonSign: { enabled: true, text: d.neonSign?.text ?? "Happy Birthday", panelIndex: i } })}
                          style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                            border: `1.5px solid ${active ? DC.rose : "rgba(0,0,0,0.12)"}`,
                            background: active ? DC.rose + "12" : "white", color: active ? DC.rose : "#555" }}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
            <input
              type="text"
              value={d.neonSign?.text ?? ""}
              maxLength={40}
              onChange={(e) => patchDecor({ neonSign: { enabled: true, text: e.target.value.slice(0, 40), panelIndex: d.neonSign?.panelIndex ?? 0 } })}
              placeholder="Or type your own"
              style={{
                width: "100%", fontSize: 12.5, color: DC.plum, padding: "9px 11px",
                borderRadius: 12, border: `1.5px solid ${DC.cardBd}`, outline: "none",
              }}
            />
          </div>
        )}
      </div>

      {/* NUMBER LIGHT — 2026-09-05 */}
      <div style={card}>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, color: DC.plum }}>Light-up number</div>
          <div style={{ fontSize: 11.5, color: DC.muted }}>
            A 90 cm illuminated marquee number standing beside the backdrop.
          </div>
        </div>
        <OptionSample src="/option-samples/number_light.jpg" alt="Backdrop with a light-up marquee number" />
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => patchDecor({ numberLight: { value: d.numberLight?.value ?? "1", enabled: !(d.numberLight?.enabled) } })}
            style={{
              display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 200,
              padding: "11px 13px", borderRadius: 12, cursor: "pointer",
              border: `1.5px solid ${d.numberLight?.enabled ? DC.rose : DC.cardBd}`,
              background: d.numberLight?.enabled ? DC.rose + "12" : "white", transition: "all 0.15s",
            }}
          >
            <span style={{
              width: 20, height: 20, borderRadius: 6, flexShrink: 0,
              border: `1.5px solid ${d.numberLight?.enabled ? DC.rose : DC.cardBd}`,
              background: d.numberLight?.enabled ? DC.rose : "white",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {d.numberLight?.enabled && (
                <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </span>
            <span style={{ flex: 1, textAlign: "left", fontSize: 12.5, fontWeight: 600, color: DC.plum }}>
              Add a light-up number
            </span>
          </button>
          {d.numberLight?.enabled && (
            <input
              type="text"
              inputMode="numeric"
              value={d.numberLight?.value ?? ""}
              onChange={(e) => patchDecor({
                numberLight: { enabled: true, value: e.target.value.replace(/[^0-9]/g, "").slice(0, 2) },
              })}
              placeholder="1"
              style={{
                width: 68, textAlign: "center", fontSize: 16, fontWeight: 700, color: DC.plum,
                padding: "10px 8px", borderRadius: 12, border: `1.5px solid ${DC.cardBd}`, outline: "none",
              }}
            />
          )}
        </div>
      </div>

      {/* PLINTHS */}
      <div style={card}>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, color: DC.plum }}>Cake plinths</div>
          <div style={{ fontSize: 11.5, color: DC.muted }}>Elegant columns that put your cake center-stage beside the backdrop.</div>
        </div>
        <OptionSample
          src={`/option-samples/plinth_${Math.min(3, Math.max(1, d.plinths || 1))}.jpg`}
          alt={`${Math.min(3, Math.max(1, d.plinths || 1))} cake plinth example`}
        />
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
                  {/* 2026-09-09: one size per row, not three. The ladder decides
                      which — plinth 1 is the XXL, 2 the XL, 3 the L — so the
                      other two chips were dead choices that only made the set
                      look changeable when it is not. */}
                  {PLINTH_SIZES.filter((s) => s.id === (d.plinthSizes[i] ?? PLINTH_LADDER[i])).map((s) => {
                    const sel = true;
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

      </div>
      )}{/* -"--"- end Extras tab -"--"- */}

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









