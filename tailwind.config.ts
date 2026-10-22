import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Accent is driven at runtime via the --accent CSS variable (set per theme)
        accent: "rgb(var(--accent) / <alpha-value>)",
        "accent-soft": "rgb(var(--accent-soft) / <alpha-value>)",
        warmwhite: "#FBF8F6",
      },
      fontFamily: {
        // 2026-10-22 redesign: DM Sans is the functional face everywhere.
        sans: ["var(--bz-font-dmsans)", "DM Sans", "system-ui", "sans-serif"],
        // Handwritten display face for headings (Kalam) and the wordmark (Caveat).
        hand: ["var(--bz-font-kalam)", "Kalam", "Segoe Print", "cursive"],
        logo: ["var(--bz-font-caveat)", "Caveat", "Segoe Script", "cursive"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
