import { describe, expect, it } from "vitest";
import { SERVICE_PACKAGES, defaultConfig, diyPieceOf, priceBreakdown, readDiy, readServicePackageId, servicePackageById, type BuilderConfig } from "@/lib/config";
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

  it("DIY charges the design fee and the experiences; the theme is free, the pieces hers to make", () => {
    const diy = priceBreakdown(party("diy"));
    const we = priceBreakdown(party("we_do_it"));
    expect(diy.lines.map((l) => l.section)).toEqual(["package", "experiences"]);
    expect(diy.lines[0]).toEqual({ label: "DIY package (design fee)", amount: 250, section: "package" });
    expect(diy.total).toBe(250 + 650);
    expect(we.shopping).toEqual([]);
    // The same pieces: in We do it they are charged, in DIY hers.
    expect(we.lines.filter((l) => l.section !== "package" && l.section !== "experiences")).toEqual(diy.shopping);
  });

  it("DIY adds what she asks us to bring, and leaves out an experience she takes out", () => {
    const base = party("diy");
    const helium = priceBreakdown({ ...base, servicePackageId: "we_do_it" }).lines.filter((l) => l.section === "helium");
    const rental = priceBreakdown({ ...base, servicePackageId: "we_do_it" }).lines.filter((l) => diyPieceOf(l) === "rental");
    expect(helium.length).toBeGreaterThan(0);
    expect(rental.map((l) => l.label)).toEqual(["Plinths (1)"]);
    const b = priceBreakdown({ ...base, diy: { bring: ["helium", "rental"], skipExperiences: ["magician"] } });
    expect(b.total).toBe(250 + [...helium, ...rental].reduce((t, l) => t + l.amount, 0));
    expect(b.lines.some((l) => l.section === "experiences")).toBe(false);
    expect(b.shopping.some((l) => l.section === "helium")).toBe(false);
    // Taken out only in DIY: We do it still has the magician.
    expect(priceBreakdown({ ...base, servicePackageId: "we_do_it", diy: { bring: [], skipExperiences: ["magician"] } }).lines.some((l) => l.label === "Magic show")).toBe(true);
    expect(readDiy({ bring: ["cake", "x", "cake"], skipExperiences: ["dj", 3] })).toEqual({ bring: ["cake"], skipExperiences: ["dj"] });
    expect(readDiy(null)).toBeUndefined();
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
