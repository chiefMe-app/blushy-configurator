// Balloon colour sets (2026-11-02, the owner: "renk demeti çeşitleri koyalım balonlara. pastel tone opsiyon 1
// desin bide bright color opsiyon 2 olsun … onu seçince komple balon rengi değişsin heryerde"). Every theme
// offers its colours in two sets, Pastel tones and Bright colours; picking one sets the whole party's balloons
// (the garland, the table, the welcome board all read decor.balloonColors). One of the two is the theme's
// own palette; the other is made from it, each colour swapped for its nearest shade on the other side, or
// set by hand where a theme has a photographed set of its own (Unicorn's bright one is her reference's).
import { SEMPERTEX_CATALOG, type SempertexColor } from "./sempertexCatalog";
import { getThemeCatalogEntry } from "./themeCatalog";

export type BalloonSetId = "pastel" | "bright";
export const BALLOON_SETS: { id: BalloonSetId; option: number; label: string; blurb: string }[] = [
  { id: "pastel", option: 1, label: "Pastel tones", blurb: "Soft, dreamy matte shades" },
  { id: "bright", option: 2, label: "Bright colours", blurb: "Vivid, joyful party shades" },
];

/** Sets chosen by hand: a theme's photographed sets (see LiveSketch's THEME_SHOTS), kept as shot. */
const BY_HAND: Record<string, Partial<Record<BalloonSetId, string[]>>> = {
  // Her reference (a wavy unicorn board): hot pink, orange, sunny yellow, mint and purple.
  unicorn: { bright: ["fashion-012-fuchsia", "fashion-061-orange", "fashion-020-yellow", "satin-430-green", "fashion-050-lilac"] },
  frozen: { bright: ["fashion-005-white", "fashion-041-royal-blue", "fashion-038-caribbean-blue", "reflex-951-violet", "reflex-981-silver"] },
};

const byId = (id: string) => SEMPERTEX_CATALOG.find((c) => c.id === id);
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
function hsl(hex: string) {
  const [r, g, b] = rgb(hex), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = d === 0 ? 0 : mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return { h, s, l };
}
/** White, clear, silver, gold, black and the browns: the same in both sets. */
const isNeutral = (c: SempertexColor) => ["white", "silver", "gold", "black", "neutral"].includes(c.family) || hsl(c.hex).s < 0.15;
/** A pastel: pale and soft (Pastel Matte, Pastel Dusk, the pale silks and satins). */
const isPastel = (c: SempertexColor) => !isNeutral(c) && hsl(c.hex).l >= 0.72;
/** A bright: a strong fashion colour, not neon (neon reads harsh in a garland). */
const isBright = (c: SempertexColor) => !isNeutral(c) && !/neon/i.test(c.finish) && hsl(c.hex).l < 0.72 && hsl(c.hex).s >= 0.5;

const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
/** The colour on the other side nearest in hue, not one already taken. */
function counterpart(c: SempertexColor, to: BalloonSetId, taken: Set<string>): SempertexColor {
  const want = hsl(c.hex);
  const pool = SEMPERTEX_CATALOG.filter((o) => (to === "bright" ? isBright(o) : isPastel(o)) && !taken.has(o.id));
  // Pastel Matte first when going soft, Fashion first when going bright: the shades she stocks most.
  const pref = (o: SempertexColor) => (to === "pastel" ? /pastel matte/i.test(o.finish) : /fashion/i.test(o.finish)) ? 0 : 6;
  return pool.sort((a, b) => hueGap(hsl(a.hex).h, want.h) + pref(a) - (hueGap(hsl(b.hex).h, want.h) + pref(b)))[0] ?? c;
}

/** Whether a palette reads pastel (most of its colours pale) or bright. */
export function paletteKind(ids: string[]): BalloonSetId {
  const cols = ids.map(byId).filter((c): c is SempertexColor => !!c && !isNeutral(c));
  if (!cols.length) return "pastel";
  return cols.filter(isPastel).length * 2 >= cols.length ? "pastel" : "bright";
}

/** The same for colours given as hex (a scene's balloons): pastel when most of its coloured ones are pale. */
export function hexPaletteKind(hexes: string[]): BalloonSetId {
  const cols = hexes.filter((h) => /^#[0-9a-f]{6}$/i.test(h)).map(hsl).filter((c) => c.s >= 0.15);
  if (!cols.length) return "pastel";
  return cols.filter((c) => c.l >= 0.72).length * 2 >= cols.length ? "pastel" : "bright";
}

/** A theme's two sets, as Sempertex ids. */
export function themeBalloonSets(themeId: string, fallback: string[] = []): Record<BalloonSetId, string[]> {
  const own = getThemeCatalogEntry(themeId)?.sempertexPaletteIds;
  const base = own?.length ? own : fallback;
  const kind = paletteKind(base);
  const other: BalloonSetId = kind === "pastel" ? "bright" : "pastel";
  const taken = new Set(base);
  const made = base.map((id) => {
    const c = byId(id);
    if (!c || isNeutral(c) || (other === "bright" ? isBright(c) : isPastel(c))) return id;
    const o = counterpart(c, other, taken);
    taken.add(o.id);
    return o.id;
  });
  const sets = { [kind]: base, [other]: made } as Record<BalloonSetId, string[]>;
  return { ...sets, ...BY_HAND[themeId] };
}

/** Which of a theme's sets these colours are, if either. */
export function matchingBalloonSet(themeId: string, ids: string[], fallback: string[] = []): BalloonSetId | null {
  const sets = themeBalloonSets(themeId, fallback);
  const key = [...ids].sort().join();
  return (Object.keys(sets) as BalloonSetId[]).find((k) => [...sets[k]].sort().join() === key) ?? null;
}

/** Hex colours of a set, in its order (for swatches and decor.balloonColors). */
export const setHexes = (ids: string[]) => ids.map((id) => byId(id)?.hex).filter((h): h is string => !!h);
