// The Decor step's state and helpers, shared by its four tabs. Moved
// unchanged from DecorStep in app/builder/page.tsx (Phase 0.1d): the hooks run
// in the same order, in the same component, as before.
import { useEffect, useMemo, useState } from "react";
import { getThemeGraphicPresets } from "@/lib/themeCatalog";
import {
  ARCH_SIZES,
  makeBackdropItem,
  emptyCutoutStandees,
  emptyCutoutQuantities,
  normalizeCutouts,
  DEFAULT_TEXT_VALUE,
  themeTextColor,
  themeById,
  type BuilderConfig,
  type DecorConfig,
  type BackdropShapeId,
  type BackdropItem,
  type BackdropItemText,
  type BackdropItemGraphic,
  type PlinthSize,
  type BackdropPrintType,
  type GraphicStyle,
} from "@/lib/config";
import { SEMPERTEX_CATALOG } from "@/lib/sempertexCatalog";
import { getThemeCatalogEntry, FALLBACK_GRAPHIC_PRESETS, getThemeCutoutPresets } from "@/lib/themeCatalog";
import { inferSetupLayoutTemplateIdFromBackdropItems } from "@/lib/setupLayoutCatalog";
import {
  MAX_BACKDROP_ITEMS,
  SERIF,
  DC,
  MAX_STANDEES,
  getThemeDefault,
} from "@/components/builder/constants";

/** Catalogue ids of the Sempertex colours a design already carries, or null if none. */
function savedSempertexIds(sel: DecorConfig["sempertexSelection"]): string[] | null {
  if (!sel?.length) return null;
  const ids = sel
    .map((s) => SEMPERTEX_CATALOG.find((c) => c.code === s.code && c.hex === s.hex)?.id)
    .filter((id): id is string => !!id);
  return ids.length ? ids : null;
}

export interface DecorStepProps {
  config: BuilderConfig;
  patchDecor: (p: Partial<DecorConfig>) => void;
  /** 2026-10-22 redesign: which of the four tabs is open. */
  decorTab: number;
  setDecorTab: (n: number) => void;
  /** Which backdrop piece the Style tab is styling (null: the default one). */
  stylePieceId: string | null;
  setStylePieceId: (id: string | null) => void;
  /** The page's existing Generate Render trigger (SetupPreview's own). */
  onGenerate: () => void;
  renderReady: boolean;
  hasRender: boolean;
  generating: boolean;
  onContinue: () => void;
}

