import { describe, expect, it } from "vitest";
import { SERVICE_PACKAGES, computeTotal, defaultConfig, priceBreakdown, readServicePackageId, servicePackageById, type BuilderConfig } from "@/lib/config";
import { defaultExperiences } from "@/lib/studio/experiences";
import { defaultHelium } from "@/lib/studio/helium";
import { SUPPLIERS, shoppingList, supplierFor } from "@/lib/studio/shopping";
import { fromDraft } from "@/lib/draft";

const party = (servicePackageId: BuilderConfig["servicePackageId"]): BuilderConfig => ({
  ...defaultConfig(), themeSelected: true, theme: "unicorn", servicePackageId,
  helium: defaultHelium(), experiences: { ...defaultExperiences(), picked: ["magician"] },
});

describe("the two packages", () => {
  it("are DIY and We do it, We do it until she picks", () => {
    expect(SERVICE_PACKAGES.map((p) => p.id)).toEqual(["diy", "we_do_it"]);
    expect(defaultConfig().servicePackageId).toBe("we_do_it");
  });

  it("read the four old packages as the two", () => {
    expect(readServicePackageId("design_only")).toBe("diy");
    expect(readServicePackageId("full_design")).toBe("diy");
    expect(readServicePackageId("delivery_backdrop")).toBe("we_do_it");
    expect(readServicePackageId("delivery_full")).toBe("we_do_it");
    expect(readServicePackageId("nope")).toBeUndefined();
    expect(servicePackageById("delivery_full")?.name).toBe("We do it");
    const raw = JSON.stringify({ v: 1, step: 4, config: { ...defaultConfig(), themeSelected: true, servicePackageId: "design_only" } });
    expect(fromDraft(raw)!.config.servicePackageId).toBe("diy");
  });

  it("DIY charges the design fee, the theme and the experiences; the pieces are her shopping", () => {
    const diy = priceBreakdown(party("diy"));
    const we = priceBreakdown(party("we_do_it"));
    expect(diy.lines.map((l) => l.section)).toEqual(["package", "design", "experiences"]); // design = the theme line
    expect(diy.lines[0]).toEqual({ label: "DIY package (design fee)", amount: 250, section: "package" });
    expect(diy.total).toBe(250 + diy.lines[1].amount + 650);
    expect(we.shopping).toEqual([]);
    // The same pieces: in We do it they are charged, in DIY listed.
    expect(we.lines.filter((l) => l.section !== "package" && l.section !== "experiences").slice(1)).toEqual(diy.shopping);
    expect(computeTotal(party("we_do_it")) - 450).toBe(diy.total - 250 + diy.shopping.reduce((t, l) => t + l.amount, 0));
  });

  it("sorts the shopping by the kind of shop that sells it", () => {
    expect(supplierFor({ label: "Balloons - Full", section: "design" })).toBe("balloons");
    expect(supplierFor({ label: "Plinths (2)", section: "design" })).toBe("rental");
    expect(supplierFor({ label: "Florals & greenery", section: "design" })).toBe("florist");
    expect(supplierFor({ label: "Neon LED sign", section: "design" })).toBe("neon");
    expect(supplierFor({ label: "Single Arch Backdrop", section: "design" })).toBe("print");
    expect(supplierFor({ label: "Three-tier cake", section: "cake" })).toBe("bakery");
    const list = shoppingList(party("we_do_it"));
    expect(list.groups.map((g) => g.supplier.id)).toEqual(["balloons", "rental"]); // the garland + helium, the plinth
    expect(list.groups[0].items.some((i) => i.piece === "Helium balloons")).toBe(true);
    expect(list.total).toBe(priceBreakdown(party("diy")).shopping.reduce((t, l) => t + l.amount, 0));
    // No made-up shops: the owner sends hers.
    expect(SUPPLIERS.every((s) => s.shops.length === 0)).toBe(true);
  });
});
