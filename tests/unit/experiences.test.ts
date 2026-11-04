import { describe, expect, it } from "vitest";
import { computeTotal, defaultConfig, priceBreakdown } from "@/lib/config";
import { EXPERIENCES, defaultExperiences, experiencePriceLines, experiencesFromAddOns, experiencesTotal, faceDesigns, hostCostume, readExperiences } from "@/lib/studio/experiences";
import { fromDraft } from "@/lib/draft";

describe("experiences", () => {
  it("opens with nothing picked, the guests from the tables", () => {
    expect(defaultExperiences()).toMatchObject({ picked: [], children: 10, adults: 10 });
    expect(defaultExperiences({ children: 16, adults: 8 })).toMatchObject({ children: 16, adults: 8 });
    expect(experiencesTotal(defaultExperiences())).toBe(0);
  });

  it("prices by the guests, the children or the hours", () => {
    const x = { ...defaultExperiences(), picked: EXPERIENCES.map((e) => e.id) };
    const lines = experiencePriceLines(x);
    expect(lines).toHaveLength(EXPERIENCES.length);
    // 20 guests: the first tier; the themed boxes on top.
    expect(lines[0]).toEqual({ label: "Popcorn cart, boxes in your theme, 20 guests", amount: 220 + 60 });
    expect(lines.find((l) => l.label.startsWith("Photographer"))).toEqual({ label: "Photographer, 2 hrs", amount: 750 });
    expect(lines.find((l) => l.label.startsWith("Face painting"))).toEqual({ label: "Face painting, 10 children", amount: 350 });
    // More guests: the next tiers.
    const big = { ...x, children: 25, adults: 30, popcornBoxes: "plain" as const, photoHours: 3 as const, video: true, place: "outdoor" as const };
    const more = experiencePriceLines(big);
    expect(more[0]).toEqual({ label: "Popcorn cart, plain white boxes, 55 guests", amount: 450 });
    expect(more.find((l) => l.label.startsWith("Photographer"))).toEqual({ label: "Photographer, 3 hrs + video film", amount: 1500 });
    expect(more.find((l) => l.label.startsWith("Slime"))).toEqual({ label: "Slime workshop, 25 children", amount: 900 });
    expect(more.find((l) => l.label.startsWith("Bouncy"))).toEqual({ label: "Bouncy castle, outdoor", amount: 450 });
  });

  it("is in the party's total", () => {
    const c = { ...defaultConfig(), themeSelected: true, experiences: { ...defaultExperiences(), picked: ["magician" as const, "ball_pit" as const] } };
    expect(priceBreakdown(c).lines.filter((l) => l.section === "experiences")).toEqual([
      { label: "Magic show", amount: 650, section: "experiences" }, { label: "Ball pit, indoor", amount: 280, section: "experiences" }]);
    expect(computeTotal(c)).toBe(computeTotal({ ...c, experiences: undefined }) + 930);
  });

  it("reads a stored one over the defaults, and the old Add-ons as experiences", () => {
    expect(readExperiences(null)).toBeUndefined();
    expect(readExperiences({ picked: ["dj", "nope", "dj"], children: -3, adults: 999, photoHours: 7, popcornBoxes: "x", place: "outdoor" }))
      .toMatchObject({ picked: ["dj"], children: 0, adults: 200, photoHours: 2, popcornBoxes: "themed", place: "outdoor" });
    expect(experiencesFromAddOns([{ id: "cake" }])).toBeUndefined();
    expect(experiencesFromAddOns([{ id: "mascot" }, { id: "videographer" }, { id: "photographer" }])).toMatchObject({ picked: ["character_host", "photographer"], video: true });
    const raw = JSON.stringify({ v: 1, step: 4, config: { ...defaultConfig(), themeSelected: true, addOns: [{ id: "popcorn", options: {} }] } });
    const d = fromDraft(raw)!;
    expect(d.config.experiences?.picked).toEqual(["popcorn"]);
    expect(d.config.addOns).toEqual([]);
  });

  it("gives the face painter and the host the theme, never a licensed character", () => {
    expect(faceDesigns("unicorn")).toContain("Unicorn horn");
    expect(hostCostume("frozen")).toBe("an ice princess");
    expect(faceDesigns("no-such-theme")).toEqual(["Butterfly", "Tiger", "Rainbow"]);
  });
});
