// A layout's basic boards (moved out of useDecorStep's applySetupTemplate, 2026-11-05, so the ready-made looks of a
// layout start from the very same boards — lib/decorSamples.ts). Pure: no state.
import {
  DEFAULT_TEXT_VALUE, makeBackdropItem, themeTextColor,
  type BackdropItem, type DecorConfig,
} from "@/lib/config";
import { getThemeCatalogEntry, FALLBACK_GRAPHIC_PRESETS } from "@/lib/themeCatalog";

export interface SetupPanels {
  panels: BackdropItem[];
  /** What else the layout sets (the neon sign on a shimmer wall, no plinths for the themed set, a garland for the ring). */
  patch: Partial<DecorConfig>;
  /** The board the words go on, or -1. */
  textOn: number;
}

/** `sized`: arches already Large (a ready-made look), not waiting for her to pick a size. */
export function setupPanels(templateId: string, themeId: string, opts: { sized?: boolean } = {}): SetupPanels | null {
  // Arch pieces start UNSIZED — the user must explicitly pick a size before
  // the row is complete. Default dims stay 100x200 for render safety.
  const makeArch = (id: string) => opts.sized ? { ...makeBackdropItem("arch", "large"), id } : { ...makeBackdropItem("arch"), sizeId: undefined, id };
  const patch: Partial<DecorConfig> = {};
  let panels: BackdropItem[];
  switch (templateId) {
    case "single_arch": panels = [makeArch("arch-1")]; break;
    case "single_round": {
      // 2026-10-20, customer request: Single Round comes with "Happy Birthday" printed in silver.
      // 2026-10-24: and no longer with a standee — "character standeeler secili default gelmesin hicbir setupta".
      const round = makeBackdropItem("round");
      panels = [{ ...round, text: { ...round.text, enabled: true, value: DEFAULT_TEXT_VALUE, color: themeTextColor(themeId) } }];
      break;
    }
    // 2026-09-05: a banner has one fixed size (2x2m), so unlike an arch it needs no size step.
    case "single_banner": {
      // 2026-10-21: the banner comes already printed with the theme — the pattern print when the theme has one
      // (Frozen: Snowflake Pattern), the customer's chosen look, not the characters.
      const banner = makeBackdropItem("banner");
      const presets = getThemeCatalogEntry(themeId)?.graphicPresets ?? FALLBACK_GRAPHIC_PRESETS;
      const first = (presets as { label: string }[]).find((pr) => /snowflake|pattern/i.test(pr.label)) as typeof presets[number] | undefined ?? presets[0];
      panels = [first
        ? { ...banner, graphic: { ...banner.graphic, enabled: true, theme: first.id, source: "preset", assetId: first.assetId } }
        : banner];
      break;
    }
    case "arch_open_frame": panels = [makeArch("arch-1"), makeBackdropItem("open_arch_frame")]; break;
    case "single_shimmer": panels = [makeBackdropItem("shimmer_wall")]; break;
    // 2026-11-01: one fixed size each (the wavy board the lone arch's Large, the fringe 2 x 2 m).
    case "single_wavy": panels = [makeBackdropItem("wavy")]; break;
    case "single_fringe": panels = [makeBackdropItem("fringe")]; break;
    // 2026-11-01: the theme's whole set; it stands on its own round stage, so no plinths.
    case "custom_themed": panels = [makeBackdropItem("themed_set")]; patch.plinthSizes = []; break;
    case "arch_shimmer": panels = [makeArch("arch-1"), makeBackdropItem("shimmer_wall")]; break;
    case "wavy_shimmer": panels = [makeBackdropItem("wavy"), makeBackdropItem("shimmer_wall")]; break;
    // The ring is made of balloons (useDecorStep turns a "none" garland back on).
    case "balloon_ring": panels = [makeBackdropItem("balloon_ring")]; break;
    // 2026-10-22: created sized, Large then Medium — "large ve medium backdroplar default gelsin, user secmesin".
    case "double_arch":
      panels = [{ ...makeBackdropItem("arch", "large"), id: "arch-1" }, { ...makeBackdropItem("arch", "medium"), id: "arch-2" }];
      break;
    // 2026-09-09: the two half arches bracket the centre board, the 200cm Medium, created already sized.
    case "triple_arch":
      panels = [
        { ...makeBackdropItem("half_arch"), id: "half-1" },
        { ...makeBackdropItem("arch", "medium"), id: "arch-1" },
        { ...makeBackdropItem("half_arch"), id: "half-2" },
      ];
      break;
    default: return null;
  }
  // 2026-10-22: every setup with a board comes with "Happy Birthday" on it, on the board its reference puts it on, in
  // the theme's lettering colour. The ring has no board, so no lettering.
  const idx = (t: string) => panels.findIndex((p) => p.type === t);
  const textOn = (() => {
    switch (templateId) {
      case "single_arch": case "single_round": case "single_banner": case "single_shimmer": case "single_wavy": case "custom_themed": return 0;
      case "double_arch": case "triple_arch": return 1;
      case "arch_shimmer": case "wavy_shimmer": return idx("shimmer_wall");
      case "arch_open_frame": return idx("arch");
      default: return -1;
    }
  })();
  // 2026-10-22: on a shimmer wall the words are a lit LED neon sign ("shimmer wall oldugu zaman hep led yazsin happy
  // birthday"), and the wall carries no printed lettering.
  const neonOnShimmer = textOn >= 0 && panels[textOn]?.type === "shimmer_wall";
  if (textOn >= 0 && panels[textOn] && !neonOnShimmer) {
    panels = panels.map((p, i) => i === textOn && !p.text.enabled
      ? { ...p, text: { ...p.text, enabled: true, value: p.text.value.trim() || DEFAULT_TEXT_VALUE, color: themeTextColor(themeId) } }
      : p);
  }
  if (neonOnShimmer) {
    panels = panels.map((p) => p.type === "shimmer_wall" ? { ...p, text: { ...p.text, enabled: false } } : p);
    patch.neonSign = { enabled: true, text: DEFAULT_TEXT_VALUE, panelIndex: textOn };
  }
  return { panels, patch, textOn };
}
