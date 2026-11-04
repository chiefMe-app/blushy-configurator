import { describe, expect, it } from "vitest";
import { defaultConfig, type BuilderConfig } from "@/lib/config";
import { clockBefore, setupWhen, venueRows } from "@/lib/venue";

const withVenue = (servicePackageId: BuilderConfig["servicePackageId"], v: Partial<BuilderConfig["venue"]>): BuilderConfig => {
  const c = defaultConfig();
  return { ...c, servicePackageId, venue: { ...c.venue, ...v } };
};

describe("the venue step", () => {
  it("counts back from the party's start", () => {
    expect(clockBefore("14:30", 3)).toBe("11:30");
    expect(clockBefore("01:00", 2)).toBe("23:00");
    expect(clockBefore("", 3)).toBe("");
    expect(setupWhen({ time: "16:00", setupLead: "2h" })).toBe("14:00 on the day (2 hours before)");
    expect(setupWhen({ time: "", setupLead: undefined })).toBe("3 hours before");
    expect(setupWhen({ time: "10:00", setupLead: "evening" })).toBe("The evening before");
  });

  it("DIY reads as a home address; We do it as the venue, its setup and collection", () => {
    const place = { date: "2026-12-05", time: "16:00", endTime: "19:00", area: "Jumeirah, Dubai", street: "Al Wasl Road, Villa 12", unit: "12", childrenCount: 12, adultsCount: 8, guestCount: 20 };
    const diy = venueRows(withVenue("diy", { ...place, notes: "Gate code 1234" }));
    expect(diy.map((r) => r.k)).toEqual(["Date", "Party time", "Home address", "Setting", "Notes", "Children", "Grown-ups"]);
    // Indoors or outdoors is unset until she marks it (on the party's picture).
    expect(diy.find((r) => r.k === "Setting")?.v).toBe("—");
    expect(diy.find((r) => r.k === "Home address")?.v).toBe("12, Al Wasl Road, Villa 12, Jumeirah, Dubai");
    expect(diy.find((r) => r.k === "Party time")?.v).toBe("16:00 – 19:00");
    const we = venueRows(withVenue("we_do_it", { ...place, venueType: "Restaurant", venueName: "The Garden", setupLead: "3h", collection: "next_morning" }));
    expect(we.find((r) => r.k === "Venue")?.v).toBe("Restaurant · The Garden");
    expect(we.find((r) => r.k === "We set up")?.v).toBe("13:00 on the day (3 hours before)");
    expect(we.find((r) => r.k === "We collect")?.v).toBe("The next morning");
    expect(we.find((r) => r.k === "Grown-ups")?.v).toBe("8");
    // No venue photos any more (2026-11-04): the party's picture instead.
    expect(we.map((r) => r.k)).toEqual(["Date", "Party time", "Venue", "Address", "Setting", "We set up", "We collect", "Children", "Grown-ups"]);
    expect(venueRows(withVenue("we_do_it", { ...place, isOutdoor: false })).find((r) => r.k === "Setting")?.v).toBe("Indoor");
  });
});
