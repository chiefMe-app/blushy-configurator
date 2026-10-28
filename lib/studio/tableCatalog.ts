// The kids' table: every item the customer chooses, a few options each (plus
// "None" where an item is optional). Party favours are not here: they are
// Giveaways, a Decor part of their own (2026-10-27). It is a kids' party
// table (2026-10-27, the owner: "çocuk doğum günü olduğu belli olsun … şu an
// çok adult gibi"): printed paper, disposable plastic, confetti and hats.
// Charger plates, gold chairs and cotton napkins belong to the grown-ups'
// table; their drawings stay in glyphs.tsx for it. The owner picks the real
// options — replace a name, price or picture here and the step follows:
//   - name / note: what the card says;
//   - price, unit: AED per table, per child or once (placeholder prices for now);
//   - photo: a picture in /public/design/table. The tables and chairs are the
//     owner's own photos and prices (2026-10-28: "her opsiyonun görselini
//     vereceğim"); the other pictures are still AI-made stand-ins until hers
//     come (no characters or logos). Without a photo, the card shows a drawing.
//     The close-up render is made from these pictures (lib/studio/tableRender.ts).
export type TableItemKey =
  | "table" | "chairs"
  | "tablecloth" | "runner" | "napkins"
  | "placemats" | "plates" | "cups" | "cutlery" | "chargers"
  | "centrepiece" | "chairDecor" | "nameCards" | "partyHats";

export type PriceUnit = "per_table" | "per_child";

export interface TableOption {
  id: string;
  name: string;
  note: string;
  price: number;
  unit: PriceUnit;
  photo?: string;
  /** A table: how many children sit at one. */
  seats?: number;
  /** A table the children sit at on floor cushions (no chairs). */
  floor?: boolean;
}

export interface TableItem {
  key: TableItemKey;
  label: string;
  /** Optional items have a "None" choice before the options. */
  optional: boolean;
  /** The item takes a colour (the cloth, the runner, the napkins). */
  coloured?: boolean;
  options: TableOption[];
}

export const NONE = "none";

