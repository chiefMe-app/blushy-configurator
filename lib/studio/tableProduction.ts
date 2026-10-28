// The kids' table's production list (2026-10-28): every piece to buy or make,
// how many, in which colour, and what has to be printed — the placemats, the
// bottle labels, the name tags and, in every small plate, the round card in
// the theme's design (the owner: "o da production list'te çıktı olarak
// listede yer alacak"). Read from the table itself, like the Design Pack's
// specification (lib/pack/spec.ts).
import { PLATE_CARD_MM, TABLE_ITEMS, onFloor, plateCardArt, tableOption } from "./tableCatalog";
import { colourWords } from "./tableRender";
import { clampKids, itemColour, tableCounts, wordsColour, wordsOn, type TableSetup } from "./tableSetup";

export interface TablePrint {
  /** Finished size, millimetres (a circle: its diameter). */
  widthMm: number;
  heightMm: number;
  round?: boolean;
  /** The design it is printed with (a picture in /public). */
  art?: string;
  words?: string;
  wordsColour?: string;
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
  const kids = clampKids(t.kids), { tables } = tableCounts(t);
  const rows: TableProductionRow[] = [];
  const words = (hex: string) => `${colourWords(hex)} (${hex.toUpperCase()})`;
  for (const item of TABLE_ITEMS) {
    const o = tableOption(item.key, t.choices[item.key]);
    if (!o || (item.key === "chairs" && onFloor(t.choices))) continue;
    const quantity = o.unit === "per_table" ? tables : kids;
    const colour = itemColour(t, item.key);
    const base = { item: item.label, detail: o.name + (colour ? `, ${words(colour)}` : ""), quantity, ...(colour ? { colour } : {}) };
    if (item.key === "plates") {
      rows.push({ ...base, item: "Big plates" }, { ...base, item: "Small plates" });
      rows.push({
        item: "Plate cards", detail: `Round card in each small plate, printed in the theme's design, diameter ${PLATE_CARD_MM} mm`, quantity: kids,
        print: { widthMm: PLATE_CARD_MM, heightMm: PLATE_CARD_MM, round: true, art: plateCardArt(t.choices, themeId) },
      });
    } else if (item.key === "placemats") {
      const w = wordsOn(t, "placemats");
      rows.push({ ...base, detail: `${o.name}, A3`, print: { widthMm: 420, heightMm: 297, art: `/design/table/placemats/${themeId}/${o.id}.webp`, ...(w ? { words: w, wordsColour: wordsColor } : {}) } });
    } else if (item.key === "bottleLabel") {
      const w = wordsOn(t, "bottleLabel");
      rows.push({ item: "Water bottles", detail: "Small water bottle", quantity });
      rows.push({ ...base, print: { widthMm: 205, heightMm: 50, art: `/design/table/placemats/${themeId}/${o.id}.webp`, ...(w ? { words: w, wordsColour: wordsColor } : {}) } });
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
  `${r.item}: ${r.detail}${r.print ? ` — print ${r.print.round ? `Ø ${r.print.widthMm} mm` : `${r.print.widthMm} × ${r.print.heightMm} mm`}${r.print.words ? `, words "${r.print.words}" in ${colourWords(r.print.wordsColour ?? "#000000")}` : ""}` : ""} × ${r.quantity}`;

