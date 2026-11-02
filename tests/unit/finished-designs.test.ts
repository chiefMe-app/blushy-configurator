// The finished designs (2026-11-02, the owner: "finalize olmuş table setup dizaynı, backdrop vs tek tek
// çıkmalı. Jpeg şeklinde"): which pieces are shown and saved, and under what names.
import { describe, expect, it } from "vitest";
import { defaultConfig, themeById, type BuilderConfig } from "@/lib/config";
import { defaultTableSetup } from "@/lib/studio/tableSetup";
import { defaultAdultTable } from "@/lib/studio/adultTable";
import { defaultWelcomeBoard } from "@/lib/studio/welcomeBoard";
import { finishedPieces } from "@/lib/finishedDesigns";

const frozen = themeById("frozen")!;
const wavy = { id: "wavy", type: "wavy", widthCm: 120, heightCm: 220, color: "" } as BuilderConfig["decor"]["backdropItems"][number];
const base = (): BuilderConfig => {
  const c: BuilderConfig = { ...defaultConfig(), theme: "frozen", themeSelected: true };
  return { ...c, decor: { ...c.decor, backdropItems: [wavy] } };
};

describe("the finished designs", () => {
  it("one per piece in the party, in the party's order, each with its own JPEG name", () => {
    const c = base();
    c.decor = { ...c.decor, backdropChoice: "yes" };
    c.table = { ...defaultTableSetup(frozen), done: true };
    c.adultTable = { ...defaultAdultTable(frozen), enabled: true };
    c.welcomeBoard = { ...defaultWelcomeBoard(frozen), done: true };
    const pieces = finishedPieces(c);
    expect(pieces.map((p) => p.id)).toEqual(["backdrop", "kids", "adults", "welcome"]);
    expect(pieces.map((p) => p.file)).toEqual(["partymuse-backdrop.jpg", "partymuse-kids-table.jpg", "partymuse-grown-ups-table.jpg", "partymuse-welcome-board.jpg"]);
    expect(pieces.map((p) => p.finished)).toEqual([true, true, false, true]);
  });
  it("leaves out what she skipped: no backdrop, no tables, no board", () => {
    const c = base();
    c.decor = { ...c.decor, backdropChoice: "skip" };
    c.table = { ...defaultTableSetup(frozen), enabled: false };
    c.adultTable = { ...defaultAdultTable(frozen), enabled: false };
    c.welcomeBoard = { ...defaultWelcomeBoard(frozen), enabled: false };
    expect(finishedPieces(c)).toEqual([]);
  });
  it("a backdrop with nothing in it isn't a design", () => {
    const c = base();
    c.decor = { ...c.decor, backdropItems: [] };
    expect(finishedPieces(c).map((p) => p.id)).not.toContain("backdrop");
  });
});
