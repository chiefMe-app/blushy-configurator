// The Design Pack as a ZIP (Phase 1.3):
//
//   PartyMuse_DesignPack_<id>/
//     README.txt
//     1_SPECIFICATION/Design_Specification.pdf
//     2_CUT_FILES/   board outlines, lettering, calibration
//     3_VISUAL_REFERENCE_NOT_FOR_PRINT/visual_reference.jpg
//     4_LISTS/balloons.csv, props.csv (and kids_table.csv)
//     5_PRINT_FILES/kids_table/   the kids' table's plate card (2026-10-28)
//
// Production files (1, 2, 4) come from the design; the AI picture (3) is only
// ever a labelled visual reference. A sample pack has no cut files.
import { zipSync, strToU8 } from "fflate";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { BuilderConfig } from "@/lib/config";
import { buildPackSpec, TO_CONFIRM, type PackSpec } from "./spec";
import { CUT_DIR, boardOutlineSvg, calibrationSvg, letteringCutSvg, placementSvg } from "./cutFiles";
export { CUT_DIR };
import { specificationPdf } from "./pdf";
import { labelledReference } from "./visualRef";

export const VISUAL_DIR = "3_VISUAL_REFERENCE_NOT_FOR_PRINT";
export const PRINT_DIR = "5_PRINT_FILES";

/**
 * The plate card as a print file: the design cut round, at 300 dpi for its
 * size, transparent outside the circle. Undefined if the design's picture is
 * not with the server.
 */
export async function plateCardPng(art: string, diameterMm: number): Promise<Uint8Array | undefined> {
  const bytes = await readFile(path.join(process.cwd(), "public", art)).catch(() => undefined);
  if (!bytes) return undefined;
  const px = Math.round((diameterMm / 25.4) * 300);
  const circle = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}"><circle cx="${px / 2}" cy="${px / 2}" r="${px / 2}" fill="#fff"/></svg>`);
  return new Uint8Array(await sharp(bytes).resize(px, px, { fit: "cover" }).ensureAlpha().composite([{ input: circle, blend: "dest-in" }]).png().withMetadata({ density: 300 }).toBuffer());
}

export interface DesignPackInput {
  config: BuilderConfig;
  packId: string;
  createdAt?: Date;
  /** The design's render (any image format sharp reads), or none. */
  render?: Buffer | null;
  /** A free sample: watermarked, no cut files. */
  sample?: boolean;
}

const csv = (rows: (string | number)[][]) => rows.map((r) => r.map((c) => {
  const s = String(c);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}).join(",")).join("\r\n") + "\r\n";

function readme(spec: PackSpec, packId: string, sample: boolean) {
  return [
    `PartyMuse Design Pack${sample ? " — SAMPLE" : ""}`,
    spec.title,
    `Pack ${packId}`,
    "",
    "What is inside",
    "  1_SPECIFICATION  Design_Specification.pdf: A. production information (sizes, materials, colours, lettering, balloons, extras)",
    "                   and B. the visual reference.",
    sample
      ? "  2_CUT_FILES      Not in a sample. Your own Design Pack has 1:1 board outlines and lettering in millimetres."
      : "  2_CUT_FILES      1:1 SVG files in millimetres: board outlines, lettering (merged outlines), where the lettering goes,",
    sample ? "" : "                   and CALIBRATION_100mm.svg.",
    "  3_VISUAL_REFERENCE_NOT_FOR_PRINT  The AI picture of the design. Indicative only — not artwork, not to scale.",
    `  4_LISTS          balloons.csv and props.csv${spec.kidsTable.length ? ", and kids_table.csv: every piece of the kids' table" : ""}.`,
    spec.kidsTable.length && !sample ? `  ${PRINT_DIR}    The kids' table's plate card, cut round at its size (300 dpi). Final artwork resolution: ${TO_CONFIRM}.` : "",
    "",
    "Before anything is made",
    "  - Open CALIBRATION_100mm.svg in the cutting software at 100 %: the red square must measure 100 x 100 mm.",
    `  - Values marked ${TO_CONFIRM} are not set by the design (materials, quantities): choose them with your maker.`,
    "  - Make everything from the specification and the cut files, never from the picture.",
    "",
    "PartyMuse by Blushy — https://blushy-events.vercel.app",
  ].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\r\n") + "\r\n";
}

export interface DesignPack {
  zip: Uint8Array;
  fileName: string;
  spec: PackSpec;
  files: string[];
}

