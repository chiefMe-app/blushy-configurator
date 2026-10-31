// The grown-ups' table and the welcome board (2026-10-31): their prices, the
// party total, the device copy, reading stored values back safely, and saving
// them as designs of their own.
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { THEMES, defaultConfig, priceBreakdown, themeById, type BuilderConfig } from "@/lib/config";
import { fromDraft, toDraft } from "@/lib/draft";
import { NONE } from "@/lib/studio/tableCatalog";
import { defaultTableSetup, readTableSetup } from "@/lib/studio/tableSetup";
import { ADULT_ITEMS, ADULT_SECTIONS, adultCounts, adultPriceLines, adultTotal, defaultAdultTable, readAdultTable } from "@/lib/studio/adultTable";
import { boardArt, boardFace, cleanBoardText, defaultWelcomeBoard, readWelcomeBoard, welcomePriceLines, welcomeTotal } from "@/lib/studio/welcomeBoard";
import { paintInks, stackWords } from "@/components/studio/WelcomeBoardArt";
import { balloonColourName, welcomePrompt, welcomeRenderKey } from "@/lib/studio/welcomeRender";
import { designCards, joinParty, readStoredTable, splitDesign, TABLE_ITEM, WELCOME_ITEM, type SavedItem } from "@/lib/savedDesigns";

const frozen = themeById("frozen")!;
const base = (): BuilderConfig => ({ ...defaultConfig(), theme: "frozen", themeSelected: true });

describe("the grown-ups' table", () => {
  it("every item is on the page, in a section; the adult pieces the kids' table left out are here", () => {
    expect(ADULT_SECTIONS.flatMap((s) => s.items).sort()).toEqual(ADULT_ITEMS.map((i) => i.key).sort());
    expect(ADULT_ITEMS.map((i) => i.key)).toEqual(expect.arrayContaining(["chargers", "runner", "nameCards", "chairDecor"]));
  });
  it("prices per table and per guest; ten guests at one long table", () => {
    const a = defaultAdultTable(frozen);
    expect(adultCounts(a)).toEqual({ guests: 10, tables: 1, perTable: 10 });
    const lines = adultPriceLines(a);
    expect(lines.find((l) => l.label.startsWith("Long table"))).toEqual({ label: "Long table (1)", amount: 150 });
    expect(lines.find((l) => l.label.startsWith("Gold chiavari"))).toEqual({ label: "Gold chiavari (10)", amount: 200 });
    // Eleven guests take a second table.
    expect(adultCounts({ ...a, guests: 11 }).tables).toBe(2);
    // None adds nothing; a skipped table, nothing at all.
    expect(adultTotal({ ...a, choices: { ...a.choices, chargers: NONE } })).toBe(adultTotal(a) - 120);
    expect(adultPriceLines({ ...a, enabled: false })).toEqual([]);
  });
  it("is in the party total, in its own section", () => {
    const c = { ...base(), adultTable: defaultAdultTable(frozen) };
    const { lines, total } = priceBreakdown(c);
    expect(lines.filter((l) => l.section === "adults").reduce((s, l) => s + l.amount, 0)).toBe(adultTotal(c.adultTable));
    expect(total).toBe(priceBreakdown(base()).total + adultTotal(c.adultTable));
  });
  it("reads back safely: unknown choices, colours and counts fall back", () => {
    const a = readAdultTable({ guests: 999, choices: { chargers: "diamond", runner: NONE, table: NONE }, clothColor: "red", done: true }, frozen)!;
    expect(a.guests).toBe(60);
    expect(a.choices.chargers).toBe("gold");
    expect(a.choices.runner).toBe(NONE);
    expect(a.choices.table).toBe("banquet"); // the table is not optional
    expect(a.clothColor).toBe("#FFFFFF");
    expect(a.done).toBe(true);
    expect(readAdultTable(null, frozen)).toBeUndefined();
  });
});

