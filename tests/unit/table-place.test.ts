// The builder's top view of one place (2026-10-29): what goes where, from the
// pieces photographed once (lib/studio/tablePlace.ts).
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { themeById } from "@/lib/config";
import { defaultTableSetup, readTableSetup } from "@/lib/studio/tableSetup";
import { placeLayout, placePictures, placeView, type PlaceNode } from "@/lib/studio/tablePlace";

const frozen = themeById("frozen")!;
const table = (choices: Record<string, string> = {}, extra: Record<string, unknown> = {}) =>
  readTableSetup({ ...defaultTableSetup(frozen), choices: { ...defaultTableSetup(frozen).choices, ...choices }, ...extra }, frozen)!;
const focus = (nodes: PlaceNode[]) => (nodes.find((n) => n.k === "group" && n.focus) as Extract<PlaceNode, { k: "group" }>).nodes;
const part = (nodes: PlaceNode[], end: string) => nodes.find((n) => "id" in n && n.id.endsWith(end));

describe("the top view of one place", () => {
  it("only the table top (no chairs, no floor), the two places facing each other, the middle one last, the centrepieces", () => {
    const t = table();
    const nodes = placeLayout(t, frozen);
    expect(nodes.some((n) => n.k === "group" && n.id.startsWith("seat"))).toBe(false);
    expect(placePictures(nodes).some((p) => /chair|cushion|grass/.test(p))).toBe(false);
    const places = nodes.filter((n): n is Extract<PlaceNode, { k: "group" }> => n.k === "group" && n.id.startsWith("place"));
    expect(places[places.length - 1].focus).toBe(true);
    const mid = places[places.length - 1];
    expect([mid.x, mid.y, mid.rot].map((v) => Math.abs(v))).toEqual([0, 0, 0]); // the middle place, square in the picture
    // Across the table, turned round to face it, both in the picture (2026-10-29).
    const view = placeView(t);
    const across = places.find((p) => Math.abs(Math.abs(p.rot) - 180) < 1 && Math.abs(p.x) < 1)!;
    expect(across.y).toBeLessThan(-30);
    expect(view.y).toBeLessThan(across.y - 15);
    expect(view.y + view.h).toBeGreaterThan(15);
    expect(view.w / view.h).toBeCloseTo(4 / 3);
  });
  it("the plain cup white inside, its outside in the colour; plain plates in their colour and shape; no card", () => {
    const f = focus(placeLayout(table({ cups: "plain", plates: "plain" }, { cupColor: "#EC407A", plateColor: "#F8BBD0", plateShape: "scalloped" }), frozen));
    expect(part(f, "cup-in")).toMatchObject({ src: "/design/table/top/cup-plain-in.webp" });
    expect((part(f, "cup-in") as { tint?: string }).tint).toBeUndefined();
    expect(part(f, "cup-out")).toMatchObject({ src: "/design/table/top/cup-plain-out.webp", tint: "#EC407A" });
    // Lying on its side (2026-10-29: "cup daha yatay").
    expect(Math.abs((part(f, "cup-out") as { rot?: number }).rot ?? 0)).toBeGreaterThan(60);
    expect(part(f, "-plates")).toMatchObject({ src: "/design/table/top/plates-plain-scalloped.webp", tint: "#F8BBD0" });
    expect(f.some((n) => "id" in n && /card/.test(n.id))).toBe(false);
    // A foil is a colour: the plate's shape in the foil, no tint.
    const silver = focus(placeLayout(table({}, { plateColor: "silver", cupColor: "gold" }), frozen));
    expect(part(silver, "-plates")).toMatchObject({ src: "/design/table/top/plates-plain-round.webp", foil: "silver" });
    expect((part(silver, "-plates") as { tint?: string }).tint).toBeUndefined();
    expect(part(silver, "cup-out")).toMatchObject({ foil: "gold" });
  });
  it("the words on the placemat and the label, the name on its tag", () => {
    const f = focus(placeLayout(table({ cutleryHolder: "band", bottleLabel: "plain" }, { labelColor: "#BBF7D0", words: { placemats: "Arya turns 6", cutleryHolder: "Arya", bottleLabel: "Arya turns 6" } }), frozen));
    expect(part(f, "matwords")).toMatchObject({ lines: ["ARYA", "TURNS", "6"], font: "playfair-display", colour: frozen.accent });
    expect(part(f, "name")).toMatchObject({ lines: ["Arya"], face: "script", colour: frozen.accent });
    // The name in its own colour (2026-10-29).
    expect(part(focus(placeLayout(table({ cutleryHolder: "band" }, { nameColor: "#FFFFFF", words: { cutleryHolder: "Arya" } }), frozen)), "name")).toMatchObject({ colour: "#FFFFFF" });
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
    expect(part(focus(placeLayout(table({}, { smallPlateColor: "iridescent" }), frozen)), "small-plate")).toMatchObject({ foil: "iridescent" });
    // The hat in its colour.
    expect(part(focus(placeLayout(table({ partyHats: "cone" }, { hatColor: "#F8BBD0" }), frozen)), "hat")).toMatchObject({ tint: "#F8BBD0" });
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
  it("round a round table, the two places side by side, both in the picture", () => {
    const t = table({ table: "round" });
    const places = placeLayout(t, frozen).filter((n): n is Extract<PlaceNode, { k: "group" }> => n.k === "group");
    const view = placeView(t);
    const inside = places.filter((p) => p.x > view.x && p.x < view.x + view.w && p.y > view.y && p.y < view.y + view.h);
    expect(inside.length).toBeGreaterThanOrEqual(2);
  });
  it("every picture it can ask for is there", () => {
    const all = new Set<string>();
    for (const plates of ["plain", "iridescent", "silver"]) for (const shape of ["round", "scalloped", "square"]) for (const cups of ["plain", "iridescent"])
      for (const cutlery of ["wooden", "dipped", "glitter"]) for (const centrepiece of ["balloons", "florals", "toppers", "cutouts"]) for (const chairs of ["white_kids"])
        placePictures(placeLayout(table({ plates, cups, cutlery, centrepiece, chairs, napkins: "printed", bottleLabel: "watercolour", cutleryHolder: "band" }, { plateShape: shape, words: { cutleryHolder: "A" } }), frozen)).forEach((p) => all.add(p));
    placePictures(placeLayout(table({ table: "low" }), frozen)).forEach((p) => all.add(p));
    for (const p of Array.from(all)) expect(fs.existsSync(path.join(process.cwd(), "public", p)), p).toBe(true);
  });
});
