// Balloon colour sets (lib/balloonSets.ts). 2026-11-02, the owner: "bright colorda sempertex katalogtan
// peach, fashion rose, pastel green, pastel lilac".
import { describe, expect, it } from "vitest";
import { sceneBalloonSet, setHexes, themeBalloonSets, themedSetBalloons } from "@/lib/balloonSets";
import { sceneStyleReference } from "@/lib/renderPrompts/frozenStyleReferences";
import { UNICORN_ARCH_STYLE_REFERENCE, UNICORN_BRIGHT_ARCH_STYLE_REFERENCE } from "@/lib/renderPrompts/unicornStyleReferences";

describe("balloon sets", () => {
  const u = themeBalloonSets("unicorn");

  it("Unicorn's bright set is peach, Fashion 017 fuchsia, pastel green and pastel lilac", () => {
    expect(u.bright).toEqual(["fashion-060-peach-blush", "fashion-017-fuchsia", "pastel-matte-630-green", "pastel-matte-650-lilac"]);
  });

  it("tells the sets apart by their colours, though both are pale", () => {
    expect(sceneBalloonSet("unicorn", setHexes(u.bright))).toBe("bright");
    expect(sceneBalloonSet("unicorn", [...setHexes(u.bright), "#FFFFFF"])).toBe("bright");
    expect(sceneBalloonSet("unicorn", setHexes(u.pastel))).toBe("pastel");
    // A mix of one's own: by lightness.
    expect(sceneBalloonSet("unicorn", ["#DB2777", "#EA580C"])).toBe("bright");
  });

  it("gives the Customized Themed set its photo's balloons: Frozen's pastel set and the shiny Reflex Violet", () => {
    const ids = themedSetBalloons("frozen");
    expect(ids.slice(0, -1)).toEqual(themeBalloonSets("frozen").pastel);
    expect(ids[ids.length - 1]).toBe("reflex-951-violet");
  });

  it("shoots each set against its own photo", () => {
    const scene = (colors: string[]) => ({ theme: "unicorn", panels: [{ type: "arch" }], balloons: { style: "half", colors } });
    expect(sceneStyleReference(scene(setHexes(u.bright)))?.image).toBe(UNICORN_BRIGHT_ARCH_STYLE_REFERENCE);
    expect(sceneStyleReference(scene(setHexes(u.pastel)))?.image).toBe(UNICORN_ARCH_STYLE_REFERENCE);
  });
});
