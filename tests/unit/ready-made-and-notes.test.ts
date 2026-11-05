// 2026-11-05: the ready-made giveaways and cakes, her notes for the design team, and the party photo's table told in
// words (the owner: "masanın üstündekiler plinthin üstündekiler biraz saçmalamış").
import { describe, expect, it } from "vitest";
import { MAX_NOTES, cleanNotes, defaultConfig, themeById, type BuilderConfig } from "@/lib/config";
import { fromDraft, toDraft } from "@/lib/draft";
import { defaultGiveaways, giveawaysTotal } from "@/lib/studio/giveaways";
import { appliedGiveawaySample, giveawaySamples, withGiveawaySample } from "@/lib/studio/giveawaySamples";
import { appliedSweetSample, cakeSamples, cookieSamples, cupcakeSamples, sceneOf, toScene } from "@/lib/studio/cakeSamples";
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

describe("ready-made giveaway boxes", () => {
  const g = { ...defaultGiveaways({ kids: 14, name: "Arya" }), contents: ["candy" as const], place: "table" as const };
  it("keep where they go, her boxes' number, what is in them and the name", () => {
    for (const s of giveawaySamples(unicorn)) {
      const l = withGiveawaySample(g, s);
      expect([l.count, l.contents, l.name, l.enabled, l.place]).toEqual([14, ["candy"], "Arya", true, "table"]);
      expect(giveawaysTotal(l)).toBe(giveawaysTotal(g));
      expect(appliedGiveawaySample(l, giveawaySamples(unicorn))).toBe(s.id);
    }
  });
  it("are each another print and lettering", () => {
    const s = giveawaySamples(unicorn);
    expect(new Set(s.map((x) => x.patch.boxPrint)).size).toBe(3);
    expect(new Set(s.map((x) => x.patch.font)).size).toBe(3);
  });
});

describe("ready-made cakes, cupcakes and where it is shown", () => {
  const seed = { themeId: "unicorn", themeName: "Unicorn", name: "Arya", age: "5", colours: unicorn.balloonColors };
  it("are three cakes, each a theme design of its own", () => {
    const designs = cakeDesigns(seed).map((d) => d.id);
    const s = cakeSamples(seed);
    expect(s).toHaveLength(3);
    for (const x of s) expect(designs).toContain(x.design.id);
    expect(new Set(s.map((x) => x.design.id)).size).toBe(3);
    expect(s[0].design.id).toBe("face");
  });
  it("are three dozen-cupcake sets, each told apart once applied", () => {
    const c = cupcakeSamples(seed, ["unicorn"]);
    expect(c.map((x) => x.sweet.count)).toEqual([12, 12, 12]);
    for (const x of c) expect(appliedSweetSample({ ...x.sweet, count: 24 }, c)).toBe(x.id);
    expect(appliedSweetSample({ ...c[0].sweet, liner: "silver" }, c)).toBeUndefined();
  });
  it("are three dozen-cookie sets, each another print", () => {
    const c = cookieSamples(seed, ["unicorn"]);
    expect(c.map((x) => x.sweet.id)).toEqual(["cookies", "cookies", "cookies"]);
    expect(new Set(c.map((x) => x.sweet.print)).size).toBe(3);
    for (const x of c) expect(appliedSweetSample(x.sweet, c)).toBe(x.id);
  });
  it("moves the cake to the table, a cart or plinths, a cart keeping its roof", () => {
    expect(sceneOf({})).toBe("table");
    expect(toScene({}, "cart")).toEqual({ cart: { roof: "#FFFFFF" }, plinths: undefined });
    expect(toScene({ cart: { roof: "#F8BBD0" } }, "cart").cart).toEqual({ roof: "#F8BBD0" });
    expect(sceneOf(toScene({ cart: { roof: "#F8BBD0" } }, "plinths"))).toBe("plinths");
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
