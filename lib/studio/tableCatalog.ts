// The kids' table: every item the customer chooses, three options each (plus
// "None" where an item is optional). 2026-10-27: the owner picks the real
// options — replace a name, price or picture here and the step follows:
//   - name / note: what the card says;
//   - price, unit: AED per table, per child or once (placeholder prices for now);
//   - photo: a picture in /public (e.g. "/design/table/napkins-bow.webp"); until
//     one is given, the card shows a drawn placeholder.
export type TableItemKey =
  | "table" | "chairs"
  | "tablecloth" | "runner" | "napkins"
  | "plates" | "cups" | "cutlery" | "chargers"
  | "centrepiece" | "chairDecor" | "nameCards" | "favourBoxes" | "partyHats";

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
    { id: "long", name: "Long table", note: "180 × 60 cm · 8 kids · joined into rows", price: 80, unit: "per_table" },
    { id: "round", name: "Round table", note: "⌀ 120 cm · 8 kids", price: 80, unit: "per_table" },
    { id: "square", name: "Square table", note: "100 × 100 cm · 8 kids", price: 80, unit: "per_table" },
  ] },
  { key: "chairs", label: "Chairs", optional: false, options: [
    { id: "white_kids", name: "White kids' chairs", note: "Classic and light", price: 5, unit: "per_child" },
    { id: "gold_chiavari", name: "Gold chiavari", note: "Little ballroom chairs", price: 10, unit: "per_child" },
    { id: "clear_ghost", name: "Clear ghost chairs", note: "See-through acrylic", price: 13, unit: "per_child" },
  ] },
  { key: "tablecloth", label: "Tablecloth", optional: false, coloured: true, options: [
    { id: "classic", name: "Classic cloth", note: "Floor-length, smooth", price: 40, unit: "per_table" },
    { id: "ruffle", name: "Ruffled skirt", note: "Frilled all the way round", price: 70, unit: "per_table" },
    { id: "sequin", name: "Sequin cloth", note: "A little sparkle", price: 90, unit: "per_table" },
  ] },
  { key: "runner", label: "Runner", optional: true, coloured: true, options: [
    { id: "tulle", name: "Tulle runner", note: "Soft and airy", price: 30, unit: "per_table" },
    { id: "sequin", name: "Sequin runner", note: "Shimmering stripe", price: 45, unit: "per_table" },
    { id: "greenery", name: "Greenery garland", note: "Leaves down the middle", price: 60, unit: "per_table" },
  ] },
  { key: "napkins", label: "Napkins", optional: false, coloured: true, options: [
    { id: "folded", name: "Folded cotton", note: "Neatly folded on the plate", price: 4, unit: "per_child" },
    { id: "printed", name: "Printed paper", note: "In the theme's pattern", price: 2, unit: "per_child" },
    { id: "bow", name: "Bow-tied", note: "Tied with a ribbon bow", price: 6, unit: "per_child" },
  ] },
  { key: "plates", label: "Plates", optional: false, options: [
    { id: "themed", name: "Themed plates", note: "In the theme's colours", price: 6, unit: "per_child" },
    { id: "white_gold", name: "White & gold", note: "White with a gold rim", price: 8, unit: "per_child" },
    { id: "pastel", name: "Pastel melamine", note: "Soft pastel mix", price: 5, unit: "per_child" },
  ] },
  { key: "cups", label: "Cups", optional: false, options: [
    { id: "straw", name: "Cups with straws", note: "Paper cup, striped straw", price: 3, unit: "per_child" },
    { id: "gold_rim", name: "Gold-rim cups", note: "Clear with a gold edge", price: 5, unit: "per_child" },
    { id: "lidded", name: "Lidded cups", note: "No spills, little lids", price: 4, unit: "per_child" },
  ] },
  { key: "cutlery", label: "Cutlery", optional: false, options: [
    { id: "wooden", name: "Wooden", note: "Natural and light", price: 2, unit: "per_child" },
    { id: "gold", name: "Gold", note: "Shiny gold set", price: 4, unit: "per_child" },
    { id: "pastel", name: "Pastel", note: "Soft colours to match", price: 2, unit: "per_child" },
  ] },
  { key: "chargers", label: "Charger plates", optional: true, options: [
    { id: "gold", name: "Gold chargers", note: "Under every plate", price: 6, unit: "per_child" },
    { id: "rattan", name: "Rattan chargers", note: "Woven and warm", price: 6, unit: "per_child" },
    { id: "beaded", name: "Clear beaded", note: "Glass with a bead edge", price: 7, unit: "per_child" },
  ] },
  { key: "centrepiece", label: "Centrepiece", optional: true, options: [
    { id: "balloons", name: "Balloon bunch", note: "Mini balloons in the theme", price: 60, unit: "per_table" },
    { id: "florals", name: "Fresh florals", note: "Low arrangement", price: 90, unit: "per_table" },
    { id: "toppers", name: "Theme toppers", note: "Stars and characters on sticks", price: 40, unit: "per_table" },
  ] },
  { key: "chairDecor", label: "Chair decoration", optional: true, options: [
    { id: "tulle_bow", name: "Tulle bow", note: "On every chair back", price: 6, unit: "per_child" },
    { id: "balloon", name: "Balloon tie", note: "A balloon on every chair", price: 5, unit: "per_child" },
    { id: "name_flag", name: "Name flag", note: "A little flag with the name", price: 7, unit: "per_child" },
  ] },
  { key: "nameCards", label: "Name cards", optional: true, options: [
    { id: "tent", name: "Tent card", note: "Folded card at each plate", price: 4, unit: "per_child" },
    { id: "tag", name: "Round tag", note: "Tied to the napkin", price: 4, unit: "per_child" },
    { id: "acrylic", name: "Acrylic name", note: "Clear acrylic with the name", price: 9, unit: "per_child" },
  ] },
  { key: "favourBoxes", label: "Party favours", optional: true, options: [
    { id: "box", name: "Gift box", note: "A little box with a bow", price: 15, unit: "per_child" },
    { id: "bag", name: "Treat bag", note: "Clear bag of sweets", price: 10, unit: "per_child" },
    { id: "bucket", name: "Mini bucket", note: "Filled with surprises", price: 18, unit: "per_child" },
  ] },
  { key: "partyHats", label: "Party hats", optional: true, options: [
    { id: "cone", name: "Cone hat", note: "The classic", price: 4, unit: "per_child" },
    { id: "crown", name: "Crown", note: "For little kings and queens", price: 6, unit: "per_child" },
    { id: "headband", name: "Headband", note: "Ears, horns or bows to match", price: 7, unit: "per_child" },
  ] },
];

/** The step's tabs, and the items in each. */
export const TABLE_TABS: { name: string; title: string; sub: string; items: TableItemKey[] }[] = [
  { name: "Table & chairs", title: "How many, and where they sit", sub: "Pick the table and the chairs — we work out how many.", items: ["table", "chairs"] },
  { name: "Linens", title: "Cloth, runner and napkins", sub: "Soft layers in your theme's colours.", items: ["tablecloth", "runner", "napkins"] },
  { name: "Tableware", title: "Plates, cups and cutlery", sub: "What every little guest eats and drinks from.", items: ["plates", "cups", "cutlery", "chargers"] },
  { name: "Decor & extras", title: "The finishing touches", sub: "Centrepieces and a little something at every seat.", items: ["centrepiece", "chairDecor", "nameCards", "favourBoxes", "partyHats"] },
];

export const tableItem = (key: TableItemKey) => TABLE_ITEMS.find((i) => i.key === key)!;
export const tableOption = (key: TableItemKey, id: string) => tableItem(key).options.find((o) => o.id === id);
