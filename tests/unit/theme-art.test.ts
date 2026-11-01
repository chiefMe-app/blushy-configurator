// A theme's own art (2026-11-01, Unicorn after Frozen): every piece a theme
// claims has its picture in public/, so no theme shows a broken image.
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BANNER_PRINT_THEMES, bannerPrintTheme } from "@/lib/bannerPrintThemes";
import { THEME_CATALOG } from "@/lib/themeCatalog";
import { TABLE_ITEMS } from "@/lib/studio/tableCatalog";
import tablePieces from "@/lib/studio/tableTopPieces.json";

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
});
