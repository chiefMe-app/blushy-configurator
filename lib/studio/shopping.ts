// The DIY package's shopping list and supplier list (2026-11-04): every piece she makes herself, sorted by the kind of
// shop that sells it (no estimated prices: the owner, "estimated fiyatı kaldır"). The owner sends her own suppliers later; until then each
// kind of shop is named by what it is, never by a shop we made up.
import { diyPieceOf, priceBreakdown, type BuilderConfig, type PriceLine } from "@/lib/config";

export type SupplierId = "balloons" | "print" | "party" | "rental" | "florist" | "neon" | "bakery" | "pinata";

export interface Supplier {
  id: SupplierId;
  name: string;
  /** What to ask for there. */
  note: string;
  /** The owner's recommended shops, once she sends them. */
  shops: string[];
}

export const SUPPLIERS: Supplier[] = [
  { id: "balloons", name: "Balloon shop", note: "Sempertex balloons and helium — ask for the colour codes on your list.", shops: [] },
  { id: "print", name: "Print shop", note: "Boards, banners, standees and prints — bring the print files from your Design Pack.", shops: [] },
  { id: "party", name: "Party supply shop", note: "Plates, cups, napkins, cutlery and the little table pieces.", shops: [] },
  // No rental shop to send her to for one plinth: we rent ours (DIY "Plinths & stands to rent"), or she uses what she has.
  { id: "rental", name: "Plinths & stands", note: "Rent them from us in the DIY package, or use a side table or boxes you have.", shops: [] },
  { id: "florist", name: "Florist", note: "Fresh flowers and greenery for the garland.", shops: [] },
  { id: "neon", name: "Neon sign maker", note: "The LED neon sign with your words.", shops: [] },
  { id: "bakery", name: "Cake designer", note: "Show them your cake picture: the tiers, the colours and the topper.", shops: [] },
  { id: "pinata", name: "Piñata maker", note: "Your piñata's shape, colours and how it opens.", shops: [] },
];

/** Where a piece is bought: the backdrop's lines by what they are, the other pieces by the piece. */
export function supplierFor(l: Pick<PriceLine, "label" | "section">): SupplierId {
  switch (l.section) {
    case "table": case "adults": return "party";
    case "welcome": case "giveaways": return "print";
    case "pinata": return "pinata";
    case "cake": return "bakery";
    case "helium": return "balloons";
  }
  if (/florals|greenery/i.test(l.label)) return "florist";
  if (/neon/i.test(l.label)) return "neon";
  if (diyPieceOf(l) === "rental") return "rental";
  if (/balloon/i.test(l.label)) return "balloons";
  return "print";
}

const PIECE: Record<string, string> = {
  design: "Backdrop", table: "Kids' table", adults: "Grown-ups' table", welcome: "Welcome board",
  giveaways: "Giveaways", pinata: "Piñata", cake: "Cake & sweets", helium: "Helium balloons",
};

export interface ShoppingItem { piece: string; label: string; amount: number }
export interface ShoppingGroup { supplier: Supplier; items: ShoppingItem[]; total: number }

/** Her party's shopping in DIY, by shop, in the order of SUPPLIERS; what we bring and the empty shops are left out. */
export function shoppingList(config: BuilderConfig): { groups: ShoppingGroup[]; total: number } {
  const { shopping } = priceBreakdown({ ...config, servicePackageId: "diy" });
  const groups = SUPPLIERS.map((supplier) => {
    const items = shopping.filter((l) => supplierFor(l) === supplier.id)
      .map((l) => ({ piece: PIECE[l.section] ?? "", label: l.label, amount: l.amount }));
    return { supplier, items, total: items.reduce((t, i) => t + i.amount, 0) };
  }).filter((g) => g.items.length > 0);
  return { groups, total: groups.reduce((t, g) => t + g.total, 0) };
}