describe("the welcome board", () => {
  it("prices the size, an acrylic board and the easel", () => {
    const b = defaultWelcomeBoard(frozen);
    expect(welcomePriceLines(b)).toEqual([{ label: "Welcome board, Medium 70 × 100 cm", amount: 250 }, { label: "Easel", amount: 40 }]);
    expect(welcomeTotal({ ...b, size: "large", material: "acrylic", stand: "none" })).toBe(320 + 150);
    expect(welcomePriceLines({ ...b, enabled: false })).toEqual([]);
    expect(priceBreakdown({ ...base(), welcomeBoard: b }).total).toBe(priceBreakdown(base()).total + 290);
  });
  it("balloons or flowers on the board add their price; a round board is as tall as it is wide", () => {
    const b = defaultWelcomeBoard(frozen);
    expect(b.garnish).toBe("none");
    expect(welcomePriceLines({ ...b, garnish: "both" })).toContainEqual({ label: "Balloons & flowers on the board", amount: 380 });
    expect(welcomeTotal({ ...b, garnish: "balloons" })).toBe(welcomeTotal(b) + 250);
    expect(welcomeTotal({ ...b, garnish: "flowers" })).toBe(welcomeTotal(b) + 180);
    expect(boardFace({ size: "medium", shape: "round" })).toEqual({ w: 70, h: 70, note: "Ø 70 cm" });
    expect(welcomePriceLines({ ...b, shape: "round" })[0]).toEqual({ label: "Welcome board, round Ø 70 cm", amount: 250 });
    expect(readWelcomeBoard({ shape: "round", garnish: "both" }, frozen)).toMatchObject({ shape: "round", garnish: "both" });
    expect(readWelcomeBoard({ garnish: "fireworks" }, frozen)!.garnish).toBe("none");
  });
  it("the words never run into each other: stacked with a gap, a line too wide made smaller (2026-10-31)", () => {
    const space = { y0: 20, y1: 90, maxW: 56 };
    const ms = [{ w: 40, asc: 4, desc: 0.5 }, { w: 120, asc: 16, desc: 9 }, { w: 50, asc: 4, desc: 0.4 }];
    const { size, base } = stackWords(ms, [5, 14, 4.9], space, 2.4);
    // The name, twice too wide, is made half the size.
    expect(size[1]).toBeCloseTo(14 * (56 / 120));
    const k = size[1] / 14;
    expect(base[0] + ms[0].desc).toBeLessThan(base[1] - ms[1].asc * k);
    expect(base[1] + ms[1].desc * k).toBeLessThan(base[2] - ms[2].asc);
    expect(base[0] - ms[0].asc).toBeGreaterThanOrEqual(space.y0);
    // Too tall for the space: all of it smaller, still apart.
    const tall = stackWords([{ w: 10, asc: 40, desc: 20 }, { w: 10, asc: 40, desc: 20 }, null], [10, 10, 10], space, 2);
    expect(tall.base[1] - 40 * (tall.size[1] / 10)).toBeGreaterThan(tall.base[0] + 20 * (tall.size[0] / 10));
    expect(tall.base[1] + 20 * (tall.size[1] / 10)).toBeLessThanOrEqual(space.y1 + 0.001);
  });
  it("painted corners in the theme's own hues, never grey", () => {
    const inks = paintInks([frozen.accent, ...frozen.balloonColors]);
    expect(inks).toHaveLength(3);
    expect(new Set(inks).size).toBe(3);
    expect(paintInks(["#FFFFFF", "#C7C9C7"])).toHaveLength(3);
  });
  it("uses the theme's own art, or none for a plain board or painted corners", () => {
    expect(boardArt({ design: "watercolour" }, "frozen")).toBe("/design/table/placemats/frozen/watercolour.webp");
    expect(boardArt({ design: "plain" }, "frozen")).toBeNull();
    expect(boardArt({ design: "corners" }, "frozen")).toBeNull();
    // Every theme has both pictures.
    for (const t of THEMES) for (const design of ["watercolour", "sparkle"] as const) expect(existsSync(`public${boardArt({ design }, t.id)}`), `${t.id} ${design}`).toBe(true);
  });
  it("keeps the words clean and short, and reads back safely", () => {
    expect(cleanBoardText("<b>Arya's</b>   party")).toBe("bArya'sb party");
    expect(cleanBoardText("x".repeat(80))).toHaveLength(30);
    const b = readWelcomeBoard({ size: "huge", shape: "star", design: "plain", colour: "#123456", name: "Arya's", font: "comic", textColor: "blue" }, frozen)!;
    expect(b).toMatchObject({ size: "medium", shape: "arch", design: "plain", colour: "#123456", name: "Arya's", font: "birthstone-bounce", garnish: "none" });
    expect(b.textColor).toBeUndefined();
  });
});

