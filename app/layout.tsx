import type { Metadata, Viewport } from "next";
import { Kalam, Caveat, DM_Sans, Playfair_Display, Archivo_Black } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import "./blushy.css";

// 2026-10-22 redesign (design-reference/Blushy_Sparkly_Party_All_Steps_Matching_Landing.html):
// Kalam for playful headings, Caveat for the wordmark, DM Sans for everything
// functional. Self-hosted at build time by next/font and exposed as CSS
// variables that app/blushy.css reads.
const kalam = Kalam({ subsets: ["latin"], weight: ["300", "400", "700"], variable: "--bz-font-kalam", display: "swap" });
const caveat = Caveat({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--bz-font-caveat", display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--bz-font-dmsans", display: "swap" });
// The three lettering faces the render guide draws (lib/guideFontData.ts), so
// the Style tab and the live sketch show the same letters the render prints.
// 2026-10-25 (T0): Italianno (OFL) replaces Brittany Signature, whose licence
// allowed personal use only. Serif and Bold showed Georgia and DM Sans here
// while the guide drew Playfair Display and Archivo Black; they now match.
const signature = localFont({ src: "./fonts/Italianno-Regular.ttf", variable: "--bz-font-signature", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin", "latin-ext"], weight: ["400"], variable: "--bz-font-playfair", display: "swap", preload: false });
const archivoBlack = Archivo_Black({ subsets: ["latin", "latin-ext"], weight: ["400"], variable: "--bz-font-archivo", display: "swap", preload: false });

export const metadata: Metadata = {
  title: "PartyMuse by Blushy — Sparkly Party in Minutes",
  description: "Design your dream party backdrop and see it come to life.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${kalam.variable} ${caveat.variable} ${dmSans.variable} ${signature.variable} ${playfair.variable} ${archivoBlack.variable}`}>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className="bz-body antialiased">{children}</body>
    </html>
  );
}
