// The Design Pack, Phase 1.3: what goes in the ZIP and where, the 1:1 cut
// files, the labels on the AI picture, and the sample.
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import sharp from "sharp";
import { buildDesignPack, CUT_DIR } from "@/lib/pack/designPack";
import { buildPackSpec } from "@/lib/pack/spec";
import { boardOutlinePath, calibrationSvg, letteringCutSvg } from "@/lib/pack/cutFiles";
import { fromDraft } from "@/lib/draft";
import sampleDesign from "@/lib/pack/sampleDesign.json";
import { fixtureById } from "../fixtures/configs";

const render = fs.readFileSync(path.join(process.cwd(), "public", "design", "theme-previews", "frozen", "single-round.webp"));
const round = fixtureById("N01-soft-signature-round").config;
const unzip = (zip: Uint8Array) => unzipSync(zip);
const svgSize = (svg: string) => svg.match(/width="([\d.]+)mm" height="([\d.]+)mm"/)!.slice(1).map(Number);

describe("the pack's folders", () => {
  it("specification, cut files, the labelled picture and lists — each in its own folder", async () => {
    const pack = await buildDesignPack({ config: round, packId: "T1", render });
    expect(pack.fileName).toBe("PartyMuse_DesignPack_T1.zip");
    expect(pack.files).toEqual([
      "1_SPECIFICATION/Design_Specification.pdf",
      `${CUT_DIR}/CALIBRATION_100mm.svg`,
      `${CUT_DIR}/board_1_round_outline_1to1_mm.svg`,
      `${CUT_DIR}/lettering_board_1_1to1_mm.svg`,
      `${CUT_DIR}/lettering_board_1_placement_reference.svg`,
      "3_VISUAL_REFERENCE_NOT_FOR_PRINT/visual_reference.jpg",
      "4_LISTS/balloons.csv",
      "4_LISTS/props.csv",
      "README.txt",
    ]);
    const entries = unzip(pack.zip);
    expect(Object.keys(entries).every((n) => n.startsWith("PartyMuse_DesignPack_T1/") && /^[\x20-\x7e]+$/.test(n))).toBe(true); // ASCII names
    const pdf = entries["PartyMuse_DesignPack_T1/1_SPECIFICATION/Design_Specification.pdf"];
    expect(strFromU8(pdf.slice(0, 5))).toBe("%PDF-");
    const readme = strFromU8(entries["PartyMuse_DesignPack_T1/README.txt"]);
    expect(readme).toContain("PartyMuse Design Pack");
    expect(readme).toContain("CALIBRATION_100mm.svg");
    const balloons = strFromU8(entries["PartyMuse_DesignPack_T1/4_LISTS/balloons.csv"]);
    expect(balloons.split("\r\n")[0]).toBe("brand,code,colour,finish,hex,quantity");
    expect(balloons).toContain("Sempertex,981,Silver,Reflex,#C7C9C7,TO CONFIRM");
  }, 60_000);

  it("a two-board design: an outline per board, lettering only where there is lettering", async () => {
    const pack = await buildDesignPack({ config: fixtureById("N03-party-pop-double").config, packId: "T2", render: null });
    expect(pack.files.filter((f) => f.startsWith(CUT_DIR)).map((f) => f.slice(CUT_DIR.length + 1))).toEqual([
      "CALIBRATION_100mm.svg", "board_1_arch_outline_1to1_mm.svg", "board_2_arch_outline_1to1_mm.svg",
      "lettering_board_2_1to1_mm.svg", "lettering_board_2_placement_reference.svg",
    ]);
    expect(pack.files).not.toContain("3_VISUAL_REFERENCE_NOT_FOR_PRINT/visual_reference.jpg"); // no render yet
  }, 60_000);
});

describe("cut files, 1:1 in millimetres", () => {
  const spec = buildPackSpec(round);
  const board = spec.boards[0];
  it("the board outline is the board's real size", () => {
    expect(board).toMatchObject({ type: "round", widthMm: 2000, heightMm: 2000, hasCutFile: true });
    expect(boardOutlinePath({ type: "arch", widthMm: 1000, heightMm: 2000 })).toBe("M0,2000L0,500A500,500 0 0 1 1000,500L1000,2000Z");
  });
  it("the lettering is the size the render guide gives it on this board", () => {
    const l = board.lettering!;
    expect(l.widthMm).toBe(720); // the guide's clear band on a lone 2 m round: 0.36 of its width
    expect(l.lines.map((x) => x.text)).toEqual(["Happy Birthday", "Arya"]);
    const [w, h] = svgSize(letteringCutSvg(board)!);
    expect(w).toBeGreaterThan(300);
    expect(w).toBeLessThanOrEqual(l.widthMm + 20);
    expect(h).toBeGreaterThan(100);
  });
  it("strokes thinner than the provisional limit are flagged for the producer", () => {
    const heading = board.lettering!.lines.find((x) => x.role === "heading")!;
    expect(heading.thinStrokeMm).toBeLessThan(2.5);
    expect(heading.strokeOk).toBe(false);
  });
  it("the calibration square is exactly 100 mm", () => {
    const svg = calibrationSvg();
    expect(svg).toContain('d="M10,10H110V110H10Z"');
    expect(svgSize(svg)).toEqual([120, 125]);
  });
});

describe("the AI picture is only ever a labelled visual reference", () => {
  it("it carries the strip, in its own folder, and the PDF keeps it to part B", async () => {
    const pack = await buildDesignPack({ config: round, packId: "T3", render });
    const jpg = unzip(pack.zip)["PartyMuse_DesignPack_T3/3_VISUAL_REFERENCE_NOT_FOR_PRINT/visual_reference.jpg"];
    const meta = await sharp(jpg).metadata();
    expect(meta.format).toBe("jpeg");
    // The strip along the bottom is dark (its top rows, above the label's
    // letters): the label is burnt into the picture.
    const strip = Math.round(Math.max(44, meta.width! * 0.045));
    const { data, info } = await sharp(jpg).extract({ left: 0, top: meta.height! - strip + 3, width: meta.width!, height: 3 }).raw().toBuffer({ resolveWithObject: true });
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    expect(info.width).toBe(meta.width);
    expect(mean).toBeLessThan(70);
  }, 60_000);
});

describe("the free sample", () => {
  it("the fixed demo design, watermarked, with no cut files", async () => {
    const restored = fromDraft(JSON.stringify(sampleDesign))!;
    expect(restored.config.theme).toBe("frozen");
    const pack = await buildDesignPack({ config: restored.config, packId: "SAMPLE", render, sample: true });
    expect(pack.files.some((f) => f.startsWith("2_CUT_FILES"))).toBe(false);
    expect(pack.files).toContain("3_VISUAL_REFERENCE_NOT_FOR_PRINT/visual_reference.jpg");
    expect(strFromU8(unzip(pack.zip)["PartyMuse_DesignPack_SAMPLE/README.txt"])).toContain("SAMPLE");
  }, 60_000);
});
