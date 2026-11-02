// The Wavy and Fringe Backdrops (2026-11-01, the owner: "wavy single arch
// size inda olsun. fringe olan 2mx 2m size olsun, fiyatlari ayni olsun").
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { makeBackdropItem, priceBreakdown } from "@/lib/config";
import { getSetupLayoutTemplate, inferSetupLayoutTemplateIdFromBackdropItems } from "@/lib/setupLayoutCatalog";
import { buildSceneModel } from "@/lib/buildSceneModel";
import { buildLayoutRefEditPrompt } from "@/lib/renderPrompts/buildLayoutRefEditPrompt";
import { sceneStyleReference } from "@/lib/renderPrompts/frozenStyleReferences";
import { UNICORN_ARCH_STYLE_REFERENCE } from "@/lib/renderPrompts/unicornStyleReferences";
import { wavyBorderColor } from "@/lib/wavyBoard";
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

  it("every setup is photographed per theme and balloon set (2026-11-02: re-lit real renders, never repainted as shot)", () => {
    const sk = path.join(process.cwd(), "public/design/sketch");
    // The Customized Themed set is Frozen's own photo, shown as it is.
    const frozen = readdirSync(sk).filter((f) => /-(room\.webp|balloons\.webp|families\.png|board-\d\.png)$/.test(f) && !f.startsWith("themed_set"));
    expect(frozen.length).toBeGreaterThan(40);
    for (const set of ["unicorn-pastel", "unicorn-bright", "frozen-pastel", "frozen-bright"]) {
      for (const f of frozen) expect(existsSync(path.join(sk, set, f.replace("round-board-mask", "round-board-0"))), `${set}/${f}`).toBe(true);
      expect(existsSync(path.join(sk, set, "single_wavy-rim-0.png")), `${set} rim`).toBe(true);
    }
  });

  it("give the wavy board an offset border, in the party's first colour unless one is picked", () => {
    const wavy = buildSceneModel(withSetup(withTheme(defaultConfig(), "unicorn"), "single_wavy")).panels[0];
    expect(wavy.borderColor).toBe("#F8BBD0");
    expect(wavyBorderColor("#123456", ["#F8BBD0"], "#000000")).toBe("#123456");
    // White, silver and clear are passed over.
    expect(wavyBorderColor(undefined, ["#FFFFFF", "#C0C0C0", "#BAE6FD"], "#000000")).toBe("#BAE6FD");
    expect(buildLayoutRefEditPrompt(buildSceneModel(withSetup(withTheme(defaultConfig(), "unicorn"), "single_wavy")))).toContain("offset border");
  });

  it("hang the fringe in a frame, in tiers, down to the floor", () => {
    const fringe = buildLayoutRefEditPrompt(buildSceneModel(withSetup(withTheme(defaultConfig(), "unicorn"), "single_fringe")));
    expect(fringe).toContain("wooden frame");
    expect(fringe).toContain("touches the floor");
  });

  it("describe their own shape in the render prompt", () => {
    const wavy = buildLayoutRefEditPrompt(buildSceneModel(withSetup(withTheme(defaultConfig(), "frozen"), "single_wavy")));
    expect(wavy).toContain("softly wavy sides");
    expect(wavy).not.toContain("ONE arch board");
    const fringe = buildLayoutRefEditPrompt(buildSceneModel(withSetup(withTheme(defaultConfig(), "unicorn"), "single_fringe")));
    expect(fringe).toContain("tinsel");
    expect(fringe).toContain("fringe curtain");
    expect(fringe).not.toContain("square banner board");
  });

  it("shoot the wavy board against the arch photo (Unicorn's own), the fringe against none", () => {
    expect(sceneStyleReference({ theme: "frozen", panels: [{ type: "wavy" }], balloons: { style: "half" } })?.board).toBe("wavy board");
    expect(sceneStyleReference({ theme: "unicorn", panels: [{ type: "wavy" }], balloons: { style: "half" } })?.image).toBe(UNICORN_ARCH_STYLE_REFERENCE);
    expect(sceneStyleReference({ theme: "unicorn", panels: [{ type: "arch" }], balloons: { style: "half" } })?.image).toBe(UNICORN_ARCH_STYLE_REFERENCE);
    expect(sceneStyleReference({ theme: "frozen", panels: [{ type: "arch" }], balloons: { style: "half" } })?.image).not.toBe(UNICORN_ARCH_STYLE_REFERENCE);
    expect(sceneStyleReference({ theme: "frozen", panels: [{ type: "fringe" }], balloons: { style: "half" } })).toBeNull();
  });

  it("gives Unicorn rainbow pastel balloons with no silver, like the owner's reference (no peach)", () => {
    const u = THEME_CATALOG.find((t) => t.id === "unicorn")!;
    expect(u.sempertexPaletteIds.some((id) => /chrome|silver|peach/i.test(id))).toBe(false);
    expect(u.sempertexPaletteIds).toEqual(["pastel-matte-609-pink", "pastel-matte-620-yellow", "pastel-matte-630-green", "pastel-matte-640-blue", "pastel-matte-650-lilac"]);
  });
});
