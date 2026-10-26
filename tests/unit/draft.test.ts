// lib/draft.ts: the design kept on the customer's device.
import { describe, expect, it } from "vitest";
import { defaultConfig, type BuilderConfig } from "@/lib/config";
import { fromDraft, isWorthSaving, toDraft } from "@/lib/draft";
import { fixtureById } from "../fixtures/configs";

const withCustomer = (c: BuilderConfig): BuilderConfig => ({
  ...c,
  customer: { ...c.customer, name: "Ayşe Test", whatsapp: "+971500000000" },
  venue: { ...c.venue, area: "Villa 12, Test Street", date: "2026-12-01" },
});

describe("draft on the device", () => {
  it("round-trips the design, step and tab", () => {
    const config = fixtureById("A-single_round").config;
    const back = fromDraft(JSON.stringify(toDraft(config, 2, 3)))!;
    expect(back.step).toBe(2);
    expect(back.decorTab).toBe(3);
    for (const k of ["eventType", "theme", "themeSelected", "package", "servicePackageId", "decor", "addOns"] as const) {
      expect(back.config[k]).toEqual(config[k]);
    }
  });

  it("never stores the customer's name, phone or venue", () => {
    const text = JSON.stringify(toDraft(withCustomer(fixtureById("A-single_round").config), 5, 0));
    for (const s of ["Ayşe Test", "971500000000", "Villa 12", "2026-12-01"]) expect(text).not.toContain(s);
    const back = fromDraft(text)!;
    expect(back.config.customer).toEqual(defaultConfig().customer);
    expect(back.config.venue).toEqual(defaultConfig().venue);
  });

  it("ignores missing, broken or foreign data", () => {
    for (const raw of [null, "", "{nope", "[]", "null", JSON.stringify({ v: 2, config: {} }),
      JSON.stringify({ v: 1, config: { decor: "x", addOns: [] , theme: "frozen" } }),
      JSON.stringify({ v: 1, config: { decor: { backdropItems: [] }, addOns: [], theme: "no_such_theme" } })]) {
      expect(fromDraft(raw)).toBeNull();
    }
  });

  it("keeps steps and tabs in range, and stays before Decor without a theme", () => {
    const c = defaultConfig();
    const raw = (step: unknown, decorTab: unknown, themeSelected: boolean) =>
      JSON.stringify({ ...toDraft({ ...c, themeSelected }, 0, 0), step, decorTab });
    expect(fromDraft(raw(99, 9, true))).toMatchObject({ step: 6, decorTab: 3 });
    expect(fromDraft(raw(-3, "2", true))).toMatchObject({ step: 0, decorTab: 0 });
    expect(fromDraft(raw(4, 1, false))!.step).toBe(1);
  });

  it("fills fields added after the draft was saved from today's defaults", () => {
    const d = toDraft(fixtureById("A-single_round").config, 2, 0);
    const old = { ...d, config: { ...d.config, decor: { ...d.config.decor } } } as Record<string, any>;
    delete old.config.decor.plinthSizes;
    expect(fromDraft(JSON.stringify(old))!.config.decor.plinthSizes).toEqual(defaultConfig().decor.plinthSizes);
  });

  it("a fresh, untouched builder is not saved", () => {
    expect(isWorthSaving(defaultConfig(), 0)).toBe(false);
    expect(isWorthSaving(defaultConfig(), 1)).toBe(true);
    expect(isWorthSaving({ ...defaultConfig(), themeSelected: true }, 0)).toBe(true);
  });
});
