// Isolated typography demo (Typography System, T2): the real lettering engine
// on the Single Round photo. Not linked from the Builder, not indexed, and not
// served on the production deployment.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TypographyDemo from "@/components/typography-demo/TypographyDemo";
import { FONTS, FONT_CATEGORIES, cssFamily, fontVariants } from "@/lib/typography/registry";
import { PRESETS, DEFAULT_PRESET_ID } from "@/lib/typography/presets";
import { FINISHES } from "@/lib/typography/production";
import { DEMO_BOX, DEMO_PHOTO, MAX_TEXT } from "@/lib/typography/demo";

export const metadata: Metadata = {
  title: "Typography demo — PartyMuse by Blushy",
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
    weights: f.weights.map((w) => w.weight),
    optical: (f.optical ?? []).map((o) => ({ id: o.id, label: o.label, default: !!o.default })),
    css: Object.fromEntries(fontVariants(f).map((v) => [v.key, cssFamily(v)])),
  }));
  return (
    <TypographyDemo
      fonts={fonts}
      categories={FONT_CATEGORIES}
      presets={PRESETS.map((p) => ({ id: p.id, number: p.number, name: p.name, featured: !!p.featured, headingFont: p.headingFont, nameFont: p.nameFont }))}
      defaultPresetId={DEFAULT_PRESET_ID}
      finishes={FINISHES.map((f) => ({ id: f.id, label: f.label }))}
      box={DEMO_BOX}
      photo={DEMO_PHOTO}
      maxText={MAX_TEXT}
    />
  );
}
