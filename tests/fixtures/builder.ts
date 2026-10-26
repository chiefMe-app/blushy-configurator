// Builds BuilderConfig values the way the builder UI does, without touching
// app code. The builder keeps these steps inside its page component, so they
// are mirrored here; tests/e2e/body-parity.spec.ts proves the mirror sends the
// same render request as the real UI.
import {
  ARCH_SIZES,
  DEFAULT_TEXT_VALUE,
  defaultConfig,
  makeBackdropItem,
  normalizeCutouts,
  themeById,
  themeTextColor,
  type BackdropItem,
  type BuilderConfig,
  type DecorConfig,
} from "@/lib/config";
import { SEMPERTEX_CATALOG } from "@/lib/sempertexCatalog";
import { getThemeCatalogEntry, getThemeCutoutPresets } from "@/lib/themeCatalog";

// components/builder/constants.ts DEFAULT_SEMPERTEX_IDS / getThemeDefault
const DEFAULT_SEMPERTEX_IDS = ["fashion-005-white", "pastel-matte-609-pink", "pastel-matte-650-lilac"];
function themeSempertexIds(themeId: string): string[] {
  const entry = getThemeCatalogEntry(themeId);
  if (entry && entry.sempertexPaletteIds.length > 0) return entry.sempertexPaletteIds;
  return DEFAULT_SEMPERTEX_IDS;
}

function patchDecor(c: BuilderConfig, patch: Partial<DecorConfig>): BuilderConfig {
  return { ...c, decor: { ...c.decor, ...patch } };
}

/** setTheme + the Sempertex sync effect that follows it. */
export function withTheme(c: BuilderConfig, id: string): BuilderConfig {
  const t = themeById(id);
  if (!t) throw new Error(`unknown theme ${id}`);
  const next: BuilderConfig = {
    ...c,
    theme: t.id,
    themeSelected: true,
    decor: {
      ...c.decor,
      balloonColors: t.balloonColors.slice(0, 5),
      backdropItems: c.decor.backdropItems.map((it) =>
        it.text?.color === themeTextColor(c.theme)
          ? { ...it, text: { ...it.text, color: themeTextColor(id) } }
          : it),
    },
  };
  const sel = themeSempertexIds(id)
    .map((sid) => SEMPERTEX_CATALOG.find((s) => s.id === sid))
    .filter((s): s is (typeof SEMPERTEX_CATALOG)[number] => !!s);
  return patchDecor(next, sel.length > 0
    ? {
        balloonColors: sel.map((s) => s.hex),
        sempertexSelection: sel.map((s) => ({ code: s.code, colorName: s.colorName, finish: s.finish, family: s.family, hex: s.hex })),
      }
    : { balloonColors: t.balloonColors.slice(0, 5), sempertexSelection: [] });
}

