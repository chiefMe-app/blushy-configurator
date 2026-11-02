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
  { id: "bright", option: 2, label: "Bright colours", blurb: "Cheerful matte shades" },
];

/** Sets chosen by hand: a theme's photographed sets (see LiveSketch's THEME_SHOTS), kept as shot. */
const BY_HAND: Record<string, Partial<Record<BalloonSetId, string[]>>> = {
  // 2026-11-02, the owner, by name: "bright colorda sempertex katalogtan peach, fashion rose, pastel green,
  // pastel lilac" (after rosewood, melon, satin green and fashion lilac: "bu renklerde istemiyorum"). No
  // Fashion Rose in the catalog: Pastel Dusk Rose 110 was the rose, until later that day she named the pink
  // herself: "Sempertex Fashion 017 Fuchsia".
  unicorn: { bright: ["fashion-060-peach-blush", "fashion-017-fuchsia", "pastel-matte-630-green", "pastel-matte-650-lilac"] },
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

/** The same for colours given as hex (a scene's balloons): pastel when most of its coloured ones are pale.
 *  Paler than isPastel's line: Unicorn's bright set is peach and lavender as well as rose and mint. */
export function hexPaletteKind(hexes: string[]): BalloonSetId {
  const cols = hexes.filter((h) => /^#[0-9a-f]{6}$/i.test(h)).map(hsl).filter((c) => c.s >= 0.15);
  if (!cols.length) return "pastel";
  return cols.filter((c) => c.l >= 0.78).length * 2 >= cols.length ? "pastel" : "bright";
}

/**
 * Which set a scene's balloons are: one of its theme's sets when they are that set's colours (Unicorn's
 * bright set is as pale as its pastel one, so lightness cannot tell them apart), else by lightness.
 */
export function sceneBalloonSet(themeId: string | undefined, hexes: string[]): BalloonSetId {
  const key = (hs: string[]) => Array.from(new Set(hs.filter((h) => /^#[0-9a-f]{6}$/i.test(h) && hsl(h).s >= 0.15).map((h) => h.toUpperCase()))).sort().join();
  if (themeId) {
    const sets = themeBalloonSets(themeId);
    const k = (["bright", "pastel"] as const).find((id) => key(setHexes(sets[id])) === key(hexes));
    if (k) return k;
  }
  return hexPaletteKind(hexes);
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

/** The Customized Themed set's balloons: its photo's, which are the theme's pastel set and a shiny Reflex
 *  Violet (2026-11-02, the owner: "balonlar aynı değil seçeneklerdekiyle, parlak bir mor da var. selected
 *  balonlara onu da ekleyelim"). The set is shown as photographed, so these are its only colours. */
export const themedSetBalloons = (themeId: string, fallback: string[] = []) =>
  Array.from(new Set([...themeBalloonSets(themeId, fallback).pastel, "reflex-951-violet"]));

/** Which of a theme's sets these colours are, if either. */
export function matchingBalloonSet(themeId: string, ids: string[], fallback: string[] = []): BalloonSetId | null {
  const sets = themeBalloonSets(themeId, fallback);
  const key = [...ids].sort().join();
  return (Object.keys(sets) as BalloonSetId[]).find((k) => [...sets[k]].sort().join() === key) ?? null;
}

/** Hex colours of a set, in its order (for swatches and decor.balloonColors). */
export const setHexes = (ids: string[]) => ids.map((id) => byId(id)?.hex).filter((h): h is string => !!h);
