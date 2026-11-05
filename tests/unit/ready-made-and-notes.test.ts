// 2026-11-05: the ready-made giveaways and cakes, her notes for the design team, and the party photo's table told in
// words (the owner: "masanın üstündekiler plinthin üstündekiler biraz saçmalamış").
import { describe, expect, it } from "vitest";
import { MAX_NOTES, cleanNotes, defaultConfig, themeById, type BuilderConfig } from "@/lib/config";
import { fromDraft, toDraft } from "@/lib/draft";
import { defaultGiveaways, giveawaysTotal } from "@/lib/studio/giveaways";
import { giveawaySamples, withGiveawaySample } from "@/lib/studio/giveawaySamples";
import { cakeSamples } from "@/lib/studio/cakeSamples";
import { cakeDesigns } from "@/lib/studio/cake";
import { defaultTableSetup } from "@/lib/studio/tableSetup";
import { partyPrompt, placeWords } from "@/lib/studio/partyRender";
import { itemWords } from "@/lib/studio/tableRender";

const unicorn = themeById("unicorn")!;

describe("her notes for the design team", () => {
  it("keeps her words and line breaks, drops control characters, caps the length", () => {
    expect(cleanNotes("Gold \"5\" please\nand a crown")).toBe("Gold \"5\" please\nand a crown");
    expect(cleanNotes("a\u0000b\u0007c\td")).toBe("abcd");
    expect(cleanNotes("x".repeat(MAX_NOTES + 50))).toHaveLength(MAX_NOTES);
    expect(cleanNotes(42)).toBe("");
  });
  it("are kept in the draft and read back", () => {
    const c: BuilderConfig = { ...defaultConfig(), theme: unicorn.id, themeSelected: true, notes: "Please match her dress, lilac" };
    const back = fromDraft(JSON.stringify(toDraft(c, 6, 0)));
    expect(back?.config.notes).toBe("Please match her dress, lilac");
    const none = fromDraft(JSON.stringify(toDraft({ ...c, notes: "   " }, 6, 0)));
    expect(none?.config.notes).toBeUndefined();
  });
});

describe("ready-made giveaways", () => {
  const g = { ...defaultGiveaways({ kids: 14, name: "Arya" }), contents: ["candy" as const] };
  it("keep her boxes' number, what is in them and the name", () => {
    for (const s of giveawaySamples(unicorn, true)) {
      const l = withGiveawaySample(g, s);
      expect([l.count, l.contents, l.name, l.enabled]).toEqual([14, ["candy"], "Arya", true]);
      expect(giveawaysTotal(l)).toBeGreaterThan(0);
    }
  });
  it("go to the table only when she kept a kids' table", () => {
    expect(giveawaySamples(unicorn, true).some((s) => s.patch.place === "table")).toBe(true);
    expect(giveawaySamples(unicorn, false).every((s) => s.patch.place === "board")).toBe(true);
  });
});

describe("ready-made cakes", () => {
  const seed = { themeId: "unicorn", themeName: "Unicorn", name: "Arya", age: "5", colours: unicorn.balloonColors };
  it("are each a theme design, a place to show it and sweets beside it", () => {
    const designs = cakeDesigns(seed).map((d) => d.id);
    const s = cakeSamples(seed, ["unicorn"]);
    expect(s.map((x) => x.id)).toEqual(["cart", "plinths", "table"]);
    for (const x of s) { expect(designs).toContain(x.design.id); expect(x.scene.sweets?.length).toBeGreaterThan(0); }
    expect(s[0].scene.cart).toBeTruthy();
    expect(s[1].scene.plinths).toBe(true);
    expect(s[0].scene.cart && s[1].scene.cart).toBeFalsy();
  });
});

describe("the party photo's table", () => {
  it("names each piece at the places with its colour, and nothing standing on the table or the plinths", () => {
    const table = { ...defaultTableSetup(unicorn), enabled: true, cupColor: "#F8BBD0" };
    const c = { ...defaultConfig(), theme: unicorn.id, table } as BuilderConfig;
    c.decor = { ...c.decor, backdropItems: [{ id: "a", type: "arch", color: "#FFFFFF" } as BuilderConfig["decor"]["backdropItems"][number]], plinths: 2 };
    const p = partyPrompt(c, "indoor", { backdrop: true, table: true });
    expect(p).toContain(placeWords(table, unicorn.id));
    expect(p).toContain(itemWords(table, unicorn.id, "cups"));
    expect(p).toMatch(/nothing stands up on the table — no cards, signs, place cards, standing letters or words/);
    expect(p).toMatch(/bare on top as image 1 shows it — no cards, signs, letters or cakes on them/);
  });
});
