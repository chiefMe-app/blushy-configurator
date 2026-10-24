import type { Metadata, Viewport } from "next";
import { Kalam, Caveat, DM_Sans } from "next/font/google";
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
// 2026-10-24: Brittany Signature (Creatype Studio, supplied by the customer) —
// the script the renders print, now also shown in the Style tab and the sketch.
const brittany = localFont({ src: "./fonts/BrittanySignature.ttf", variable: "--bz-font-brittany", display: "swap" });

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
    <html lang="en" className={`${kalam.variable} ${caveat.variable} ${dmSans.variable} ${brittany.variable}`}>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className="bz-body antialiased">{children}</body>
    </html>
  );
}
