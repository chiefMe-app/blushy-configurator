// The kids' table: every item the customer chooses, three options each (plus
// "None" where an item is optional). Party favours are not here: they are
// Giveaways, a Decor part of their own (2026-10-27). The owner picks the real
// options — replace a name, price or picture here and the step follows:
//   - name / note: what the card says;
//   - price, unit: AED per table, per child or once (placeholder prices for now);
//   - photo: a picture in /public/design/table. The pictures there now are
//     AI-made stand-ins inspired by the owner's Frozen references (2026-10-27,
//     no characters or logos) — swap in real product photos at 4:3; without a
//     photo, the card shows a drawn placeholder.
export type TableItemKey =
  | "table" | "chairs"
  | "tablecloth" | "runner" | "napkins"
  | "plates" | "cups" | "cutlery" | "chargers"
  | "centrepiece" | "chairDecor" | "nameCards" | "partyHats";

export type PriceUnit = "per_table" | "per_child";

export interface TableOption {
  id: string;
  name: string;
  note: string;
  price: number;
  unit: PriceUnit;
  photo?: string;
}

export interface TableItem {
  key: TableItemKey;
  label: string;
  /** Optional items have a "None" choice before the three options. */
  optional: boolean;
  /** The item takes a colour (the cloth, the runner, the napkins). */
  coloured?: boolean;
  options: [TableOption, TableOption, TableOption];
}

export const NONE = "none";

