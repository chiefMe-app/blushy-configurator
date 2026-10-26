// Loads a registry font variant into HarfBuzz (Typography System, T2).
// Server side only: reads the vendored TTFs from assets/fonts/. One HarfBuzz
// font per (font, weight, optical version), cached for the process.
import fs from "fs";
import path from "path";
import * as hb from "harfbuzzjs";
import { resolveVariant, type FontVariant } from "./registry";

const ASSETS = path.join(process.cwd(), "assets/fonts");

export interface LoadedFont {
  variant: FontVariant;
  font: hb.Font;
  upem: number;
  /** In em: cap height (from "H"), ascender and descender (descender negative). */
  capHeightEm: number;
  ascenderEm: number;
  descenderEm: number;
  features: hb.Feature[];
  /** True when the font has a glyph for this code point. */
  has(codePoint: number): boolean;
}

const cache = new Map<string, LoadedFont>();
const blobs = new Map<string, Uint8Array>();

export function loadFont(fontId: string, weight: number, optical?: string): LoadedFont {
  const variant = resolveVariant(fontId, weight, optical);
  if (!variant) throw new Error(`unknown font variant ${fontId}@${weight}${optical ? `/${optical}` : ""}`);
  const cacheKey = `${fontId}@${variant.key}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  const file = path.join(ASSETS, variant.font.dir, variant.weight.file);
  const data = blobs.get(file) ?? new Uint8Array(fs.readFileSync(file));
  blobs.set(file, data);
  const face = new hb.Face(new hb.Blob(data));
  const font = new hb.Font(face);
  const info = face.getAxisInfos();
  const vars: hb.Variation[] = [];
  for (const [tag, v] of Object.entries(variant.axes)) {
    const a = info[tag];
    if (!a) throw new Error(`${fontId}: no ${tag} axis`);
    vars.push(new hb.Variation(tag, v === "max" ? a.max : Math.min(a.max, Math.max(a.min, v))));
  }
  if (vars.length) font.setVariations(vars);

  const upem = face.upem;
  const H = font.nominalGlyph(0x48);
  const ext = H ? font.glyphExtents(H) : undefined;
  const hx = font.hExtents();
  const loaded: LoadedFont = {
    variant,
    font,
    upem,
    capHeightEm: ext ? ext.yBearing / upem : 0.7,
    ascenderEm: hx.ascender / upem,
    descenderEm: hx.descender / upem,
    features: (variant.font.features ?? []).map((t) => new hb.Feature(t, 1)),
    has: (cp) => font.nominalGlyph(cp) !== undefined,
  };
  cache.set(cacheKey, loaded);
  return loaded;
}
