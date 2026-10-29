// The kids' table's production list (2026-10-28): every piece to buy or make,
// how many, in which colour, and what has to be printed — the placemats, the
// bottle labels and the name tags (the plate card of 2026-10-28 was taken out
// the next day). Read from the table itself, like the Design Pack's
// specification (lib/pack/spec.ts).
import { PLATE_SHAPES, TABLE_ITEMS, onFloor, tableOption } from "./tableCatalog";
import { colourWords } from "./tableRender";
import { asPrinted, tableFont } from "./tableFonts";
import { fontById } from "@/lib/typography/registry";
import { clampKids, itemColour, tableCounts, wordsColour, wordsOn, type TableSetup } from "./tableSetup";

export interface TablePrint {
  /** Finished size, millimetres (a circle: its diameter). */
  widthMm: number;
  heightMm: number;
  round?: boolean;
  /** The design it is printed with (a picture in /public). */
  art?: string;
  /** As printed: in capitals for a print face (./tableFonts). */
  words?: string;
  wordsColour?: string;
  /** The lettering: "Bouncy (Birthstone Bounce)". */
  wordsFont?: string;
}

export interface TableProductionRow {
  item: string;
  detail: string;
  quantity: number;
  /** The colour of a plain piece. */
  colour?: string;
  print?: TablePrint;
}

export function tableProductionList(t: TableSetup, theme: { id: string; accent: string }): TableProductionRow[] {
  if (!t.enabled) return [];
  const themeId = theme.id, wordsColor = wordsColour(t, theme);
  const lettering = (w: string, fontId: string) => {
    const font = tableFont(fontId);
    return { words: asPrinted(w, font), wordsColour: wordsColor, wordsFont: `${font.name} (${fontById(font.id)?.family ?? font.id})` };
  };
  const kids = clampKids(t.kids), { tables } = tableCounts(t);
  const rows: TableProductionRow[] = [];
  const words = (hex: string) => `${colourWords(hex)} (${hex.toUpperCase()})`;
  for (const item of TABLE_ITEMS) {
    const o = tableOption(item.key, t.choices[item.key]);
    if (!o || (item.key === "chairs" && onFloor(t.choices))) continue;
    const quantity = o.unit === "per_table" ? tables : kids;
    const colour = itemColour(t, item.key);
    const base = { item: item.label, detail: o.name + (colour ? `, ${words(colour)}` : ""), quantity, ...(colour ? { colour } : {}) };
    // A plain piece's design: its colour only; the others print the theme's design.
    const art = o.themed ? `/design/table/placemats/${themeId}/${o.id}.webp` : undefined;
    if (item.key === "plates") {
      const shape = o.id === "plain" ? `, ${PLATE_SHAPES.find((p) => p.id === t.plateShape)?.name.toLowerCase() ?? "round"}` : "";
      rows.push({ ...base, item: "Big plates", detail: base.detail + shape }, { ...base, item: "Small plates", detail: base.detail + shape });
    } else if (item.key === "placemats") {
      const w = wordsOn(t, "placemats");
      rows.push({ ...base, detail: `${base.detail}, A3`, print: { widthMm: 420, heightMm: 297, ...(art ? { art } : {}), ...(w ? lettering(w, t.placematFont) : {}) } });
    } else if (item.key === "bottleLabel") {
      const w = wordsOn(t, "bottleLabel");
      rows.push({ item: "Water bottles", detail: "Small water bottle", quantity });
      rows.push({ ...base, print: { widthMm: 205, heightMm: 50, ...(art ? { art } : {}), ...(w ? lettering(w, t.labelFont) : {}) } });
    } else if (item.key === "cutleryHolder") {
      rows.push(base);
      const w = wordsOn(t, "cutleryHolder");
      if (w) rows.push({ item: "Name tags", detail: `Little tag on each napkin band`, quantity, print: { widthMm: 50, heightMm: 30, words: w, wordsColour: wordsColor } });
    } else rows.push(base);
  }
  return rows;
}

/** A row in one line, for lists and the order. */
export const productionLine = (r: TableProductionRow) =>
  `${r.item}: ${r.detail}${r.print ? ` — print ${r.print.round ? `Ø ${r.print.widthMm} mm` : `${r.print.widthMm} × ${r.print.heightMm} mm`}${r.print.words ? `, words "${r.print.words}" in ${colourWords(r.print.wordsColour ?? "#000000")}${r.print.wordsFont ? `, ${r.print.wordsFont} lettering` : ""}` : ""}` : ""} × ${r.quantity}`;

