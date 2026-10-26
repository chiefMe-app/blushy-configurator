// The builder config and the handlers that change it, moved unchanged from
// ConfigurePage in app/builder/page.tsx (Phase 0.1g). The page calls this first,
// so its hooks keep their order.
import { useState } from "react";
import { getThemeGraphicPresets, getThemeCutoutPresets } from "@/lib/themeCatalog";
import {
  normalizeCutouts,
  themeTextColor,
  defaultConfig,
  themeById,
  DEFAULT_BACKDROP_COLOR,
  type CutoutSelection,
  type BuilderConfig,
  type DecorConfig,
  type VenueDetails,
  type CustomerDetails,
  type AddOnId,
  type EventTypeId,
  type ThemeId,
  type ServicePackageId,
} from "@/lib/config";

export function useBuilderConfig() {
  const [config, setConfig] = useState<BuilderConfig>(defaultConfig());

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
    // 2026-10-24: standees belong to a theme — Elsa stayed on a Barbie party.
    // Characters the new theme does not offer are dropped.
    const themeAssetIds = new Set([
      ...(getThemeCutoutPresets(id) ?? []).map((p) => p.assetId),
      ...getThemeGraphicPresets(id).map((p) => p.assetId ?? p.id),
    ]);
    const keepCutouts = (cut: CutoutSelection): CutoutSelection => {
      const sel = cut.selectedAssets ?? [];
      const next = sel.filter((a) => themeAssetIds.has(a.assetId));
      return next.length === sel.length ? cut : normalizeCutouts({ ...cut, selectedAssets: next });
    };
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
            cutouts: c.theme === id ? c.decor.cutouts : keepCutouts(c.decor.cutouts),
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

  return {
    config, setConfig, patchDecor, patchVenue, patchCustomer, setEventType, setTheme,
    setServicePackage, toggleAddOn, setAddOnOption,
  };
}
