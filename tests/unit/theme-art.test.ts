// A theme's own art (2026-11-01, Unicorn after Frozen): every piece a theme
// claims has its picture in public/, so no theme shows a broken image.
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BANNER_PRINT_THEMES, bannerPrintTheme } from "@/lib/bannerPrintThemes";
import { THEME_CATALOG } from "@/lib/themeCatalog";
import { TABLE_ITEMS } from "@/lib/studio/tableCatalog";
import tablePieces from "@/lib/studio/tableTopPieces.json";
import { THEME_GROUPS } from "@/components/builder/constants";
import { THEMES } from "@/lib/config";
import { SEMPERTEX_CATALOG } from "@/lib/sempertexCatalog";
import { motifOf } from "@/lib/studio/tableRender";

const inPublic = (url: string) => existsSync(path.join(process.cwd(), "public", url));

describe("theme art", () => {
  it("reads a banner graphic's print theme from its asset id", () => {
    expect(bannerPrintTheme("frozen-01")).toBe("frozen");
    expect(bannerPrintTheme("unicorn-03")).toBe("unicorn");
    expect(bannerPrintTheme("dinosaur-01")).toBeNull();
    expect(bannerPrintTheme(undefined)).toBeNull();
  });

  it("has every banner print's picture", () => {
    for (const t of BANNER_PRINT_THEMES) expect(inPublic(`design/sketch/banner-print-${t}.webp`), t).toBe(true);
  });

  it("has every standee's picture", () => {
    for (const t of THEME_CATALOG) for (const c of t.cutoutPresets ?? []) expect(inPublic(c.previewUrl), c.previewUrl).toBe(true);
  });

  it("has the table cutouts' card and top-view piece in every theme offering them", () => {
    const cutouts = TABLE_ITEMS.flatMap((i) => i.options).find((o) => o.id === "cutouts")!;
    expect(cutouts.themes).toContain("unicorn");
    for (const t of cutouts.themes!) {
      expect(inPublic(`design/table/centrepiece/${t}/cutouts.webp`), t).toBe(true);
      expect((tablePieces as Record<string, unknown>)[`centrepiece-cutouts-${t}`], t).toBeTruthy();
    }
  });

  it("has every listed theme's icon, cover, placemats and Sempertex colours", () => {
    for (const g of THEME_GROUPS) for (const { id, icon } of g.items) {
      expect(inPublic(`design/themes-v2/${icon}.webp`), icon).toBe(true);
      const t = THEME_CATALOG.find((c) => c.id === id);
      expect(t, id).toBeTruthy();
      const cover = t!.coverImageUrl ?? "";
      if (cover.startsWith("/design/")) expect(inPublic(cover), cover).toBe(true);
      for (const p of t!.sempertexPaletteIds ?? []) expect(SEMPERTEX_CATALOG.some((c) => c.id === p), `${id} ${p}`).toBe(true);
      for (const d of ["pattern", "watercolour", "sparkle", "watercolour-portrait"]) expect(inPublic(`design/table/placemats/${id}/${d}.webp`), `${id} ${d}`).toBe(true);
    }
  });

  // 2026-11-03 (owner): "paw patrol hem kız hem erkek gabbys sadece kıza" — under generic names only.
  it("lists Puppy Rescue for girls and boys and Dollhouse & Kitties for girls, naming no licensed character", () => {
    const list = (key: "girl" | "boy") => THEME_GROUPS.find((g) => g.key === key)!.items.map((i) => i.id);
    expect(list("girl")).toEqual(expect.arrayContaining(["puppy_rescue", "dollhouse_kitties"]));
    expect(list("boy")).toContain("puppy_rescue");
    expect(list("boy")).not.toContain("dollhouse_kitties");
    const licensed = /paw ?patrol|chase|marshall|skye|rubble|gabby|pandy|mercat|cakey|kitty fairy/i;
    for (const id of ["puppy_rescue", "dollhouse_kitties"]) {
      const t = THEME_CATALOG.find((c) => c.id === id)!;
      const words = [t.name, t.description, t.renderDescription, ...(t.graphicPresets ?? []).flatMap((g) => [g.label, g.desc]), THEMES.find((c) => c.id === id)!.name, motifOf(id)].join(" ");
      expect(words, id).not.toMatch(licensed);
    }
  });
});
