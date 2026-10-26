// Isolated typography demo: the real lettering engine on the Single Round
// photo, with only the customer's choices — Heading and Name font, size,
// colour and position, in vinyl. Not linked from the Builder, not indexed, and
// not served on the production deployment.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TypographyDemo from "@/components/typography-demo/TypographyDemo";
import { FONTS, FONT_CATEGORIES, cssFamily, fontVariants } from "@/lib/typography/registry";
import { PRESETS, DEFAULT_PRESET_ID } from "@/lib/typography/presets";
import { DEMO_BOX, DEMO_PHOTO, MAX_TEXT } from "@/lib/typography/demo";

export const metadata: Metadata = {
  title: "Your lettering — PartyMuse by Blushy",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default function TypographyDemoPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  const fonts = FONTS.map((f) => ({
    id: f.id,
    family: f.family,
    category: f.category,
    bestFor: f.bestFor,
    legacyOnly: !!f.legacyOnly,
    defaultWeight: f.defaultWeight,
    // Always-on features (lining figures), so tiles match the engine.
    features: (f.features ?? []).map((t) => `"${t}" 1`).join(", "),
    // The font's default cut at its default weight (e.g. Bodoni Moda's display cut).
    css: cssFamily(fontVariants(f).find((v) => v.weight.weight === f.defaultWeight && (!v.optical || v.optical.default))!),
  }));
  return (
    <TypographyDemo
      fonts={fonts}
      categories={FONT_CATEGORIES}
      presets={PRESETS.map((p) => ({ id: p.id, number: p.number, name: p.name, featured: !!p.featured, headingFont: p.headingFont, nameFont: p.nameFont }))}
      defaultPresetId={DEFAULT_PRESET_ID}
      box={DEMO_BOX}
      photo={DEMO_PHOTO}
      maxText={MAX_TEXT}
    />
  );
}