export function useDecorStep(props: DecorStepProps) {
  const { config, patchDecor, decorTab, setDecorTab, stylePieceId, setStylePieceId, onGenerate, renderReady, hasRender, generating, onContinue } = props;
  const [printFile, setPrintFile] = useState<File | null>(null);
  const [showAdvancedPanel, setShowAdvancedPanel] = useState(false);
  const [openCustomizeIds, setOpenCustomizeIds] = useState<Set<string>>(new Set());
  // Manual shape cards are secondary — hidden behind "Change pieces manually"
  const [showManualPieces, setShowManualPieces] = useState(false);
  // 2026-10-23: the Extras tab shows three characters until "More characters".
  const [showAllChars, setShowAllChars] = useState(false);

  // Sempertex picker -UI only, does not affect pricing/render
  // 2026-10-26: starts from the colours already in the design (a return to
  // this step, or a restored design). It used to start from the theme's
  // palette every time, so leaving Decor and coming back lost a custom mix.
  const [sempertexIds, setSempertexIds] = useState<string[]>(() => savedSempertexIds(config.decor.sempertexSelection) ?? getThemeDefault(config.theme));
  const [sempertexManual, setSempertexManual] = useState(() => { // true once user manually changes
    const saved = savedSempertexIds(config.decor.sempertexSelection);
    const themed = getThemeDefault(config.theme).filter((id) => SEMPERTEX_CATALOG.some((c) => c.id === id));
    return !!saved && saved.join() !== themed.join();
  });
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

  // 2026-10-23: a board with printed lettering does not also carry the neon
  // sign (the two came out on top of each other). If lettering is added to
  // the board the sign is on, the sign moves to a free board, or is switched
  // off when there is none.
  const boardHasLettering = (it: BackdropItem | undefined) => !!(it?.text?.enabled && (it.text.value ?? "").trim());
  const neonFreeBoards = d.backdropItems
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => it.type !== "open_arch_frame" && !boardHasLettering(it));
  useEffect(() => {
    const n = d.neonSign;
    if (!n?.enabled || !boardHasLettering(d.backdropItems[n.panelIndex ?? 0])) return;
    const free = d.backdropItems.findIndex((it) => it.type !== "open_arch_frame" && !boardHasLettering(it));
    patchDecor({ neonSign: free >= 0 ? { ...n, panelIndex: free } : { ...n, enabled: false } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.backdropItems, d.neonSign]);
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
  // 2026-10-24: two standees at most, one each side of the backdrop.
  if (!exists && selectedCutoutAssets.length >= MAX_STANDEES) return;
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
  // Kept within the two-standee limit too.
  const others = selectedCutoutAssets.filter((a) => a.assetId !== assetId)
    .reduce((n, a) => n + a.quantities.large + a.quantities.medium + a.quantities.small, 0);
  const mine = selectedCutoutAssets.find((a) => a.assetId === assetId);
  const mineOther = mine ? (["large", "medium", "small"] as const).filter((k) => k !== size).reduce((n, k) => n + mine.quantities[k], 0) : 0;
  quantity = Math.min(quantity, Math.max(0, MAX_STANDEES - others - mineOther));
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
  // 2026-10-24: three plinths are an XXL between two XLs — the L is no longer offered.
  const PLINTH_LADDER: PlinthSize[] = ["large", "medium", "medium"]; // XXL, XL, XL
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
        // printed in silver.
        // 2026-10-24: and no longer with a standee — "character standeeler
        // secili default gelmesin hicbir setupta".
        const round = makeBackdropItem("round");
        panels = [{ ...round, text: { ...round.text, enabled: true, value: DEFAULT_TEXT_VALUE, color: themeTextColor(config.theme) } }];
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
        // the only one selected. Either can be changed below. (2026-10-24: no
        // setup turns a standee on any more, so there is nothing to take off.)
        const banner = makeBackdropItem("banner");
        const presets = getThemeCatalogEntry(config.theme)?.graphicPresets ?? FALLBACK_GRAPHIC_PRESETS;
        // The pattern print when the theme has one (Frozen: Snowflake Pattern),
        // the customer's chosen look — not the Elsa & Anna characters.
        const first = (presets as { label: string }[]).find((pr) => /snowflake|pattern/i.test(pr.label)) as typeof presets[number] | undefined ?? presets[0];
        panels = [first
          ? { ...banner, graphic: { ...banner.graphic, enabled: true, theme: first.id, source: "preset", assetId: first.assetId } }
          : banner];
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

  return {
    config, patchDecor, decorTab, setDecorTab, stylePieceId, setStylePieceId, onGenerate, renderReady,
    hasRender, generating, onContinue, setOpenCustomizeIds, showManualPieces, setShowManualPieces,
    showAllChars, setShowAllChars, sempertexIds, sempertexManual, showSempertexBrowser, setShowSempertexBrowser,
    sempertexQuery, setSempertexQuery, sempertexFilter, setSempertexFilter, sempertexExceeded, effectiveSempertexSelection,
    toggleSempertex, resetToThemePalette, d, boardHasLettering, neonFreeBoards, theme, t, normalizedCut,
    cutoutPresetOptions, selectedCutoutAssets, toggleCutoutAsset, clearAllStandees, print, setPlinthCount,
    patchItem, patchItemText, patchItemGraphic, accent, card, nextCue, BackdropShapePreview, chip,
    toggleArchSize, toggleRound, toggleOtherType, applySetupTemplate, activeSetupTemplateId, TYPE_LABEL,
  };
}

/** Everything a Decor tab can read: DecorStep's props, state and helpers. */
export type DecorCtx = ReturnType<typeof useDecorStep>;
