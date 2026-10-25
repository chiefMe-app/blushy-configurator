# Tests — Phase 0.0 safety net

These tests record how the builder behaves **today**. Every later change
(starting with T0, the Brittany Signature replacement) is measured against
them: a difference is either an approved, listed change or a bug.

## What runs, and what it never touches

| Suite | Command | What it checks |
|---|---|---|
| Unit golden | `npm run test:unit` | Prices (`priceBreakdown`, `computeTotal`), scene model, lettering (line split, guide face, Turkish fallback, 63 legacy texts), order format |
| Render golden | `npm run test:golden` | Render guide PNG (SHA-256) + prompt for 45 fixtures, through the real render route's no-fal debug path |
| E2E | `npm run test:e2e` | Safety locks, UI ↔ fixture body parity, flows F1–F10 on desktop (1905×880) and mobile (375×812) with screenshots |

- **No paid call, no stored data.** Vitest runs with an empty Supabase config
  and a placeholder `FAL_KEY`. Supabase and fal are mocked in the tests that
  load them. Playwright starts its own dev server on port 3100 with **every
  key empty** (Next.js does not let `.env.local` override a variable that is
  already set, even to `""`). The browser lock (`tests/e2e/guard.ts`) aborts
  any request leaving the machine, and stops `/api/orders` and `/api/generate*`
  before they reach the server. `00-safety.spec.ts` proves all of this
  first; if it fails, nothing else should be trusted.
- **`.next` conflict:** never run the e2e suite (or `npm run build`) while
  another `next dev` is running in this folder. Stop it first.

## Fixtures

- `fixtures/configs.ts` lists ~45 named configs:
  - every setup
  - board lettering in each style and size, ordinals, Turkish, name-only and free phrases
  - the legacy `decor.backdropText`
  - colours
  - extras
- `fixtures/builder.ts` builds them the way the builder UI does.
  `e2e/body-parity.spec.ts` proves the UI sends the same render body.
- `fixtures/legacyTexts.ts` holds 63 texts with the split a future Heading/Name parser
  should produce. It is data only for now (the typography plan's T2 acceptance set).

## Updating baselines — only for an approved, listed change

```bash
npx vitest run -u                              # unit snapshots
GOLDEN_UPDATE=1 npx vitest run tests/golden    # render guide + prompt (PowerShell: $env:GOLDEN_UPDATE=1)
npx playwright test --update-snapshots         # screenshots
npm run test:sheet                             # contact sheet of the last golden run
```

Review the diff of `tests/**/__snapshots__`, `tests/golden/render/**` and
`tests/e2e/__screenshots__/**` before committing it.

## Baseline changes

**T0 — Brittany Signature → Italianno (2026-10-25).** The baselines were updated on purpose. Everything else is identical to Phase 0.0.

- **Render guides:** 37 of 45 changed; every one of them carries script lettering or a neon sign.
  - The 8 guides without either did not change: Serif, Bold and the bare ring.
  - Prompts changed in 0 fixtures.
- **Lettering snapshot:** only the script face's widths and outlines changed.
  - 10 texts (the Turkish ones) moved from the Sacramento fallback to Italianno.
  - Line splitting is unchanged.
- **Screenshots:**
  - The Style tab now shows the faces the render prints: Italianno, Playfair Display and Archivo Black.
  - The sketch lettering and the neon sign are set in Italianno.
- **Pricing, scene model and order format:** unchanged.

## Known issues recorded as today's behaviour (Phase 0.0, 2026-10-25)

1. ~~Saved order total misses the theme surcharge.~~ **Fixed on 2026-10-25,
   branch `fix-order-theme-total`.**
   - **Cause:** `submit()` did not send `themeSelected`, so `/api/orders`
     recomputed the total without the theme line.
   - **Fix:** the server now charges the theme for any valid theme.
   - **Regression tests:** "saved total = the total the customer saw" in
     `unit/orders.contract.test.ts`, and F1.
2. **Long lettering runs under the garland.** Texts that `messageLines` does not
   split are wrapped word by word. On Single Round their first line is drawn
   beneath the balloons, for example:
   - "Happy 1st Birthday Layla"
   - "İyi ki doğdun Ayşe Gül"

   See the render golden B06 and B08 guides.
