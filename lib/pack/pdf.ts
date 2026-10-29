// Design_Specification.pdf (Phase 1.3). Two parts, always in this order:
//   A. Production information — read from the design (lib/pack/spec.ts);
//   B. Visual reference — the AI render, labelled indicative only.
import fs from "fs";
import path from "path";
import { PDFDocument, rgb, degrees, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { TO_CONFIRM, type PackSpec } from "./spec";
import { CUT_DIR } from "./cutFiles";

const A4: [number, number] = [595.28, 841.89];
const M = 48; // margin
const INK = rgb(0.17, 0.11, 0.12), MUTED = rgb(0.45, 0.4, 0.42), PINK = rgb(0.98, 0.08, 0.4), LINE = rgb(0.9, 0.86, 0.88), WARN = rgb(0.75, 0.3, 0.05);

let fontBytes: Buffer | null = null;
const fontFile = () => (fontBytes ??= fs.readFileSync(path.join(process.cwd(), "assets", "fonts", "dmsans", "DMSans[opsz,wght].ttf")));

const hexRgb = (hex: string): RGB => {
  const h = hex.replace("#", "").padEnd(6, "0");
  return rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);
};

class Writer {
  page!: PDFPage;
  y = 0;
  constructor(private doc: PDFDocument, private font: PDFFont, private sample: boolean, private footer: string) { this.newPage(); }

  newPage() {
    this.page = this.doc.addPage(A4);
    this.y = A4[1] - M;
    this.page.drawText(this.footer, { x: M, y: 24, size: 7.5, font: this.font, color: MUTED });
    if (this.sample) {
      this.page.drawText("SAMPLE", { x: 120, y: 260, size: 120, font: this.font, color: rgb(0.98, 0.85, 0.9), rotate: degrees(35), opacity: 0.5 });
    }
  }
  need(h: number) { if (this.y - h < M) this.newPage(); }
  /** Lines of text wrapped to the width. */
  wrap(text: string, size: number, width: number): string[] {
    const out: string[] = [];
    for (const para of text.split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (this.font.widthOfTextAtSize(next, size) > width && line) { out.push(line); line = word; } else line = next;
      }
      out.push(line);
    }
    return out;
  }
  text(text: string, opts: { size?: number; color?: RGB; x?: number; width?: number; gap?: number } = {}) {
    const size = opts.size ?? 9.5, x = opts.x ?? M, width = opts.width ?? A4[0] - M - x;
    for (const line of this.wrap(text, size, width)) {
      this.need(size * 1.4);
      this.page.drawText(line, { x, y: this.y - size, size, font: this.font, color: opts.color ?? INK });
      this.y -= size * 1.4;
    }
    this.y -= opts.gap ?? 2;
  }
  heading(text: string, size = 15) { this.need(size * 3); this.y -= size * 0.6; this.text(text, { size, color: PINK, gap: 4 }); }
  sub(text: string) { this.need(40); this.y -= 6; this.text(text, { size: 11.5, gap: 2 }); this.rule(); }
  rule() { this.page.drawLine({ start: { x: M, y: this.y }, end: { x: A4[0] - M, y: this.y }, thickness: 0.6, color: LINE }); this.y -= 8; }
  /** Label: value rows, the value column wrapped; a row may end in a colour swatch. */
  rows(rows: [string, string, string?][]) {
    for (const [k, v, swatchHex] of rows) {
      const lines = this.wrap(v, 9.5, A4[0] - M - 170 - (swatchHex ? 18 : 0));
      this.need(lines.length * 13.3 + 2);
      this.page.drawText(k, { x: M, y: this.y - 9.5, size: 9, font: this.font, color: MUTED });
      lines.forEach((l, i) => this.page.drawText(l, { x: 170, y: this.y - 9.5 - i * 13.3, size: 9.5, font: this.font, color: /TO CONFIRM|CHECK/.test(l) ? WARN : INK }));
      if (swatchHex) this.swatch(swatchHex, 170 + this.font.widthOfTextAtSize(lines[lines.length - 1], 9.5) + 8, this.y - (lines.length - 1) * 13.3);
      this.y -= lines.length * 13.3 + 2;
    }
    this.y -= 4;
  }
  swatch(hex: string, x: number, top = this.y) {
    this.page.drawRectangle({ x, y: top - 10, width: 10, height: 10, color: hexRgb(hex), borderColor: rgb(0.7, 0.66, 0.68), borderWidth: 0.6 });
  }
}

