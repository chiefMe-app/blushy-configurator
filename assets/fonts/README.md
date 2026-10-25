# Lettering fonts (Typography System)

These fonts are vendored from the official [google/fonts](https://github.com/google/fonts) repository at one pinned commit (`fonts.lock.json`).

- Every family is **SIL Open Font License 1.1**. Its `OFL.txt` sits next to the font files and must stay with them.
- Each file's SHA-256 is recorded in `fonts.lock.json`.

| Step | Command | Output |
|---|---|---|
| Download / check | `npm run typography:fetch` · `npm run typography:verify` | `assets/fonts/<dir>/` |
| Qualify (licence, Turkish coverage, shaping vs Edge, strokes, joins) | `npm run typography:qualify` | `lib/typography/fonts.generated.json`, `test-results/typography/t1-contact-sheet.png` |
| Web fonts (WOFF2 subsets, features kept, shaping verified) | `npm run typography:webfonts` | `public/fonts/typography/` |
| Report (thinnest stroke in mm per finish) | `npm run typography:report` | `test-results/typography/t1-report.md` |

**Adding a font:**
1. Add a line to `FAMILIES` in `scripts/typography/fetch-fonts.mjs`.
2. Add an entry to `lib/typography/registry.ts`.
3. Run fetch → qualify → webfonts.
4. Commit the results.

`tests/unit/typography.t1.test.ts` fails if anything is missing, stale or not OFL.

Production limits in `lib/typography/production.ts` are **provisional**. They are the plan's starting assumptions and must be confirmed by the producer.