export async function buildDesignPack(input: DesignPackInput): Promise<DesignPack> {
  const createdAt = input.createdAt ?? new Date();
  const sample = !!input.sample;
  const spec = buildPackSpec(input.config);
  const root = `PartyMuse_DesignPack_${input.packId}`;
  const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {};
  const put = (name: string, data: string | Uint8Array, stored = false) => {
    const bytes = typeof data === "string" ? strToU8(data) : data;
    files[`${root}/${name}`] = stored ? [bytes, { level: 0 }] : bytes;
  };

  // 2. Cut files (not in a sample)
  const cutFiles: Record<number, { outline?: string; lettering?: string; placement?: string }> = {};
  if (!sample) {
    for (const b of spec.boards) {
      const names: { outline?: string; lettering?: string; placement?: string } = {};
      if (b.hasCutFile) {
        names.outline = `board_${b.index}_${b.type}_outline_1to1_mm.svg`;
        put(`${CUT_DIR}/${names.outline}`, boardOutlineSvg(b));
      }
      const lettering = letteringCutSvg(b);
      if (lettering) {
        names.lettering = `lettering_board_${b.index}_1to1_mm.svg`;
        put(`${CUT_DIR}/${names.lettering}`, lettering);
        names.placement = `lettering_board_${b.index}_placement_reference.svg`;
        put(`${CUT_DIR}/${names.placement}`, placementSvg(b)!);
      }
      cutFiles[b.index] = names;
    }
    put(`${CUT_DIR}/CALIBRATION_100mm.svg`, calibrationSvg());
  }

  // 3. Visual reference
  const visual = input.render ? await labelledReference(input.render, { sample }) : null;
  if (visual) put(`${VISUAL_DIR}/visual_reference.jpg`, visual, true);

  // 1. Specification
  put("1_SPECIFICATION/Design_Specification.pdf", await specificationPdf(spec, { packId: input.packId, createdAt, visualReference: visual, cutFiles, sample }), true);

  // 4. Lists
  put("4_LISTS/balloons.csv", csv([
    ["brand", "code", "colour", "finish", "hex", "quantity"],
    ...spec.balloons.colours.map((c) => ["Sempertex", c.code, c.name, c.finish, c.hex.toUpperCase(), TO_CONFIRM]),
  ]));
  put("4_LISTS/props.csv", csv([
    ["item", "details", "quantity"],
    ...spec.boards.map((b) => [`${b.name}: ${b.kind}`, `${b.widthMm} x ${b.heightMm} mm, ${b.colourHex.toUpperCase()}, ${b.material}`, 1]),
    ...spec.boards.filter((b) => b.lettering).map((b) => [`${b.name}: lettering`, `${b.lettering!.lines.map((l) => l.text).join(" / ")}; ${b.lettering!.finishLabel}`, 1]),
    ...spec.plinths.map((p) => [`Plinth ${p.label}`, `cylinder ${p.diameterMm} x ${p.heightMm} mm`, 1]),
    ...spec.standees.flatMap((s) => (["large", "medium", "small"] as const).filter((k) => s[k] > 0).map((k) => [`Standee: ${s.label}`, k, s[k]])),
    ...spec.extras.map((e) => [e, "", 1]),
  ]));
  if (spec.kidsTable.length) {
    put("4_LISTS/kids_table.csv", csv([
      ["item", "details", "colour", "quantity", "print size (mm)", "words", "words colour"],
      ...spec.kidsTable.map((r) => [r.item, r.detail, r.colour?.toUpperCase() ?? "", r.quantity,
        r.print ? (r.print.round ? `diameter ${r.print.widthMm}` : `${r.print.widthMm} x ${r.print.heightMm}`) : "", r.print?.words ?? "", r.print?.wordsColour?.toUpperCase() ?? ""]),
    ]));
    // 5. Print files (not in a sample): the plate card.
    const card = spec.kidsTable.find((r) => r.print?.round && r.print.art);
    const png = !sample && card ? await plateCardPng(card.print!.art!, card.print!.widthMm) : undefined;
    if (png) put(`${PRINT_DIR}/kids_table/plate_card_diameter_${card!.print!.widthMm}mm_x${card!.quantity}.png`, png, true);
  }
  put("README.txt", readme(spec, input.packId, sample));

  const zip = zipSync(files, { level: 6, mtime: createdAt });
  return { zip, fileName: `${root}.zip`, spec, files: Object.keys(files).map((f) => f.slice(root.length + 1)).sort() };
}