/** applySetupTemplate (components/builder/decor/useDecorStep.tsx) + the lone-arch-is-Large effect. */
export function withSetup(c: BuilderConfig, templateId: string): BuilderConfig {
  const archUnsized = (id: string): BackdropItem => ({ ...makeBackdropItem("arch"), sizeId: undefined, id });
  let panels: BackdropItem[];
  let decorPatch: Partial<DecorConfig> = {};
  switch (templateId) {
    case "single_arch": panels = [archUnsized("arch-1")]; break;
    case "single_round": {
      const round = makeBackdropItem("round");
      panels = [{ ...round, text: { ...round.text, enabled: true, value: DEFAULT_TEXT_VALUE, color: themeTextColor(c.theme) } }];
      break;
    }
    case "single_banner": {
      const banner = makeBackdropItem("banner");
      const presets = (getThemeCatalogEntry(c.theme)?.graphicPresets ?? []) as { id: string; label: string; assetId?: string }[];
      const first = presets.find((pr) => /snowflake|pattern/i.test(pr.label)) ?? presets[0];
      panels = [first
        ? { ...banner, graphic: { ...banner.graphic, enabled: true, theme: first.id, source: "preset", assetId: first.assetId } as BackdropItem["graphic"] }
        : banner];
      break;
    }
    case "arch_open_frame": panels = [archUnsized("arch-1"), makeBackdropItem("open_arch_frame")]; break;
    case "single_shimmer": panels = [makeBackdropItem("shimmer_wall")]; break;
    case "arch_shimmer": panels = [archUnsized("arch-1"), makeBackdropItem("shimmer_wall")]; break;
    case "balloon_ring":
      panels = [makeBackdropItem("balloon_ring")];
      if (c.decor.balloonStyle === "none") decorPatch = { balloonStyle: "full" };
      break;
    case "double_arch":
      panels = [{ ...makeBackdropItem("arch", "large"), id: "arch-1" }, { ...makeBackdropItem("arch", "medium"), id: "arch-2" }];
      break;
    case "triple_arch":
      panels = [
        { ...makeBackdropItem("half_arch"), id: "half-1" },
        { ...makeBackdropItem("arch", "medium"), id: "arch-1" },
        { ...makeBackdropItem("half_arch"), id: "half-2" },
      ];
      break;
    default: throw new Error(`unknown setup ${templateId}`);
  }
  const idx = (t: string) => panels.findIndex((p) => p.type === t);
  const textOn = (() => {
    switch (templateId) {
      case "single_arch": case "single_round": case "single_banner": case "single_shimmer": return 0;
      case "double_arch": case "triple_arch": return 1;
      case "arch_shimmer": return idx("shimmer_wall");
      case "arch_open_frame": return idx("arch");
      default: return -1;
    }
  })();
  const neonOnShimmer = textOn >= 0 && panels[textOn]?.type === "shimmer_wall";
  if (textOn >= 0 && panels[textOn] && !neonOnShimmer) {
    panels = panels.map((p, i) => i === textOn && !p.text.enabled
      ? { ...p, text: { ...p.text, enabled: true, value: p.text.value.trim() || DEFAULT_TEXT_VALUE, color: themeTextColor(c.theme) } }
      : p);
  }
  if (neonOnShimmer) {
    panels = panels.map((p) => p.type === "shimmer_wall" ? { ...p, text: { ...p.text, enabled: false } } : p);
    decorPatch = { ...decorPatch, neonSign: { enabled: true, text: DEFAULT_TEXT_VALUE, panelIndex: textOn } };
  }
  // Lone arch (not Triple Arch) is always Large.
  if (!panels.some((p) => p.type === "half_arch")) {
    const arches = panels.filter((p) => p.type === "arch");
    const large = ARCH_SIZES.find((s) => s.id === "large")!;
    if (arches.length === 1) {
      const only = arches[0];
      panels = panels.map((p) => p.id === only.id
        ? { ...p, sizeId: large.id, widthCm: large.widthCm, heightCm: large.heightCm }
        : p);
    }
  }
  return patchDecor(c, { ...decorPatch, backdropItems: panels });
}

/** Patch the lettering of one board. */
export function withText(c: BuilderConfig, panel: number, text: Partial<BackdropItem["text"]>): BuilderConfig {
  return patchDecor(c, {
    backdropItems: c.decor.backdropItems.map((p, i) => i === panel ? { ...p, text: { ...p.text, ...text } } : p),
  });
}

export function withDecor(c: BuilderConfig, patch: Partial<DecorConfig>): BuilderConfig {
  return patchDecor(c, patch);
}

/** Frozen standees: n of the theme's first character, Large. */
export function withStandees(c: BuilderConfig, assetIndexes: number[]): BuilderConfig {
  const presets = getThemeCutoutPresets(c.theme) ?? [];
  const selectedAssets = assetIndexes.map((i) => {
    const p = presets[i];
    if (!p) throw new Error(`no standee ${i} for ${c.theme}`);
    return { assetId: p.assetId, label: p.label, previewUrl: (p as { previewUrl?: string }).previewUrl, quantities: { large: 1, medium: 0, small: 0 } };
  });
  return patchDecor(c, { cutouts: normalizeCutouts({ ...c.decor.cutouts, selectedAssets } as DecorConfig["cutouts"]) });
}

/** A Frozen config on the given setup — the state after Event → Theme → Decor. */
export function frozen(setup: string): BuilderConfig {
  return withSetup(withTheme(defaultConfig(), "frozen"), setup);
}

/**
 * The builder never refreshes config.estimatedTotal after defaultConfig() set
 * it (it prices with priceBreakdown() on the fly), so the scene model's
 * totalPrice stays at the opening total. Fixtures keep that value too —
 * nothing in the render route reads it.
 */
export function finalize(c: BuilderConfig): BuilderConfig {
  return { ...c, estimatedTotal: defaultConfig().estimatedTotal };
}