export const TABLE_ITEMS: TableItem[] = [
  { key: "table", label: "Table", optional: false, options: [
    { id: "long", name: "Long table", note: "180 × 60 cm · 8 kids · joined into rows", price: 80, unit: "per_table", photo: "/design/table/table-long.webp" },
    { id: "round", name: "Round table", note: "⌀ 120 cm · 8 kids", price: 80, unit: "per_table", photo: "/design/table/table-round.webp" },
    { id: "square", name: "Square table", note: "100 × 100 cm · 8 kids", price: 80, unit: "per_table", photo: "/design/table/table-square.webp" },
  ] },
  { key: "chairs", label: "Chairs", optional: false, options: [
    { id: "white_kids", name: "White kids' chairs", note: "Classic and light", price: 5, unit: "per_child", photo: "/design/table/chairs-white_kids.webp" },
    { id: "gold_chiavari", name: "Gold chiavari", note: "Little ballroom chairs", price: 10, unit: "per_child", photo: "/design/table/chairs-gold_chiavari.webp" },
    { id: "clear_ghost", name: "Clear ghost chairs", note: "See-through acrylic", price: 13, unit: "per_child", photo: "/design/table/chairs-clear_ghost.webp" },
  ] },
  { key: "tablecloth", label: "Tablecloth", optional: false, coloured: true, options: [
    { id: "classic", name: "Classic cloth", note: "Floor-length, smooth", price: 40, unit: "per_table", photo: "/design/table/tablecloth-classic.webp" },
    { id: "ruffle", name: "Ruffled skirt", note: "Frilled all the way round", price: 70, unit: "per_table", photo: "/design/table/tablecloth-ruffle.webp" },
    { id: "sequin", name: "Sequin cloth", note: "A little sparkle", price: 90, unit: "per_table", photo: "/design/table/tablecloth-sequin.webp" },
  ] },
  { key: "runner", label: "Runner", optional: true, coloured: true, options: [
    { id: "tulle", name: "Tulle runner", note: "Soft and airy", price: 30, unit: "per_table", photo: "/design/table/runner-tulle.webp" },
    { id: "sequin", name: "Sequin runner", note: "Shimmering stripe", price: 45, unit: "per_table", photo: "/design/table/runner-sequin.webp" },
    { id: "greenery", name: "Greenery garland", note: "Leaves down the middle", price: 60, unit: "per_table", photo: "/design/table/runner-greenery.webp" },
  ] },
  { key: "napkins", label: "Napkins", optional: false, coloured: true, options: [
    { id: "folded", name: "Folded cotton", note: "Neatly folded on the plate", price: 4, unit: "per_child", photo: "/design/table/napkins-folded.webp" },
    { id: "printed", name: "Printed paper", note: "In the theme's pattern", price: 2, unit: "per_child", photo: "/design/table/napkins-printed.webp" },
    { id: "bow", name: "Bow-tied", note: "Tied with a ribbon bow", price: 6, unit: "per_child", photo: "/design/table/napkins-bow.webp" },
  ] },
  { key: "plates", label: "Plates", optional: false, options: [
    { id: "themed", name: "Themed plates", note: "In the theme's colours", price: 6, unit: "per_child", photo: "/design/table/plates-themed.webp" },
    { id: "white_gold", name: "White & gold", note: "White with a gold rim", price: 8, unit: "per_child", photo: "/design/table/plates-white_gold.webp" },
    { id: "pastel", name: "Pastel melamine", note: "Soft pastel mix", price: 5, unit: "per_child", photo: "/design/table/plates-pastel.webp" },
  ] },
  { key: "cups", label: "Cups", optional: false, options: [
    { id: "straw", name: "Cups with straws", note: "Paper cup, striped straw", price: 3, unit: "per_child", photo: "/design/table/cups-straw.webp" },
    { id: "gold_rim", name: "Gold-rim cups", note: "Clear with a gold edge", price: 5, unit: "per_child", photo: "/design/table/cups-gold_rim.webp" },
    { id: "lidded", name: "Lidded cups", note: "No spills, little lids", price: 4, unit: "per_child", photo: "/design/table/cups-lidded.webp" },
  ] },
  { key: "cutlery", label: "Cutlery", optional: false, options: [
    { id: "wooden", name: "Wooden", note: "Natural and light", price: 2, unit: "per_child", photo: "/design/table/cutlery-wooden.webp" },
    { id: "gold", name: "Gold", note: "Shiny gold set", price: 4, unit: "per_child", photo: "/design/table/cutlery-gold.webp" },
    { id: "pastel", name: "Pastel", note: "Soft colours to match", price: 2, unit: "per_child", photo: "/design/table/cutlery-pastel.webp" },
  ] },
  { key: "chargers", label: "Charger plates", optional: true, options: [
    { id: "gold", name: "Gold chargers", note: "Under every plate", price: 6, unit: "per_child", photo: "/design/table/chargers-gold.webp" },
    { id: "rattan", name: "Rattan chargers", note: "Woven and warm", price: 6, unit: "per_child", photo: "/design/table/chargers-rattan.webp" },
    { id: "beaded", name: "Clear beaded", note: "Glass with a bead edge", price: 7, unit: "per_child", photo: "/design/table/chargers-beaded.webp" },
  ] },
  { key: "centrepiece", label: "Centrepiece", optional: true, options: [
    { id: "balloons", name: "Balloon bunch", note: "Mini balloons in the theme", price: 60, unit: "per_table", photo: "/design/table/centrepiece-balloons.webp" },
    { id: "florals", name: "Fresh florals", note: "Low arrangement", price: 90, unit: "per_table", photo: "/design/table/centrepiece-florals.webp" },
    { id: "toppers", name: "Theme toppers", note: "Stars and characters on sticks", price: 40, unit: "per_table", photo: "/design/table/centrepiece-toppers.webp" },
  ] },
  { key: "chairDecor", label: "Chair decoration", optional: true, options: [
    { id: "tulle_bow", name: "Tulle bow", note: "On every chair back", price: 6, unit: "per_child", photo: "/design/table/chairDecor-tulle_bow.webp" },
    { id: "balloon", name: "Balloon tie", note: "A balloon on every chair", price: 5, unit: "per_child", photo: "/design/table/chairDecor-balloon.webp" },
    { id: "name_flag", name: "Name flag", note: "A little flag with the name", price: 7, unit: "per_child", photo: "/design/table/chairDecor-name_flag.webp" },
  ] },
  { key: "nameCards", label: "Name cards", optional: true, options: [
    { id: "tent", name: "Tent card", note: "Folded card at each plate", price: 4, unit: "per_child", photo: "/design/table/nameCards-tent.webp" },
    { id: "tag", name: "Round tag", note: "Tied to the napkin", price: 4, unit: "per_child", photo: "/design/table/nameCards-tag.webp" },
    { id: "acrylic", name: "Acrylic name", note: "Clear acrylic with the name", price: 9, unit: "per_child", photo: "/design/table/nameCards-acrylic.webp" },
  ] },
  { key: "partyHats", label: "Party hats", optional: true, options: [
    { id: "cone", name: "Cone hat", note: "The classic", price: 4, unit: "per_child", photo: "/design/table/partyHats-cone.webp" },
    { id: "crown", name: "Crown", note: "For little kings and queens", price: 6, unit: "per_child", photo: "/design/table/partyHats-crown.webp" },
    { id: "headband", name: "Headband", note: "Ears, horns or bows to match", price: 7, unit: "per_child", photo: "/design/table/partyHats-headband.webp" },
  ] },
];

/** The step's tabs, and the items in each. */
export const TABLE_TABS: { name: string; title: string; sub: string; items: TableItemKey[] }[] = [
  { name: "Table & chairs", title: "How many, and where they sit", sub: "Pick the table and the chairs — we work out how many.", items: ["table", "chairs"] },
  { name: "Linens", title: "Cloth, runner and napkins", sub: "Soft layers in your theme's colours.", items: ["tablecloth", "runner", "napkins"] },
  { name: "Tableware", title: "Plates, cups and cutlery", sub: "What every little guest eats and drinks from.", items: ["plates", "cups", "cutlery", "chargers"] },
  { name: "Decor & extras", title: "The finishing touches", sub: "Centrepieces, chair touches, name cards and hats.", items: ["centrepiece", "chairDecor", "nameCards", "partyHats"] },
];

export const tableItem = (key: TableItemKey) => TABLE_ITEMS.find((i) => i.key === key)!;
export const tableOption = (key: TableItemKey, id: string) => tableItem(key).options.find((o) => o.id === id);
