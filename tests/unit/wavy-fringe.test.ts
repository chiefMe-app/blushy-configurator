// The Wavy and Fringe Backdrops (2026-11-01, the owner: "wavy single arch
// size inda olsun. fringe olan 2mx 2m size olsun, fiyatlari ayni olsun").
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { makeBackdropItem, priceBreakdown } from "@/lib/config";
import { getSetupLayoutTemplate, inferSetupLayoutTemplateIdFromBackdropItems } from "@/lib/setupLayoutCatalog";
import { buildSceneModel } from "@/lib/buildSceneModel";
import { buildLayoutRefEditPrompt } from "@/lib/renderPrompts/buildLayoutRefEditPrompt";
import { sceneStyleReference } from "@/lib/renderPrompts/frozenStyleReferences";
import { THEME_CATALOG } from "@/lib/themeCatalog";
import { withSetup, withTheme } from "../fixtures/builder";
import { defaultConfig } from "@/lib/config";
import { SETUP_ICON } from "@/components/builder/constants";

const inPublic = (url: string) => existsSync(path.join(process.cwd(), "public", url));
const backdropLine = (setup: string) => {
  const c = withSetup(withTheme(defaultConfig(), "unicorn"), setup);
  // The board's own line (the fringe carries no lettering, so the totals differ by that).
  return priceBreakdown(c).lines.find((l) => /Arch|Wavy|Fringe/.test(l.label))?.amount ?? 0;
};

describe("wavy and fringe backdrops", () => {
  it("are Single Arch size and 2 x 2 m", () => {
    expect([makeBackdropItem("wavy").widthCm, makeBackdropItem("wavy").heightCm]).toEqual([120, 220]);
    expect([makeBackdropItem("fringe").widthCm, makeBackdropItem("fringe").heightCm]).toEqual([200, 200]);
  });

  it("cost the same as Single Arch", () => {
    expect(backdropLine("single_arch")).toBeGreaterThan(0);
    expect(backdropLine("single_wavy")).toBe(backdropLine("single_arch"));
    expect(backdropLine("single_fringe")).toBe(backdropLine("single_arch"));
  });

  it("have setup cards with icons and are recognised from their pieces", () => {
    for (const id of ["single_wavy", "single_fringe"]) {
      expect(getSetupLayoutTemplate(id)).toBeTruthy();
      expect(inPublic(SETUP_ICON[id] ?? "")).toBe(true);
    }
    expect(inferSetupLayoutTemplateIdFromBackdropItems([makeBackdropItem("wavy")])).toBe("single_wavy");
    expect(inferSetupLayoutTemplateIdFromBackdropItems([makeBackdropItem("fringe")])).toBe("single_fringe");
  });

  it("have live sketch bases", () => {
    for (const s of ["single_wavy", "single_fringe"]) {
      for (const f of ["room.webp", "balloons.webp", "families.png", "board-0.png"]) {
        expect(inPublic(`/design/sketch/${s}-${f}`), `${s}-${f}`).toBe(true);
      }
    }
  });

  it("describe their own shape in the render prompt", () => {
    const wavy = buildLayoutRefEditPrompt(buildSceneModel(withSetup(withTheme(defaultConfig(), "frozen"), "single_wavy")));
    expect(wavy).toContain("softly wavy sides");
    expect(wavy).not.toContain("ONE arch board");
    const fringe = buildLayoutRefEditPrompt(buildSceneModel(withSetup(withTheme(defaultConfig(), "unicorn"), "single_fringe")));
    expect(fringe).toContain("tinsel");
    expect(fringe).toContain("square fringe curtain");
    expect(fringe).not.toContain("square banner board");
  });

  it("shoot the wavy board against the arch photo, the fringe against none", () => {
    expect(sceneStyleReference({ theme: "frozen", panels: [{ type: "wavy" }], balloons: { style: "half" } })?.board).toBe("wavy board");
    expect(sceneStyleReference({ theme: "frozen", panels: [{ type: "fringe" }], balloons: { style: "half" } })).toBeNull();
  });

  it("gives Unicorn rainbow pastel balloons with no silver", () => {
    const u = THEME_CATALOG.find((t) => t.id === "unicorn")!;
    expect(u.sempertexPaletteIds.some((id) => /chrome|silver/i.test(id))).toBe(false);
    expect(u.sempertexPaletteIds.length).toBe(5);
  });
});
