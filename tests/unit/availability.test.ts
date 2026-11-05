// The setup team's availability and the demo payment (2026-11-05, the owner: "ikinci paket icin tarih girdikten sonra
// event firmasninda musaitliginin yaninda tik olduktan sonra odeme alincak").
import { describe, expect, it } from "vitest";
import { defaultConfig, type BuilderConfig } from "@/lib/config";
import { MIN_LEAD_DAYS, dubaiToday, niceDate, partySuppliers, paymentBlockers, setupAvailability } from "@/lib/availability";

const NOW = new Date("2026-11-05T10:00:00+04:00");

describe("the setup team's availability (demo)", () => {
  it("is free on a day far enough ahead, never in the past or too soon", () => {
    expect(dubaiToday(NOW)).toBe("2026-11-05");
    // Late at night in London is already the next day in Dubai.
    expect(dubaiToday(new Date("2026-11-05T22:30:00Z"))).toBe("2026-11-06");
    expect(setupAvailability("2026-12-12", NOW)).toEqual({ ok: true, date: "2026-12-12" });
    expect(setupAvailability("2026-11-08", NOW)).toMatchObject({ ok: MIN_LEAD_DAYS <= 3 });
    expect(setupAvailability("2026-11-06", NOW)).toMatchObject({ ok: false, reason: "too_soon" });
    expect(setupAvailability("2026-11-01", NOW)).toMatchObject({ ok: false, reason: "past" });
    expect(setupAvailability("", NOW)).toMatchObject({ ok: false, reason: "no_date" });
    expect(setupAvailability("12/12/2026", NOW)).toMatchObject({ ok: false, reason: "bad_date" });
    expect(niceDate("2026-12-12")).toBe("Sat, 12 Dec 2026");
  });
});

describe("who confirms before the card is charged", () => {
  const c = (over: Partial<BuilderConfig>): BuilderConfig => ({ ...defaultConfig(), ...over });
  const x = { picked: ["photographer", "popcorn"], children: 10, adults: 8, photoHours: 2, video: false, popcornBoxes: "plain", candyColour: "pink", place: "outdoor" } as never;
  it("is the setup team (We do it) and each experience booked; DIY without the ones she took out", () => {
    expect(partySuppliers(c({ servicePackageId: "we_do_it", experiences: x })).map((s) => s.name)).toEqual(["PartyMuse setup team", "Party photographer", "Popcorn cart"]);
    expect(partySuppliers(c({ servicePackageId: "diy", experiences: x, diy: { bring: [], skipExperiences: ["popcorn"] } })).map((s) => s.name)).toEqual(["Party photographer"]);
  });

  it("holds the payment back until her details and — We do it — a free date", () => {
    const base = c({ servicePackageId: "we_do_it", customer: { name: "Test Customer", whatsapp: "+971500000000" } as never });
    expect(paymentBlockers({ ...base, venue: { ...base.venue, date: "2026-12-12" } }, NOW)).toEqual([]);
    expect(paymentBlockers({ ...base, venue: { ...base.venue, date: "" } }, NOW)).toEqual(["Add your party date to check we're free."]);
    // DIY: no setup team to book.
    expect(paymentBlockers({ ...base, servicePackageId: "diy", venue: { ...base.venue, date: "" } }, NOW)).toEqual([]);
    expect(paymentBlockers({ ...base, customer: { name: "", whatsapp: "" } as never, venue: { ...base.venue, date: "2026-12-12" } }, NOW)).toHaveLength(1);
  });
});
