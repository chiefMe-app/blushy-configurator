// The kids' table's plain colours and words colour (2026-10-28): plain plates
// (a big and a small one; the round card in it went on 2026-10-29) and plain cups in any colour, one napkin band in a colour with
// or without a name, the kids' chair in every plain colour, the printed words
// in the theme's colour unless the customer picks one — and the production
// list that comes out of it.
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import sharp from "sharp";
import { themeById } from "@/lib/config";
import { CHAIR_COLOURS, NONE, PLAIN_COLOURS, optionPhoto, tableItem, tableOption } from "@/lib/studio/tableCatalog";
import { DEFAULT_CHAIR_COLOR, defaultTableSetup, itemColour, readTableSetup, wordsColour } from "@/lib/studio/tableSetup";
import { colourWords, referencePictures, tablePrompt, tableRenderKey } from "@/lib/studio/tableRender";
import { tableCloseGuideSvg } from "@/lib/studio/tableCloseGuide";
import { productionLine, tableProductionList } from "@/lib/studio/tableProduction";
import { buildDesignPack } from "@/lib/pack/designPack";
import { buildPackSpec } from "@/lib/pack/spec";
import { fixtureById } from "../fixtures/configs";

const frozen = themeById("frozen")!, unicorn = themeById("unicorn")!;
const table = (over: Partial<ReturnType<typeof defaultTableSetup>["choices"]> = {}, extra: Record<string, unknown> = {}) =>
  ({ ...defaultTableSetup(frozen), choices: { ...defaultTableSetup(frozen).choices, ...over }, ...extra });

