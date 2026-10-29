// The kids' table: every item the customer chooses, a few options each (plus
// "None" where an item is optional). Party favours are not here: they are
// Giveaways, a Decor part of their own (2026-10-27). It is a kids' party
// table (2026-10-27, the owner: "çocuk doğum günü olduğu belli olsun").
// 2026-10-28 the owner reshaped it from her favourite references: a plain
// cloth or none (none first), no runner, name cards or chair decorations;
// themed A3 placemats with the customer's own words on them; iridescent and
// foil plates, wooden cutlery, cutlery holders and water bottle labels.
// 2026-10-29 she trimmed it: the colour chair in white, pink or light blue
// only; plain or printed napkins; a plain placemat and a plain bottle label in
// a colour instead of the pattern ones; plain plates in a colour and a shape,
// or iridescent or silver foil; no white cup with a straw; the cone hat only. The
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
  /** Its picture comes in every colour of PLAIN_COLOURS (the kids' chair): /design/table/<item>/<id>/<hex>.webp. */
  colouredPhotos?: boolean;
  /** Offered only in these themes (a themed piece made for them so far). */
  themes?: string[];
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
    // 2026-10-28: "blue chair for kids'in her renk seçeneği olabilsin" — the id stays for saved tables.
    { id: "blue_kids", name: "Colour chair for kids", note: "Slatted back · white, pink or light blue", price: 25, unit: "per_child", photo: "/design/table/chairs-blue_kids.webp", coloured: true, colouredPhotos: true },
    { id: "bow_kids", name: "Bow chair for kids", note: "Pink, with a bow back", price: 25, unit: "per_child", photo: "/design/table/chairs-bow_kids.webp" },
  ] },
  // "Plain cloth ve none olsun, none seçili gelsin" (2026-10-28): the owner's tables show bare.
  { key: "tablecloth", label: "Tablecloth", optional: true, coloured: true, options: [
    { id: "classic", name: "Plain cloth", note: "Floor-length, in a colour", price: 40, unit: "per_table", photo: "/design/table/tablecloth-classic.webp" },
  ] },
  // Only the plain napkin takes a colour (2026-10-28: "renk koymaya gerek yok, plain peçete seçeneği koy, onda renk olsun").
  { key: "napkins", label: "Napkins", optional: false, options: [
    { id: "plain", name: "Plain napkins", note: "In a colour you pick", price: 1, unit: "per_child", coloured: true, photo: "/design/table/napkins-plain.webp" },
    { id: "printed", name: "Printed napkins", note: "In the theme's pattern", price: 2, unit: "per_child", photo: "/design/table/napkins-printed.webp" },
  ] },
  // A3 (42 × 29.7 cm), under the plate: the theme's design in three looks, like
  // the owner's references, with the customer's own words printed on it.
  { key: "placemats", label: "Placemats", optional: true, options: [
    { id: "plain", name: "Plain placemat", note: "A3 · in a colour you pick", price: 5, unit: "per_child", coloured: true },
    { id: "watercolour", name: "Watercolour placemat", note: "A3 · a soft wash, big shapes in the corners", price: 6, unit: "per_child", themed: true },
    { id: "sparkle", name: "Sparkle placemat", note: "A3 · glittering, room for a name", price: 6, unit: "per_child", themed: true },
  ] },
  // 2026-10-28 (owner): every place has a big plate with a small one on it
  // (2026-10-29: without the round card in the small one — "iyi durmuyor").
  // 2026-10-29 (owner): "iridescent, silver, gold metallic renk olarak girsin … başlık olmasın" — one kind
  // of plate and of cup, in a colour or a foil (FOILS), with no option cards.
  { key: "plates", label: "Plates", optional: false, options: [
    { id: "plain", name: "Paper plates", note: "Big + small, in a colour or foil and a shape you pick", price: 3, unit: "per_child", coloured: true },
  ] },
  { key: "cups", label: "Cups", optional: false, options: [
    { id: "plain", name: "Paper cups", note: "In a colour or foil you pick", price: 2, unit: "per_child", coloured: true },
  ] },
  { key: "cutlery", label: "Cutlery", optional: false, options: [
    { id: "dipped", name: "Colour-dipped wooden", note: "Handles dipped in pastel", price: 3, unit: "per_child", photo: "/design/table/cutlery-dipped.webp" },
    { id: "wooden", name: "Wooden", note: "Natural and disposable", price: 2, unit: "per_child", photo: "/design/table/cutlery-wooden.webp" },
    { id: "glitter", name: "Glitter-dipped wooden", note: "Handles dipped in silver glitter", price: 3, unit: "per_child", photo: "/design/table/cutlery-glitter.webp" },
  ] },
  { key: "cutleryHolder", label: "Cutlery holder", optional: true, options: [
    // One kind since 2026-10-28 (owner): a plain band in a colour, with a name or without.
    { id: "band", name: "Napkin band", note: "In a colour you pick · a name if you like", price: 4, unit: "per_child", photo: "/design/table/cutleryHolder-band.webp", coloured: true },
  ] },
  { key: "centrepiece", label: "Centrepiece", optional: true, options: [
    // Stand-ins: the owner sends her own centrepieces (2026-10-28).
    { id: "balloons", name: "Balloon bunch", note: "Mini balloons in the theme", price: 60, unit: "per_table", photo: "/design/table/centrepiece-balloons.webp" },
    { id: "florals", name: "Fresh florals", note: "A small, low arrangement", price: 90, unit: "per_table", photo: "/design/table/centrepiece-florals.webp" },
    { id: "toppers", name: "Theme toppers", note: "Stars and theme shapes on sticks", price: 40, unit: "per_table", photo: "/design/table/centrepiece-toppers.webp" },
    // 2026-10-29 (owner): "themed centerpiece, standing themed cutouts" — theme shapes, never characters; Frozen first (a pilot).
    { id: "cutouts", name: "Theme cutouts", note: "Little standing theme shapes", price: 45, unit: "per_table", themed: true, themes: ["frozen"] },
  ] },
  // A small water bottle wrapped in a 20.5 × 5 cm label in the placemats' designs, with
  // the customer's words — they see the finished label (2026-10-28: "tasarımın son halini görsün").
  { key: "bottleLabel", label: "Water bottle label", optional: true, options: [
    { id: "plain", name: "Plain label", note: "In a colour you pick", price: 4, unit: "per_child", coloured: true },
    { id: "watercolour", name: "Watercolour label", note: "A soft wash with big shapes", price: 5, unit: "per_child", themed: true, themedArt: "placemats" },
    { id: "sparkle", name: "Sparkle label", note: "Glittering and dreamy", price: 5, unit: "per_child", themed: true, themedArt: "placemats" },
  ] },
  { key: "partyHats", label: "Party hats", optional: true, options: [
    // In a colour you pick (2026-10-29).
    { id: "cone", name: "Cone hat", note: "The classic, in a colour you pick", price: 4, unit: "per_child", photo: "/design/table/partyHats-cone.webp", coloured: true },
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
/**
 * An option's picture; a themed one is the theme's own, and one that comes in
 * every colour (the kids' chair) is the chosen colour's.
 */
export const optionPhoto = (key: TableItemKey, o: TableOption | undefined, themeId: string, colour?: string) =>
  o?.themed ? `/design/table/${o.themedArt ?? key}/${themeId}/${o.id}.webp`
    : o?.colouredPhotos && colour && plainColour(colour) ? `/design/table/${key}/${o.id}/${colour.slice(1).toLowerCase()}.webp` : o?.photo;

/**
 * The colours a plain piece comes in (2026-10-28, owner: "her renk olsun,
 * pastel ve ana renkler genelde"): the pastels, then the main colours. The
 * names go into the render's words.
 */
export const PLAIN_COLOURS: { hex: string; name: string }[] = [
  { hex: "#FFFFFF", name: "white" }, { hex: "#F8BBD0", name: "pastel pink" }, { hex: "#FFD1A4", name: "pastel peach" },
  { hex: "#FEF08A", name: "pastel lemon yellow" }, { hex: "#BBF7D0", name: "pastel mint green" }, { hex: "#BAE6FD", name: "pastel baby blue" },
  { hex: "#DDD6FE", name: "pastel lilac" }, { hex: "#F5EDD6", name: "cream" },
  { hex: "#E53935", name: "bright red" }, { hex: "#EC407A", name: "hot pink" }, { hex: "#FB8C00", name: "bright orange" },
  { hex: "#FDD835", name: "sunny yellow" }, { hex: "#43A047", name: "bright green" }, { hex: "#38BDF8", name: "bright sky blue" },
  { hex: "#1E88E5", name: "royal blue" }, { hex: "#1E3A8A", name: "navy blue" }, { hex: "#8E24AA", name: "purple" },
  { hex: "#D4AF37", name: "gold" }, { hex: "#C0C4C8", name: "silver" }, { hex: "#1F2937", name: "black" },
];
/**
 * The foils the plates and cups also come in (2026-10-29, the owner:
 * "iridescent, silver, gold metallic renk olarak girsin"), kept in the colour
 * field by name. hex: a colour to draw them with where a drawing has no foil;
 * extra: what a foil adds to the piece's price, per child.
 */
export const FOILS = [
  { id: "iridescent", name: "iridescent foil", hex: "#E4D8F3", extra: 1, stops: ["#F7C6E3", "#DCC9F6", "#BFE0FA", "#C8F1E3", "#F2D0F1", "#CBD6FB"] },
  { id: "silver", name: "silver foil", hex: "#D5DAE0", extra: 0, stops: ["#F5F6F8", "#B6BCC5", "#EEF0F3", "#A7AEB8", "#F7F8FA", "#C3C8CF"] },
  { id: "gold", name: "gold foil", hex: "#D6B25A", extra: 1, stops: ["#FBE6A0", "#C99A2E", "#F6DB88", "#B7852A", "#FCEAAE", "#D2A646"] },
] as const;
export type Foil = (typeof FOILS)[number];
/** The items that come in foils too. */
export const FOIL_ITEMS: TableItemKey[] = ["plates", "cups"];
export const foilOf = (c: string | undefined) => FOILS.find((f) => f.id === c);
/** A colour to draw with: a foil's own, or the colour itself. */
export const drawColour = (c: string) => foilOf(c)?.hex ?? c;
/** A swatch's background: a foil's shimmer, or the colour. */
export const swatchBackground = (c: string) => { const f = foilOf(c); return f ? `linear-gradient(135deg, ${f.stops.join(", ")})` : c; };

export const plainColour = (hex: string) => PLAIN_COLOURS.find((c) => c.hex.toUpperCase() === hex.toUpperCase());
/** The chosen table sits the children on floor cushions: no chairs to choose or pay for. */
export const onFloor = (choices: Record<TableItemKey, string>) => !!tableOption("table", choices.table)?.floor;


/** The colour chair's colours (2026-10-29, the owner: "sadece beyaz, pembe, açık mavi olsun"); its own blue is the light blue. */
export const CHAIR_COLOURS = ["#FFFFFF", "#F8BBD0", "#38BDF8"];
/** The plain plates' shapes (2026-10-29: "tabaklarda da renk ve şekil seçeneği olsun"). */
export type PlateShape = "round" | "scalloped" | "square";
export const PLATE_SHAPES: { id: PlateShape; name: string; words: string }[] = [
  { id: "round", name: "Round", words: "round" },
  { id: "scalloped", name: "Scalloped", words: "round with a wavy scalloped edge" },
  { id: "square", name: "Square", words: "square with softly rounded corners" },
];
