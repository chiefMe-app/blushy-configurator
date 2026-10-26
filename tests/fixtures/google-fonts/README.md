# Captured Google Fonts (test fixtures)

These are the stylesheets and font files that `next/font/google` downloads for the app's UI fonts: Kalam, Caveat, DM Sans, Playfair Display and Archivo Black.

- They were captured with `scripts/golden/capture-google-fonts.mjs`.
- The e2e test server reads them through `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` (set in `playwright.config.ts`), so screenshots don't depend on an internet connection.
- The app itself is unchanged and still gets these fonts from Google at build time.

All five families are licensed under the SIL Open Font License 1.1. Their licences are at `https://github.com/google/fonts/tree/main/ofl/<family>/OFL.txt`.
