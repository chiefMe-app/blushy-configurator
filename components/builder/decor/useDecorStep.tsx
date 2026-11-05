// The Decor step's state and helpers, shared by its four tabs. Moved
// unchanged from DecorStep in app/builder/page.tsx (Phase 0.1d): the hooks run
// in the same order, in the same component, as before.
import { currentName, NO_STANDEE, type DecorSample } from "@/lib/decorSamples";
import { setupPanels } from "@/lib/setupPanels";
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
import { themeBalloonSets, matchingBalloonSet, themedSetBalloons, type BalloonSetId } from "@/lib/balloonSets";
import { letteringFromLegacy, letteringPatch } from "@/lib/typography/lettering";
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
  /** An arch without its size can't be finished yet (the page's Next waits for it too). */
  continueBlocked?: boolean;
  /** 2026-11-03: the backdrop is finalized with a current render (not the Customized Themed set, its own photo). */
  needsRender?: boolean;
}

export function useDecorStep(props: DecorStepProps) {
  const { config, patchDecor, decorTab, setDecorTab, stylePieceId, setStylePieceId, onGenerate, renderReady, hasRender, generating, onContinue, continueBlocked } = props;
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

  // 2026-10-26: every board in the Builder is lettered with the Typography
  // System (a Heading over a Name, each in its own font). A board that has
  // only the old single message — a new setup, or a design from before — gets
  // the same words split into heading and name, in the preset closest to its
  // old style.
  useEffect(() => {
    if (config.decor.backdropItems.every((i: BackdropItem) => i.text.lettering)) return;
    patchDecor({
      backdropItems: config.decor.backdropItems.map((i: BackdropItem) => i.text.lettering ? i
        : { ...i, text: { ...i.text, ...letteringPatch(letteringFromLegacy(i.text)) } }),
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
  // 2026-11-02: the theme's two colour sets, Pastel tones and Bright colours ("onu seçince komple balon rengi
  // değişsin heryerde"): a set is the whole palette, for every part of the party.
  // The Customized Themed set is its photo: its balloons are the photo's, one set only.
  const themedSet = config.decor.backdropItems.some((i: BackdropItem) => i.type === "themed_set");
  const balloonSets = useMemo(() => {
    if (!themedSet) return themeBalloonSets(config.theme, getThemeDefault(config.theme));
    const ids = themedSetBalloons(config.theme, getThemeDefault(config.theme));
    return { pastel: ids, bright: ids };
  }, [config.theme, themedSet]);
  const activeBalloonSet = themedSet
    ? (sempertexIds.join() === balloonSets.pastel.join() ? "pastel" : null)
    : matchingBalloonSet(config.theme, sempertexIds, getThemeDefault(config.theme));
  useEffect(() => {
    const own = themedSetBalloons(config.theme, getThemeDefault(config.theme));
    if (themedSet && sempertexIds.join() !== own.join()) { setSempertexIds(own); setSempertexManual(true); setSempertexExceeded(false); }
    // Leaving the set: back to the theme's own colours.
    if (!themedSet && sempertexIds.join() === own.join()) { setSempertexIds(getThemeDefault(config.theme)); setSempertexManual(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themedSet, config.theme]);
  const chooseBalloonSet = (id: BalloonSetId) => {
    const ids = balloonSets[id];
    setSempertexIds(ids);
    setSempertexManual(ids.join() !== getThemeDefault(config.theme).join());
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

  // A ready-made look (lib/decorSamples.ts, 2026-11-05): the whole backdrop at once, her name kept.
  function applySample(s: DecorSample) {
    const patch = s.build(currentName(d.backdropItems));
    patchDecor({ ...patch, sampleId: s.id });
    chooseBalloonSet(s.balloonSet);
    setOpenCustomizeIds(new Set((patch.backdropItems ?? []).map((p) => p.id)));
  }

  // Apply a curated backdrop set template — replaces current backdropItems with the template's exact panels
  // (lib/setupPanels.ts).
  function applySetupTemplate(templateId: string) {
    const built = setupPanels(templateId, config.theme);
    if (!built) return;
    const { panels, patch, textOn } = built;
    // 2026-11-05 (the owner: "ready make looka basmadığında eski basic görünümü görmesi lazım"): after a ready-made
    // look, a layout card is its basic look again — no look's rainbows, standee, plinths or balloon set left behind.
    const basic: Partial<DecorConfig> = d.sampleId
      ? { sampleId: undefined, rainbowBalloons: false, garlandFlorals: false, balloonStyle: "full", cutouts: NO_STANDEE, plinths: 1, plinthSizes: ["large"], shimmerColor: undefined }
      : {};
    if (d.sampleId) resetToThemePalette();
    const ringOn: Partial<DecorConfig> = templateId === "balloon_ring" && d.balloonStyle === "none" ? { balloonStyle: "full" } : {};
    // 2026-11-01: the shimmer's own neon sign goes with it — on a board the same words are printed, and both
    // showed "Happy Birthday" twice.
    const shimmerNeon = !patch.neonSign && textOn >= 0 && d.neonSign?.enabled && (d.neonSign.text ?? "").trim() === DEFAULT_TEXT_VALUE;
    patchDecor({ ...basic, ...ringOn, backdropItems: panels, ...patch, ...(shimmerNeon ? { neonSign: { ...d.neonSign!, enabled: false } } : {}) });
    setOpenCustomizeIds(new Set(panels.map(p => p.id)));
  }

  const activeSetupTemplateId = inferSetupLayoutTemplateIdFromBackdropItems(d.backdropItems);

  // Readable type labels for summaries
  const TYPE_LABEL: Record<string, string> = { arch: "Arch Backdrop", half_arch: "Half Arch", rect: "Rectangular Backdrop", round: "Round Backdrop", banner: "Banner Backdrop", balloon_ring: "Balloon Ring", shimmer_wall: "Shimmer Wall", open_arch_frame: "Open Arch Frame", wavy: "Wavy Backdrop", fringe: "Fringe Backdrop", themed_set: "Customized Themed Set" };

  return {
    config, patchDecor, decorTab, setDecorTab, stylePieceId, setStylePieceId, onGenerate, renderReady,
    hasRender, generating, onContinue, continueBlocked, setOpenCustomizeIds, showManualPieces, setShowManualPieces,
    showAllChars, setShowAllChars, sempertexIds, sempertexManual, showSempertexBrowser, setShowSempertexBrowser,
    sempertexQuery, setSempertexQuery, sempertexFilter, setSempertexFilter, sempertexExceeded, effectiveSempertexSelection,
    toggleSempertex, resetToThemePalette, balloonSets, activeBalloonSet, chooseBalloonSet, d, boardHasLettering, neonFreeBoards, theme, t, normalizedCut,
    cutoutPresetOptions, selectedCutoutAssets, toggleCutoutAsset, clearAllStandees, print, setPlinthCount,
    patchItem, patchItemText, patchItemGraphic, accent, card, nextCue, BackdropShapePreview, chip,
    toggleArchSize, toggleRound, toggleOtherType, applySetupTemplate, applySample, activeSetupTemplateId, TYPE_LABEL,
  };
}

/** Everything a Decor tab can read: DecorStep's props, state and helpers. */
export type DecorCtx = ReturnType<typeof useDecorStep>;