export const TABLE_ITEMS: TableItem[] = [
  { key: "table", label: "Table", optional: false, options: [
    { id: "standard", name: "Standard table", note: "Long and white · 10 kids", price: 399, unit: "per_table", seats: 10, photo: "/design/table/table-standard.webp" },
    { id: "half_wave", name: "Half wave table", note: "A gentle S-curve · 8 kids", price: 499, unit: "per_table", seats: 8, photo: "/design/table/table-half_wave.webp" },
    { id: "flower", name: "Flower table", note: "Six petals · 6 kids", price: 399, unit: "per_table", seats: 6, photo: "/design/table/table-flower.webp" },
    { id: "round", name: "Round table", note: "One big circle · 16 kids", price: 999, unit: "per_table", seats: 16, photo: "/design/table/table-round.webp" },
    { id: "low", name: "Low table", note: "Floor cushions, no chairs · 10 kids", price: 749, unit: "per_table", seats: 10, floor: true, photo: "/design/table/table-low.webp" },
    { id: "cloud", name: "Cloud table", note: "Soft wavy edges · 10 kids", price: 499, unit: "per_table", seats: 10, photo: "/design/table/table-cloud.webp" },
  ] },
  { key: "chairs", label: "Chairs", optional: false, options: [
    { id: "white_kids", name: "White chair for kids", note: "Oval back, with arms", price: 25, unit: "per_child", photo: "/design/table/chairs-white_kids.webp" },
    { id: "blue_kids", name: "Blue chair for kids", note: "Bright blue, slatted back", price: 25, unit: "per_child", photo: "/design/table/chairs-blue_kids.webp" },
    { id: "bow_kids", name: "Bow chair for kids", note: "Pink, with a bow back", price: 25, unit: "per_child", photo: "/design/table/chairs-bow_kids.webp" },
  ] },
  { key: "tablecloth", label: "Tablecloth", optional: false, coloured: true, options: [
    { id: "printed", name: "Printed party cover", note: "In the theme's pattern", price: 25, unit: "per_table", photo: "/design/table/tablecloth-printed.webp" },
    { id: "classic", name: "Plain cloth", note: "Floor-length, in a colour", price: 40, unit: "per_table", photo: "/design/table/tablecloth-classic.webp" },
    { id: "ruffle", name: "Ruffled skirt", note: "Frilled all the way round", price: 70, unit: "per_table", photo: "/design/table/tablecloth-ruffle.webp" },
  ] },
  { key: "runner", label: "Runner", optional: true, coloured: true, options: [
    { id: "tulle", name: "Tulle runner", note: "Soft and airy", price: 30, unit: "per_table", photo: "/design/table/runner-tulle.webp" },
    { id: "sequin", name: "Sequin runner", note: "Shimmering stripe", price: 45, unit: "per_table", photo: "/design/table/runner-sequin.webp" },
    { id: "confetti", name: "Confetti & curls", note: "Scattered down the middle", price: 20, unit: "per_table", photo: "/design/table/runner-confetti.webp" },
  ] },
  { key: "napkins", label: "Napkins", optional: false, coloured: true, options: [
    { id: "printed", name: "Printed paper", note: "In the theme's pattern", price: 2, unit: "per_child", photo: "/design/table/napkins-printed.webp" },
    { id: "plain", name: "Coloured paper", note: "Folded into triangles", price: 1, unit: "per_child", photo: "/design/table/napkins-plain.webp" },
    { id: "bow", name: "Bow-tied", note: "Tied with a ribbon bow", price: 6, unit: "per_child", photo: "/design/table/napkins-bow.webp" },
  ] },
  { key: "placemats", label: "Placemats", optional: true, options: [
    { id: "printed", name: "Printed placemat", note: "In the theme's pattern", price: 3, unit: "per_child", photo: "/design/table/placemats-printed.webp" },
    { id: "shaped", name: "Shaped placemat", note: "Cut in a theme shape", price: 5, unit: "per_child", photo: "/design/table/placemats-shaped.webp" },
    { id: "name", name: "Name placemat", note: "A space for each child's name", price: 5, unit: "per_child", photo: "/design/table/placemats-name.webp" },
  ] },
  { key: "plates", label: "Plates", optional: false, options: [
    { id: "themed", name: "Printed paper plates", note: "In the theme's pattern", price: 3, unit: "per_child", photo: "/design/table/plates-themed.webp" },
    { id: "scalloped", name: "Scalloped plates", note: "Wavy edge, pastel paper", price: 3, unit: "per_child", photo: "/design/table/plates-scalloped.webp" },
    { id: "shaped", name: "Shaped plates", note: "Cut in a theme shape", price: 4, unit: "per_child", photo: "/design/table/plates-shaped.webp" },
  ] },
  { key: "cups", label: "Cups", optional: false, options: [
    { id: "straw", name: "Cups with straws", note: "Paper cup, striped straw", price: 3, unit: "per_child", photo: "/design/table/cups-straw.webp" },
    { id: "printed", name: "Printed paper cups", note: "In the theme's pattern", price: 2, unit: "per_child", photo: "/design/table/cups-printed.webp" },
    { id: "pouch", name: "Juice pouches", note: "A little drink at every seat", price: 4, unit: "per_child", photo: "/design/table/cups-pouch.webp" },
  ] },
  { key: "cutlery", label: "Cutlery", optional: false, options: [
    { id: "pastel", name: "Pastel plastic", note: "Disposable, in a soft colour", price: 1, unit: "per_child", photo: "/design/table/cutlery-pastel.webp" },
    { id: "wooden", name: "Wooden", note: "Disposable, natural and light", price: 2, unit: "per_child", photo: "/design/table/cutlery-wooden.webp" },
    { id: "silver", name: "Silver-look plastic", note: "Disposable, with a shine", price: 2, unit: "per_child", photo: "/design/table/cutlery-silver.webp" },
  ] },
  { key: "centrepiece", label: "Centrepiece", optional: true, options: [
    { id: "balloons", name: "Balloon bunch", note: "Mini balloons in the theme", price: 60, unit: "per_table", photo: "/design/table/centrepiece-balloons.webp" },
    { id: "florals", name: "Fresh florals", note: "Low arrangement", price: 90, unit: "per_table", photo: "/design/table/centrepiece-florals.webp" },
    { id: "toppers", name: "Theme toppers", note: "Stars and theme shapes on sticks", price: 40, unit: "per_table", photo: "/design/table/centrepiece-toppers.webp" },
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
  { name: "Tableware", title: "Placemats, plates, cups and cutlery", sub: "Party paper and plastic for every little guest.", items: ["placemats", "plates", "cups", "cutlery"] },
  { name: "Decor & extras", title: "The finishing touches", sub: "Centrepieces, chair touches, name cards and hats.", items: ["centrepiece", "chairDecor", "nameCards", "partyHats"] },
];

export const tableItem = (key: TableItemKey) => TABLE_ITEMS.find((i) => i.key === key)!;
// An item may not be offered at the kids' table (charger plates): it has no options then.
export const tableOption = (key: TableItemKey, id: string) => TABLE_ITEMS.find((i) => i.key === key)?.options.find((o) => o.id === id);
/** The chosen table sits the children on floor cushions: no chairs to choose or pay for. */
export const onFloor = (choices: Record<TableItemKey, string>) => !!tableOption("table", choices.table)?.floor;
