// The kids' table: every item the customer chooses, a few options each (plus
// "None" where an item is optional). Party favours are not here: they are
// Giveaways, a Decor part of their own (2026-10-27). It is a kids' party
// table (2026-10-27, the owner: "çocuk doğum günü olduğu belli olsun").
// 2026-10-28 the owner reshaped it from her favourite references: a plain
// cloth or none (none first), no runner, name cards or chair decorations;
// themed A3 placemats with the customer's own words on them; iridescent and
// foil plates, wooden cutlery, cutlery holders and water bottle labels. The
// runner, chair decorations, name cards and charger plates keep their keys
// and drawings (glyphs.tsx) for the grown-ups' table, but are not offered
// here. The owner picks the real options — replace a name, price or picture
// here and the step follows:
//   - name / note: what the card says;
//   - price, unit: AED per table, per child or once (placeholder prices for now);
//   - photo: a picture in /public/design/table (`themed`: one per theme, in
//     /public/design/table/<item>/<theme>/<id>.webp). The tables and chairs are the
//     owner's own photos and prices (2026-10-28: "her opsiyonun görselini
//     vereceğim"); the other pictures are still AI-made stand-ins until hers
//     come (no characters or logos). Without a photo, the card shows a drawing.
//     The close-up render is made from these pictures (lib/studio/tableRender.ts).
export type TableItemKey =
  | "table" | "chairs"
  | "tablecloth" | "runner" | "napkins"
  | "placemats" | "plates" | "cups" | "cutlery" | "chargers"
  | "cutleryHolder" | "bottleLabel"
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
  /** The picture is the theme's own (see optionPhoto). */
  themed?: boolean;
  /** A themed picture borrowed from another item's designs (the bottle labels wear the placemats'). */
  themedArt?: TableItemKey;
  /** This option takes a colour (the plain napkin). */
  coloured?: boolean;
}