describe("the welcome board's photo", () => {
  const b = { ...defaultWelcomeBoard(frozen), name: "Arya's", line: "6th birthday", garnish: "both" as const, shape: "arch" as const };
  it("names balloon colours as they look, so the photo cannot take others", () => {
    expect(["#FFFFFF", "#BFDFF7", "#C9B6E4", "#C0C0C0", "#F4B6C9", "#D4AF37"].map(balloonColourName))
      .toEqual(["white", "pastel blue", "pastel lilac", "silver", "pastel pink", "gold"]);
  });
  it("asks for the exact words, the garland in only the party's colours, the roses, and keeps the arch's top", () => {
    const p = welcomePrompt(b, ["#FFFFFF", "#BFDFF7"]);
    expect(p).toMatch(/"WELCOME TO", then "Arya.s", then "6TH BIRTHDAY"/);
    expect(p).toContain("ONLY in white, pastel blue");
    expect(p).toContain("no pink unless pink is listed");
    expect(p).toContain("silk roses");
    expect(p).toContain("arch top stays fully visible");
    expect(p).not.toMatch(/image 2/i);
    const plain = welcomePrompt({ ...b, garnish: "none", shape: "round" }, ["#FFFFFF"]);
    expect(plain).toContain("No balloons.");
    expect(plain).toContain("No flowers.");
    expect(plain).not.toContain("arch top");
  });
  it("is current until something in the picture changes", () => {
    const k = welcomeRenderKey(b, "frozen", ["#FFFFFF"]);
    expect(welcomeRenderKey({ ...b, render: { key: "x", path: "u/x.jpg" }, done: true }, "frozen", ["#FFFFFF"])).toBe(k);
    expect(welcomeRenderKey({ ...b, name: "Zara's" }, "frozen", ["#FFFFFF"])).not.toBe(k);
    expect(welcomeRenderKey(b, "frozen", ["#C0C0C0"])).not.toBe(k);
    // Without a garland the balloon colours are not in the picture.
    const flowers = { ...b, garnish: "flowers" as const };
    expect(welcomeRenderKey(flowers, "frozen", ["#FFFFFF"])).toBe(welcomeRenderKey(flowers, "frozen", ["#C0C0C0"]));
  });
  it("a kept photo is read back only when it looks like one of ours", () => {
    const ok = { key: "abc123", path: "0f5e-11aa/abc123.jpg" };
    expect(readWelcomeBoard({ ...b, render: ok }, frozen)?.render).toEqual(ok);
    for (const render of [{ key: "abc", path: "../etc/passwd" }, { key: "ABC!", path: "u/a.jpg" }, { key: "abc", path: "https://x.y/a.jpg" }, "abc"]) {
      expect(readWelcomeBoard({ ...b, render }, frozen)?.render).toBeUndefined();
    }
  });
});

describe("on the device and in My designs", () => {
  const full = (): BuilderConfig => ({
    ...base(), decor: { ...base().decor, backdropChoice: "yes" },
    table: { ...defaultTableSetup(frozen), done: true }, adultTable: defaultAdultTable(frozen), welcomeBoard: { ...defaultWelcomeBoard(frozen), name: "Arya's" },
  });
  it("the device copy keeps both tables, the board and the Finish marks", () => {
    const back = fromDraft(JSON.stringify(toDraft(full(), 2, 0)))!.config;
    expect(back.table?.done).toBe(true);
    expect(back.adultTable?.guests).toBe(10);
    expect(back.welcomeBoard?.name).toBe("Arya's");
    expect(readTableSetup({ done: "yes" }, frozen)?.done).toBeUndefined();
  });
  it("saves three designs: the backdrop, the table setup (both tables) and the welcome board", () => {
    const { backdrop, table, welcome } = splitDesign(full(), 2, 0);
    expect(backdrop!.config.config).not.toHaveProperty("welcomeBoard");
    expect(table!.config).toMatchObject({ kind: "table", table: { kids: 10 }, adultTable: { guests: 10 } });
    expect(welcome!.config).toMatchObject({ kind: "welcome", welcomeBoard: { name: "Arya's" } });
    const items: SavedItem[] = [
      { id: "b", party_id: "p", ref_id: "studio.backdrop", updated_at: "2026-10-31T10:00:00Z", ...backdrop! },
      { id: "t", party_id: "p", ref_id: TABLE_ITEM, updated_at: "2026-10-31T10:00:00Z", ...table! },
      { id: "w", party_id: "p", ref_id: WELCOME_ITEM, updated_at: "2026-10-31T10:00:00Z", ...welcome! },
    ];
    expect(designCards(items).map((c) => c.kind)).toEqual(["backdrop", "table", "welcome"]);
    const joined = joinParty(items, "p")!;
    expect(joined).toMatchObject({ itemId: "b", tableItemId: "t", welcomeItemId: "w" });
    expect(joined.draft.config).toMatchObject({ table: { kids: 10 }, adultTable: { guests: 10 }, welcomeBoard: { name: "Arya's" } });
  });
  it("a grown-ups' table alone is a table setup; a board alone, a welcome design", () => {
    const onlyAdults = { ...base(), decor: { ...base().decor, backdropChoice: "skip" as const }, table: { ...defaultTableSetup(frozen), enabled: false }, adultTable: defaultAdultTable(frozen) };
    const split = splitDesign(onlyAdults, 2, 0);
    expect(split.backdrop).toBeNull();
    expect(readStoredTable(split.table!.config)?.adultTable?.enabled).toBe(true);
    expect(split.table!.price_snapshot.total).toBe(adultTotal(onlyAdults.adultTable));
    const onlyBoard = splitDesign({ ...base(), decor: { ...base().decor, backdropChoice: "skip" }, welcomeBoard: defaultWelcomeBoard(frozen) }, 2, 0);
    expect(onlyBoard.backdrop).toBeNull();
    expect(onlyBoard.table).toBeNull();
    expect(onlyBoard.welcome).not.toBeNull();
  });
});