describe("the options", () => {
  it("plain plates and plain cups take a colour; the holder is one napkin band in a colour", () => {
    expect(tableOption("plates", "plain")).toMatchObject({ coloured: true });
    expect(tableOption("cups", "plain")).toMatchObject({ coloured: true });
    expect(tableItem("cutleryHolder").options.map((o) => o.id)).toEqual(["band"]);
    expect(tableOption("cutleryHolder", "band")).toMatchObject({ coloured: true });
    expect(tableOption("cups", "pastel")).toBeUndefined();
  });
  it("pastels and main colours, each with a name", () => {
    expect(PLAIN_COLOURS.length).toBeGreaterThanOrEqual(16);
    for (const c of PLAIN_COLOURS) { expect(c.hex).toMatch(/^#[0-9A-F]{6}$/); expect(c.name).toBeTruthy(); }
    expect(new Set(PLAIN_COLOURS.map((c) => c.hex)).size).toBe(PLAIN_COLOURS.length);
  });
  it("the kids' chair has a cut-out picture in white, pink and light blue (2026-10-29)", async () => {
    const chair = tableOption("chairs", "blue_kids")!;
    expect(chair).toMatchObject({ coloured: true, colouredPhotos: true });
    expect(CHAIR_COLOURS).toEqual(["#FFFFFF", "#F8BBD0", "#38BDF8"]);
    expect(fs.readdirSync(path.join(process.cwd(), "public/design/table/chairs/blue_kids")).sort()).toEqual(["38bdf8.webp", "f8bbd0.webp", "ffffff.webp"]);
    for (const hex of CHAIR_COLOURS) {
      const photo = optionPhoto("chairs", chair, "frozen", hex)!;
      expect(photo).toBe(`/design/table/chairs/blue_kids/${hex.slice(1).toLowerCase()}.webp`);
      const meta = await sharp(path.join(process.cwd(), "public", photo)).metadata();
      expect(meta.hasAlpha).toBe(true); // the background is gone
    }
    // A colour that is not a plain one keeps the owner's photo.
    expect(optionPhoto("chairs", chair, "frozen", "#123456")).toBe(chair.photo);
  });
});

describe("the colours on the table", () => {
  it("a new table: the owner's blue chair, the theme's colours, the theme's words colour", () => {
    const t = defaultTableSetup(unicorn);
    expect(t.chairColor).toBe(DEFAULT_CHAIR_COLOR);
    expect(wordsColour(t, unicorn)).toBe(unicorn.accent);
    // Until one is picked, the words follow the theme.
    expect(wordsColour(defaultTableSetup(frozen), unicorn)).toBe(unicorn.accent);
    expect(wordsColour({ textColor: "#1F2937" }, unicorn)).toBe("#1F2937");
    expect([t.cupColor, t.holderColor, t.hatColor].every((c) => /^#[0-9A-F]{6}$/i.test(c))).toBe(true);
    // Pastels of the theme's colours, the big plate and the small one (2026-10-30).
    expect([t.plateColor, t.smallPlateColor]).toEqual(["#F8BBD0", "#DDD6FE"]);
    expect([defaultTableSetup(frozen).plateColor, defaultTableSetup(frozen).smallPlateColor]).toEqual(["#BAE6FD", "#DDD6FE"]);
    // A white napkin, and the napkin band in the theme's colour.
    expect(t).toMatchObject({ napkinColor: "#FFFFFF", chairColor: "#FFFFFF", holderColor: unicorn.balloonColors[1] });
    expect(t.choices).toMatchObject({ table: "standard", chairs: "blue_kids", tablecloth: NONE, napkins: "plain", cutlery: "wooden", cutleryHolder: "band" });
  });
  it("they read back; a table saved before them gets them; a chair colour must be one of its own", () => {
    const back = readTableSetup({ ...table(), plateColor: "#E53935", cupColor: "#1E88E5", holderColor: "#43A047", chairColor: "#F8BBD0", textColor: "#1F2937" }, frozen)!;
    expect(back).toMatchObject({ plateColor: "#E53935", cupColor: "#1E88E5", holderColor: "#43A047", chairColor: "#F8BBD0", textColor: "#1F2937" });
    const old = readTableSetup({ enabled: true, kids: 10, choices: { cutleryHolder: "pocket", cups: "pastel" } }, frozen)!;
    expect(old.textColor).toBeUndefined();
    expect(old.choices.cutleryHolder).toBe("band"); // the pocket is gone: today's band
    expect(old.choices.cups).toBe(defaultTableSetup(frozen).choices.cups);
    expect(readTableSetup({ ...table(), chairColor: "#123456" }, frozen)!.chairColor).toBe(DEFAULT_CHAIR_COLOR);
    // Hot pink was a chair colour on 2026-10-28 only.
    expect(readTableSetup({ ...table(), chairColor: "#EC407A" }, frozen)!.chairColor).toBe(DEFAULT_CHAIR_COLOR);
    expect(readTableSetup({ ...table(), textColor: "red" }, frozen)!.textColor).toBeUndefined();
  });
  it("an item's colour only when its option takes one", () => {
    expect(itemColour(table({ plates: "plain" }, { plateColor: "#E53935" }), "plates")).toBe("#E53935");
    expect(itemColour(table({ plates: "silver" }, { plateColor: "#E53935" }), "plates")).toBeUndefined();
    expect(itemColour(table({ chairs: "blue_kids" }, { chairColor: "#F8BBD0" }), "chairs")).toBe("#F8BBD0");
    expect(itemColour(table({ chairs: "bow_kids" }), "chairs")).toBeUndefined();
  });
  it("every colour is part of the render's key, and so is the theme", () => {
    const t = table();
    expect(tableRenderKey(t, "unicorn")).not.toBe(tableRenderKey(t, "frozen"));
    for (const k of ["plateColor", "cupColor", "holderColor", "chairColor", "placematColor", "labelColor", "textColor"]) {
      expect(tableRenderKey({ ...t, [k]: "#010203" }, "frozen")).not.toBe(tableRenderKey(t, "frozen"));
    }
  });
});

describe("in the render", () => {
  const t = table({ chairs: "blue_kids", plates: "plain", cups: "plain", cutleryHolder: "band", placemats: "sparkle", bottleLabel: "sparkle" },
    { chairColor: "#F8BBD0", plateColor: "#BAE6FD", smallPlateColor: "#FFD1A4", cupColor: "#FEF08A", holderColor: "#DDD6FE", textColor: "#8E24AA", words: { placemats: "Arya turns 6", bottleLabel: "Arya" } });
  const refs = referencePictures(t, "frozen");
  const p = tablePrompt(t, frozen, refs.map((r) => r.key));
  it("the chair's picture is its colour's; plain plates and cups have no picture, their colour is in words", () => {
    expect(refs.find((r) => r.key === "chairs")!.photo).toBe("/design/table/chairs/blue_kids/f8bbd0.webp");
    expect(refs.map((r) => r.key)).not.toContain("plates");
    expect(refs.map((r) => r.key)).not.toContain("cups");
    expect(p).toContain("a pastel pink children's chair whose back is a curved top rail");
    expect(p).toContain("a plain matte pastel lemon yellow paper cup (no straw)");
  });
  it("a big plate with a small one in it, and nothing in the small one (2026-10-29: no card)", () => {
    expect(p).toContain(`two disposable paper plates, round: a big plain matte pastel baby blue plate with a smaller plain matte pastel peach plate of the same shape sitting in it, a plate in its own right with its own rim`);
    // A foil is a colour too (2026-10-29).
    expect(tablePrompt({ ...t, plateColor: "gold", cupColor: "iridescent" }, frozen, [])).toMatch(/a big shimmering gold foil plate with a smaller plain matte pastel peach plate[\s\S]*a shimmering iridescent foil paper cup/);
    expect(p).toContain("one big plate and one small plate on each placemat, both empty");
    expect(p).not.toMatch(/printed paper card|plate card/i);
    // The same colour for both: said once.
    expect(tablePrompt({ ...t, smallPlateColor: "#BAE6FD" }, frozen, [])).toContain("a big plate with a smaller plate of the same kind sitting in it, both plain matte pastel baby blue");
  });
  it("the band in its colour, with no tag without a name", () => {
    expect(p).toContain("a plain pastel lilac paper napkin band, with no tag and no words");
    expect(p).toContain("the band is pastel lilac, whatever colour its photo shows");
  });
  it("the words in their colour", () => {
    expect(p).toContain(`in small ${colourWords("#8E24AA")} letters set in an elegant classic serif, all capitals`);
    expect(p).toContain('with "ARYA" printed on the label in purple letters set in an elegant classic serif, all capitals');
  });
  it("the drawing: the chair, the plates and the words in their colours", () => {
    const svg = tableCloseGuideSvg(t, frozen, { placemat: "data:image/jpeg;base64,AAAA" });
    expect(svg).toContain('fill="#F8BBD0"'); // the chairs
    expect(svg).toContain('fill="#BAE6FD"'); // the plates
    expect(svg).toContain('fill="#FEF08A"'); // the cups
    expect(svg).toContain('fill="#DDD6FE"'); // the bands
    expect(svg).toContain('fill="#8E24AA"'); // the words
    expect(svg).not.toMatch(/card/);
  });
});

describe("the production list", () => {
  const t = table({ chairs: "blue_kids", plates: "plain", cups: "plain", cutleryHolder: "band", placemats: "watercolour", bottleLabel: "watercolour" },
    { kids: 12, chairColor: "#F8BBD0", plateColor: "#BAE6FD", smallPlateColor: "#F8BBD0", textColor: "#8E24AA", words: { placemats: "Arya turns 6", cutleryHolder: "Arya", bottleLabel: "Arya" } });
  const rows = tableProductionList(t, unicorn);
  const row = (item: string) => rows.find((r) => r.item === item)!;
  it("a big and a small plate for every child, and no plate card", () => {
    expect(row("Big plates")).toMatchObject({ quantity: 12, colour: "#BAE6FD" });
    // The small one in its own colour (2026-10-29).
    expect(row("Small plates")).toMatchObject({ quantity: 12, colour: "#F8BBD0" });
    expect(row("Small plates").detail).toContain("pastel pink");
    expect(rows.some((r) => /card/i.test(r.item))).toBe(false);
  });
  it("the printed pieces with their words and words colour; the chair in its colour", () => {
    expect(row("Placemats").print).toMatchObject({ widthMm: 420, heightMm: 297, words: "ARYA TURNS 6", wordsColour: "#8E24AA", wordsFont: "Classic (Playfair Display)" });
    expect(row("Water bottle label").print).toMatchObject({ widthMm: 205, heightMm: 50, words: "ARYA", wordsColour: "#8E24AA" });
    expect(row("Water bottles").quantity).toBe(12);
    // The name printed on the band itself: no tags (2026-10-29).
    expect(row("Cutlery holder")).toMatchObject({ print: { words: "Arya" } });
    expect(row("Cutlery holder").detail).toContain("the name printed on it");
    expect(rows.some((r) => r.item === "Name tags")).toBe(false);
    expect(row("Chairs")).toMatchObject({ quantity: 12, colour: "#F8BBD0" });
    expect(row("Chairs").detail).toContain("pastel pink");
    expect(productionLine(row("Placemats"))).toContain("print 420 × 297 mm");
    expect(row("Table").quantity).toBe(2); // 12 kids at 10-seat tables
  });
  it("no name, no tags; the low table has no chairs; no table, no list", () => {
    expect(tableProductionList({ ...t, words: {} }, unicorn).find((r) => r.item === "Cutlery holder")?.print).toBeUndefined();
    expect(tableProductionList({ ...t, choices: { ...t.choices, table: "low" } }, unicorn).some((r) => r.item === "Chairs")).toBe(false);
    expect(tableProductionList({ ...t, enabled: false }, unicorn)).toEqual([]);
  });
  it("in the Design Pack: the list and kids_table.csv, no print folder", async () => {
    const config = { ...fixtureById("N01-soft-signature-round").config, theme: "unicorn" as const, table: t };
    expect(buildPackSpec(config).kidsTable.length).toBeGreaterThan(5);
    const pack = await buildDesignPack({ config, packId: "KT1" });
    expect(pack.files.some((f) => f.startsWith("5_PRINT_FILES"))).toBe(false);
    const entries = unzipSync(pack.zip);
    const csv = strFromU8(entries["PartyMuse_DesignPack_KT1/4_LISTS/kids_table.csv"]);
    expect(csv).toContain("Big plates,");
    expect(csv).toContain("420 x 297");
    // A design without a table: none of it.
    expect((await buildDesignPack({ config: fixtureById("N01-soft-signature-round").config, packId: "KT2" })).files.some((f) => f.includes("kids_table"))).toBe(false);
  }, 60_000);
});


describe("the trimmed options (2026-10-29)", () => {
  const ids = (k: Parameters<typeof tableItem>[0]) => tableItem(k).options.map((o) => o.id);
  it("only what the owner kept", () => {
    // 2026-10-30: the printed napkin went; plain, then the theme's own.
    expect(ids("napkins")[0]).toBe("plain");
    expect(ids("napkins")).not.toContain("printed");
    expect(tableItem("napkins").options.slice(1).every((o) => o.look && o.themes?.length === 1)).toBe(true);
    expect(ids("placemats")).toEqual(["plain", "watercolour", "sparkle"]);
    // 2026-10-29: one kind of plate and of cup, in a colour or a foil.
    expect(ids("plates")[0]).toBe("plain");
    expect(ids("cups")[0]).toBe("plain");
    expect(tableItem("cups").options.filter((o) => o.themes?.includes("football")).length).toBe(3);
    expect(ids("bottleLabel")).toEqual(["plain", "watercolour", "sparkle"]);
    expect(ids("partyHats")).toEqual(["cone"]);
    // A table saved with a removed option gets today's choice.
    const old = readTableSetup({ enabled: true, choices: { napkins: "striped", placemats: "pattern", plates: "holo_square", cups: "white_straw", bottleLabel: "pattern", partyHats: "crown" } }, frozen)!;
    expect(old.choices).toMatchObject({ napkins: "plain", placemats: "watercolour", plates: "plain", cups: "plain", bottleLabel: NONE, partyHats: "cone" });
  });
  it("the plain placemat and label in their colours, with the words", () => {
    const t = table({ placemats: "plain", bottleLabel: "plain" }, { placematColor: "#BBF7D0", labelColor: "#FFD1A4", words: { placemats: "Arya turns 6", bottleLabel: "Arya" } });
    expect(readTableSetup(t, frozen)).toMatchObject({ placematColor: "#BBF7D0", labelColor: "#FFD1A4" });
    const p = tablePrompt(t, frozen, []);
    expect(p).toContain("a plain matte pastel mint green A3 paper placemat");
    expect(p).toContain("The placemats are plain pastel mint green paper, with nothing printed on them but the words.");
    expect(p).toContain("a small clear water bottle wrapped in a plain matte pastel peach paper label with \"ARYA\" printed on the label");
    expect(p).not.toContain("(image 0)");
    const svg = tableCloseGuideSvg(t, frozen);
    expect(svg).toContain('fill="#BBF7D0"');
    expect(svg).toContain('fill="#FFD1A4"');
    const rows = tableProductionList(t, frozen);
    expect(rows.find((r) => r.item === "Placemats")).toMatchObject({ colour: "#BBF7D0", print: { widthMm: 420, words: "ARYA TURNS 6" } });
    expect(rows.find((r) => r.item === "Placemats")!.print!.art).toBeUndefined();
    expect(rows.find((r) => r.item === "Water bottle label")!.print!.art).toBeUndefined();
  });
  it("the plain plates in a shape: in the words, the drawing, the production list and the render's key", () => {
    const t = table({ plates: "plain" }, { plateShape: "scalloped" });
    expect(readTableSetup(t, frozen)!.plateShape).toBe("scalloped");
    expect(readTableSetup({ ...t, plateShape: "star" }, frozen)!.plateShape).toBe("round");
    expect(tablePrompt(t, frozen, [])).toContain("paper plates, round with a wavy scalloped edge");
    expect(tablePrompt({ ...t, plateShape: "square" }, frozen, [])).toContain("paper plates, square with softly rounded corners");
    expect(tableCloseGuideSvg(t, frozen)).not.toBe(tableCloseGuideSvg({ ...t, plateShape: "round" }, frozen));
    expect(tableRenderKey(t, "frozen")).not.toBe(tableRenderKey({ ...t, plateShape: "square" }, "frozen"));
    expect(tableProductionList(t, frozen).find((r) => r.item === "Big plates")!.detail).toContain("scalloped");
  });
});