export interface TableItem {
  key: TableItemKey;
  label: string;
  /** Optional items have a "None" choice before the options. */
  optional: boolean;
  /** Every option of the item takes a colour (the cloth). */
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
  // "Plain cloth ve none olsun, none seçili gelsin" (2026-10-28): the owner's tables show bare.
  { key: "tablecloth", label: "Tablecloth", optional: true, coloured: true, options: [
    { id: "classic", name: "Plain cloth", note: "Floor-length, in a colour", price: 40, unit: "per_table", photo: "/design/table/tablecloth-classic.webp" },
  ] },
  // Only the plain napkin takes a colour (2026-10-28: "renk koymaya gerek yok, plain peçete seçeneği koy, onda renk olsun").
  { key: "napkins", label: "Napkins", optional: false, options: [
    { id: "plain", name: "Plain napkins", note: "In a colour you pick", price: 1, unit: "per_child", coloured: true, photo: "/design/table/napkins-plain.webp" },
    { id: "striped", name: "Striped napkins", note: "Soft pastel stripes", price: 1, unit: "per_child", photo: "/design/table/napkins-striped.webp" },
    { id: "printed", name: "Printed napkins", note: "In the theme's pattern", price: 2, unit: "per_child", photo: "/design/table/napkins-printed.webp" },
    { id: "foil", name: "Silver foil napkins", note: "Pale blue with a silver foil print", price: 2, unit: "per_child", photo: "/design/table/napkins-foil.webp" },
  ] },
  // A3 (42 × 29.7 cm), under the plate: the theme's design in three looks, like
  // the owner's references, with the customer's own words printed on it.
  { key: "placemats", label: "Placemats", optional: true, options: [
    { id: "pattern", name: "Pattern placemat", note: "A3 · the theme's shapes all over", price: 6, unit: "per_child", themed: true },
    { id: "watercolour", name: "Watercolour placemat", note: "A3 · a soft wash, big shapes in the corners", price: 6, unit: "per_child", themed: true },
    { id: "sparkle", name: "Sparkle placemat", note: "A3 · glittering, room for a name", price: 6, unit: "per_child", themed: true },
  ] },
  { key: "plates", label: "Plates", optional: false, options: [
    { id: "iridescent", name: "Iridescent foil plate", note: "Shimmering foil, with corners", price: 4, unit: "per_child", photo: "/design/table/plates-iridescent.webp" },
    { id: "holo_square", name: "Holographic square plate", note: "Silver holographic foil", price: 4, unit: "per_child", photo: "/design/table/plates-holo_square.webp" },
    { id: "silver", name: "Silver foil plate", note: "Round, with a fluted rim", price: 3, unit: "per_child", photo: "/design/table/plates-silver.webp" },
  ] },
  { key: "cups", label: "Cups", optional: false, options: [
    { id: "white_straw", name: "White cup, silver straw", note: "Paper cup with a paper straw", price: 2, unit: "per_child", photo: "/design/table/cups-white_straw.webp" },
    { id: "iridescent", name: "Iridescent cup", note: "Shimmering foil finish", price: 3, unit: "per_child", photo: "/design/table/cups-iridescent.webp" },
    { id: "pastel", name: "Pastel cup", note: "Soft matte colour", price: 2, unit: "per_child", photo: "/design/table/cups-pastel.webp" },
  ] },
  { key: "cutlery", label: "Cutlery", optional: false, options: [
    { id: "dipped", name: "Colour-dipped wooden", note: "Handles dipped in pastel", price: 3, unit: "per_child", photo: "/design/table/cutlery-dipped.webp" },
    { id: "wooden", name: "Wooden", note: "Natural and disposable", price: 2, unit: "per_child", photo: "/design/table/cutlery-wooden.webp" },
    { id: "glitter", name: "Glitter-dipped wooden", note: "Handles dipped in silver glitter", price: 3, unit: "per_child", photo: "/design/table/cutlery-glitter.webp" },
  ] },
  { key: "cutleryHolder", label: "Cutlery holder", optional: true, options: [
    { id: "pocket", name: "Printed pocket", note: "A card pocket in the theme, with a name", price: 5, unit: "per_child", photo: "/design/table/cutleryHolder-pocket.webp" },
    { id: "band", name: "Napkin band", note: "Wraps the napkin, with a name tag", price: 4, unit: "per_child", photo: "/design/table/cutleryHolder-band.webp" },
    { id: "tag", name: "Ribbon & tag", note: "Tied with a ribbon and a scalloped tag", price: 3, unit: "per_child", photo: "/design/table/cutleryHolder-tag.webp" },
  ] },
  { key: "centrepiece", label: "Centrepiece", optional: true, options: [
    // Stand-ins: the owner sends her own centrepieces (2026-10-28).
    { id: "balloons", name: "Balloon bunch", note: "Mini balloons in the theme", price: 60, unit: "per_table", photo: "/design/table/centrepiece-balloons.webp" },
    { id: "florals", name: "Fresh florals", note: "A small, low arrangement", price: 90, unit: "per_table", photo: "/design/table/centrepiece-florals.webp" },
    { id: "toppers", name: "Theme toppers", note: "Stars and theme shapes on sticks", price: 40, unit: "per_table", photo: "/design/table/centrepiece-toppers.webp" },
  ] },
  // A small water bottle wrapped in a 20.5 × 5 cm label in the placemats' designs, with
  // the customer's words — they see the finished label (2026-10-28: "tasarımın son halini görsün").
  { key: "bottleLabel", label: "Water bottle label", optional: true, options: [
    { id: "pattern", name: "Pattern label", note: "The theme's shapes all over", price: 5, unit: "per_child", themed: true, themedArt: "placemats" },
    { id: "watercolour", name: "Watercolour label", note: "A soft wash with big shapes", price: 5, unit: "per_child", themed: true, themedArt: "placemats" },
    { id: "sparkle", name: "Sparkle label", note: "Glittering and dreamy", price: 5, unit: "per_child", themed: true, themedArt: "placemats" },
  ] },
  { key: "partyHats", label: "Party hats", optional: true, options: [
    { id: "cone", name: "Cone hat", note: "The classic", price: 4, unit: "per_child", photo: "/design/table/partyHats-cone.webp" },
    { id: "crown", name: "Crown", note: "For little kings and queens", price: 6, unit: "per_child", photo: "/design/table/partyHats-crown.webp" },
    { id: "headband", name: "Headband", note: "Ears, horns or bows to match", price: 7, unit: "per_child", photo: "/design/table/partyHats-headband.webp" },
  ] },
];

/** The step's sections, all on one page (2026-10-28: "aynı sayfada olsun, next next diye geçmeyelim"). */
export const TABLE_SECTIONS: { name: string; items: TableItemKey[] }[] = [
  { name: "Table & chairs", items: ["table", "chairs"] },
  { name: "Linens", items: ["tablecloth", "napkins"] },
  { name: "Tableware", items: ["placemats", "plates", "cups", "cutlery", "cutleryHolder"] },
  { name: "Decor & extras", items: ["centrepiece", "bottleLabel", "partyHats"] },
];

export const tableItem = (key: TableItemKey) => TABLE_ITEMS.find((i) => i.key === key)!;
// An item may not be offered at the kids' table (charger plates): it has no options then.
export const tableOption = (key: TableItemKey, id: string) => TABLE_ITEMS.find((i) => i.key === key)?.options.find((o) => o.id === id);
/** An option's picture; a themed one is the theme's own. */
export const optionPhoto = (key: TableItemKey, o: TableOption | undefined, themeId: string) =>
  o?.themed ? `/design/table/${o.themedArt ?? key}/${themeId}/${o.id}.webp` : o?.photo;
/** The chosen table sits the children on floor cushions: no chairs to choose or pay for. */
export const onFloor = (choices: Record<TableItemKey, string>) => !!tableOption("table", choices.table)?.floor;
