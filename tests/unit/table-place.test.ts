// The builder's top view of one place (2026-10-29): what goes where, from the
// pieces photographed once (lib/studio/tablePlace.ts).
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { themeById } from "@/lib/config";
import { defaultTableSetup, readTableSetup } from "@/lib/studio/tableSetup";
import { placeLayout, placePictures, type PlaceNode } from "@/lib/studio/tablePlace";

const frozen = themeById("frozen")!;
const table = (choices: Record<string, string> = {}, extra: Record<string, unknown> = {}) =>
  readTableSetup({ ...defaultTableSetup(frozen), choices: { ...defaultTableSetup(frozen).choices, ...choices }, ...extra }, frozen)!;
const focus = (nodes: PlaceNode[]) => (nodes.find((n) => n.k === "group" && n.focus) as Extract<PlaceNode, { k: "group" }>).nodes;
const part = (nodes: PlaceNode[], end: string) => nodes.find((n) => "id" in n && n.id.endsWith(end));

describe("the top view of one place", () => {
  it("the chairs, the table top over them, the places with the middle one last, the centrepieces", () => {
    const nodes = placeLayout(table(), frozen);
    const kinds = nodes.map((n) => (n.k === "group" ? (n.id.startsWith("seat") ? "seat" : "place") : n.k));
    expect(kinds.indexOf("top")).toBeGreaterThan(kinds.lastIndexOf("seat"));
    expect(kinds.indexOf("place")).toBeGreaterThan(kinds.indexOf("top"));
    const places = nodes.filter((n): n is Extract<PlaceNode, { k: "group" }> => n.k === "group" && n.id.startsWith("place"));
    expect(places.length).toBeGreaterThanOrEqual(3); // the next places carry on at the sides
    expect(places[places.length - 1].focus).toBe(true);
    const mid = places[places.length - 1];
    expect([mid.x, mid.y, mid.rot].map((v) => Math.abs(v))).toEqual([0, 0, 0]); // the middle place, square in the picture
  });
  it("the plain cup white inside, its outside in the colour; plain plates in their colour and shape; no card", () => {
    const f = focus(placeLayout(table({ cups: "plain", plates: "plain" }, { cupColor: "#EC407A", plateColor: "#F8BBD0", plateShape: "scalloped" }), frozen));
    expect(part(f, "cup-in")).toMatchObject({ src: "/design/table/top/cup-plain-in.webp" });
    expect((part(f, "cup-in") as { tint?: string }).tint).toBeUndefined();
    expect(part(f, "cup-out")).toMatchObject({ src: "/design/table/top/cup-plain-out.webp", tint: "#EC407A" });
    expect(part(f, "plates")).toMatchObject({ src: "/design/table/top/plates-plain-scalloped.webp", tint: "#F8BBD0" });
    expect(f.some((n) => "id" in n && /card/.test(n.id))).toBe(false);
    // Foil plates keep their own colours.
    const silver = focus(placeLayout(table({ plates: "silver" }), frozen));
    expect(part(silver, "plates")).toMatchObject({ src: "/design/table/top/plates-silver.webp" });
    expect((part(silver, "plates") as { tint?: string }).tint).toBeUndefined();
  });
  it("the words on the placemat and the label, the name on its tag", () => {
    const f = focus(placeLayout(table({ cutleryHolder: "band", bottleLabel: "plain" }, { labelColor: "#BBF7D0", words: { placemats: "Arya turns 6", cutleryHolder: "Arya", bottleLabel: "Arya turns 6" } }), frozen));
    expect(part(f, "matwords")).toMatchObject({ lines: ["ARYA", "TURNS", "6"], font: "playfair-display", colour: frozen.accent });
    expect(part(f, "name")).toMatchObject({ lines: ["Arya"], face: "script" });
    expect(part(f, "bottle")).toMatchObject({ fill: "#BBF7D0", words: "ARYA TURNS 6", font: "playfair-display" });
    // A handwritten lettering: as typed, in its face (2026-10-29).
    const hand = focus(placeLayout(table({ bottleLabel: "plain" }, { placematFont: "birthstone-bounce", labelFont: "italianno", words: { placemats: "Arya turns 6", bottleLabel: "Arya turns 6" } }), frozen));
    expect(part(hand, "matwords")).toMatchObject({ lines: ["Arya", "turns", "6"], font: "birthstone-bounce" });
    expect(part(hand, "bottle")).toMatchObject({ words: "Arya turns 6", font: "italianno" });
    // No words: no lettering, no tag.
    const bare = focus(placeLayout(table({ cutleryHolder: "band" }), frozen));
    expect(part(bare, "matwords")).toBeUndefined();
    expect(part(bare, "tag")).toBeUndefined();
    expect(part(bare, "band")).toMatchObject({ k: "band" });
  });
  it("the napkin always under the cutlery, the band round both (2026-10-29)", () => {
    const ids = focus(placeLayout(table({ cutleryHolder: "band" }, { words: { cutleryHolder: "Arya" } }), frozen)).map((n) => ("id" in n ? n.id.replace(/^place-\d+-/, "") : ""));
    expect(ids.indexOf("napkin")).toBeLessThan(ids.indexOf("cutlery-0"));
    expect(ids.indexOf("cutlery-2")).toBeLessThan(ids.indexOf("band"));
    // The name on the band itself, no tag (2026-10-29).
    expect(ids.indexOf("band")).toBeLessThan(ids.indexOf("name"));
    expect(ids).not.toContain("tag");
  });
  it("the small plain plate in its own colour, over the big one; the theme cutouts in Frozen", () => {
    const f = focus(placeLayout(table({ plates: "plain" }, { plateColor: "#F8BBD0", smallPlateColor: "#BAE6FD" }), frozen));
    expect(part(f, "-plates")).toMatchObject({ tint: "#F8BBD0", w: 23 });
    expect(part(f, "small-plate")).toMatchObject({ tint: "#BAE6FD" });
    expect(part(focus(placeLayout(table({ plates: "silver" }), frozen)), "small-plate")).toBeUndefined();
    const all = placeLayout(table({ centrepiece: "cutouts" }), frozen);
    expect(all.some((n) => n.k === "img" && n.src.endsWith("centrepiece-cutouts-frozen.webp"))).toBe(true);
  });
  it("the lettering read back: one of the offered faces, or the classic one", () => {
    expect(table({}, { placematFont: "sacramento", labelFont: "fraunces" })).toMatchObject({ placematFont: "sacramento", labelFont: "fraunces" });
    expect(table({}, { placematFont: "comic-sans", labelFont: 3 })).toMatchObject({ placematFont: "playfair-display", labelFont: "playfair-display" });
  });
  it("a plain placemat is its colour; a printed napkin wears the theme's pattern", () => {
    const f = focus(placeLayout(table({ placemats: "plain", napkins: "printed" }, { placematColor: "#FFD1A4" }), frozen));
    expect(part(f, "mat")).toMatchObject({ fill: "#FFD1A4" });
    expect(part(f, "napkin")).toMatchObject({ print: "/design/table/placemats/frozen/pattern.webp" });
  });
  it("the colour chair in its colour; the low table's cushions instead of chairs", () => {
    const seat = (nodes: PlaceNode[]) => (nodes.find((n) => n.k === "group" && n.id.startsWith("seat")) as Extract<PlaceNode, { k: "group" }>).nodes[0];
    expect(seat(placeLayout(table({ chairs: "blue_kids" }, { chairColor: "#F8BBD0" }), frozen))).toMatchObject({ src: "/design/table/top/chair-blue_kids.webp", tint: "#F8BBD0" });
    expect(seat(placeLayout(table({ table: "low" }), frozen))).toMatchObject({ src: "/design/table/top/cushion.webp" });
  });
  it("every picture it can ask for is there", () => {
    const all = new Set<string>();
    for (const plates of ["plain", "iridescent", "silver"]) for (const shape of ["round", "scalloped", "square"]) for (const cups of ["plain", "iridescent"])
      for (const cutlery of ["wooden", "dipped", "glitter"]) for (const centrepiece of ["balloons", "florals", "toppers", "cutouts"]) for (const chairs of ["white_kids", "blue_kids", "bow_kids"])
        placePictures(placeLayout(table({ plates, cups, cutlery, centrepiece, chairs, napkins: "printed", bottleLabel: "watercolour", cutleryHolder: "band" }, { plateShape: shape, words: { cutleryHolder: "A" } }), frozen)).forEach((p) => all.add(p));
    placePictures(placeLayout(table({ table: "low" }), frozen)).forEach((p) => all.add(p));
    for (const p of Array.from(all)) expect(fs.existsSync(path.join(process.cwd(), "public", p)), p).toBe(true);
  });
});