export interface PdfOptions {
  packId: string;
  createdAt: Date;
  /** The labelled visual reference (JPEG), or none. */
  visualReference?: Buffer | null;
  /** Cut file names per board index, to cross-reference. */
  cutFiles: Record<number, { outline?: string; lettering?: string; placement?: string }>;
  sample?: boolean;
}

export async function specificationPdf(spec: PackSpec, o: PdfOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`PartyMuse Design Pack — ${spec.title}`);
  doc.setAuthor("PartyMuse by Blushy");
  doc.setCreationDate(o.createdAt);
  const font = await doc.embedFont(fontFile(), { subset: true });
  const date = o.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const w = new Writer(doc, font, !!o.sample, `PartyMuse Design Pack · ${o.packId} · ${date} · Visual references are AI-generated and indicative only.`);

  w.text(o.sample ? "PartyMuse Design Pack — SAMPLE" : "PartyMuse Design Pack", { size: 20, color: PINK, gap: 2 });
  w.text(spec.title, { size: 14, gap: 2 });
  w.text(`${spec.eventType} · Pack ${o.packId} · ${date}`, { size: 9, color: MUTED, gap: 10 });
  w.text("Before cutting, open CALIBRATION_100mm.svg at 100 % — it must measure 100 mm. "
    + `Values marked ${TO_CONFIRM} are not set by the design (materials, quantities): choose them with your maker.`, { size: 9, color: WARN, gap: 8 });
  if (o.sample) w.text("This sample shows the layout of a Design Pack for a demo design. It has no cut files.", { size: 9, color: WARN, gap: 8 });

  w.heading("A. Production information");

  w.sub("A1. Boards");
  for (const b of spec.boards) {
    const files = o.cutFiles[b.index] ?? {};
    w.rows([
      [b.name, `${b.kind} — ${b.widthMm} × ${b.heightMm} mm (W × H)`],
      ["Colour", b.colourHex.toUpperCase(), b.colourHex],
      ["Material", b.material],
      ["Cut file", files.outline ? `${CUT_DIR}/${files.outline}` : "None (stock item, not cut)"],
    ]);
  }

  const lettered = spec.boards.filter((b) => b.lettering);
  if (lettered.length) {
    w.sub("A2. Lettering");
    for (const b of lettered) {
      const l = b.lettering!, files = o.cutFiles[b.index] ?? {};
      w.rows([
        [`${b.name}`, l.lines.map((x) => `"${x.text}"`).join(" / ")],
        ["Finish", l.finishLabel],
        ["Colour", `${l.colour} (${l.colourHex.toUpperCase()})`, l.colourHex],
        ["Lettering block", `${l.widthMm} × ${l.heightMm} mm; centre ${l.centreXMm} mm from the board's left edge, ${l.centreYMm} mm from its top`],
        ...l.lines.map((x): [string, string] => [
          x.role === "heading" ? "Heading" : "Name",
          `${x.font} ${x.weight}, cap height ${x.capHeightMm} mm; thinnest stroke ${x.thinStrokeMm} mm`
            + (x.minStrokeMm !== null ? (x.strokeOk ? ` (limit ${x.minStrokeMm} mm: OK, provisional)` : ` — CHECK: below the provisional ${x.minStrokeMm} mm limit`) : "")
            + (x.missingLetters ? ` — CHECK: the font lacks "${x.missingLetters}"` : ""),
        ]),
        ["Cut files", [files.lettering && `${CUT_DIR}/${files.lettering}`, files.placement && `${CUT_DIR}/${files.placement} (placement reference)`].filter(Boolean).join("; ") || "—"],
      ]);
    }
  }

  w.sub("A3. Balloons");
  w.rows([["Style", spec.balloons.style + (spec.balloons.florals ? ", with florals and greenery" : "") + (spec.balloons.ringStyle ? `; ring: ${spec.balloons.ringStyle}` : "")]]);
  for (const c of spec.balloons.colours) {
    w.need(16);
    w.swatch(c.hex, M);
    w.page.drawText(`Sempertex ${c.code} · ${c.name} · ${c.finish} · ${c.hex.toUpperCase()}`, { x: M + 18, y: w.y - 9, size: 9.5, font, color: c.code === TO_CONFIRM ? WARN : INK });
    w.y -= 15;
  }
  w.text(`Balloon counts and sizes: ${TO_CONFIRM} with your balloon artist (see 4_LISTS/balloons.csv).`, { size: 9, color: WARN, gap: 6 });

  if (spec.plinths.length || spec.standees.length || spec.extras.length) {
    w.sub("A4. Plinths, standees and extras");
    w.rows([
      ...spec.plinths.map((p, i): [string, string] => [`Plinth ${i + 1}`, `${p.label}: cylinder, diameter ${p.diameterMm} mm, height ${p.heightMm} mm`]),
      ...spec.standees.map((s): [string, string] => ["Standee", `${s.label}: large ${s.large}, medium ${s.medium}, small ${s.small}`]),
      ...spec.extras.map((e): [string, string] => ["Extra", e]),
    ]);
  }

  if (spec.kidsTable.length) {
    w.sub("A5. Kids' table");
    w.rows(spec.kidsTable.map((r): [string, string, string?] => [r.item, `${r.detail} — ${r.quantity}${r.print
      ? ` · print ${r.print.round ? `round, diameter ${r.print.widthMm} mm` : `${r.print.widthMm} x ${r.print.heightMm} mm`}${r.print.words ? `, words "${r.print.words}" in ${r.print.wordsColour}` : ""}${r.print.art ? ", in the theme's design; final artwork resolution " + TO_CONFIRM : ""}`
      : ""}`, r.colour]));
  }

  w.sub(`A${spec.kidsTable.length ? 6 : 5}. What the design includes (estimate)`);
  w.rows([...spec.items.map((i): [string, string] => [i.label, `AED ${i.amount.toLocaleString("en")}`]), ["Estimated total", `AED ${spec.estimatedTotal.toLocaleString("en")} — an estimate, not a quote`]]);

  w.sub(`A${spec.kidsTable.length ? 7 : 6}. Setting up`);
  w.text("Set the boards on a level floor, against a wall or on their stands. Fix the lettering to the board at the centre given in A2. "
    + "Hang or tie the balloon garland after the boards are in place. Stands, fixings and weights: " + TO_CONFIRM + ".", { gap: 6 });

  // B. Visual reference
  w.newPage();
  w.heading("B. Visual reference (AI-generated, indicative only)");
  w.text("This picture shows the idea of the design. It is not artwork and not to scale: balloon placement, colours and lettering can differ. "
    + "Make everything from part A and the cut files.", { size: 9.5, color: MUTED, gap: 10 });
  if (o.visualReference) {
    const img = await doc.embedJpg(o.visualReference);
    const maxW = A4[0] - 2 * M, maxH = w.y - M - 10;
    const k = Math.min(maxW / img.width, maxH / img.height);
    w.page.drawImage(img, { x: M + (maxW - img.width * k) / 2, y: w.y - img.height * k, width: img.width * k, height: img.height * k });
  } else {
    w.text("No render was made for this design yet.", { color: MUTED });
  }
  return doc.save();
}
