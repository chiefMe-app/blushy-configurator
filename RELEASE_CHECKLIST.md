# Before release

Things switched off or left as placeholders while the site is being built. Each one must be put back before the
website is released.

- **Render limits.** Since 2026-11-03 renders have no daily limit, per account or per IP. The owner said: "şimdilik
  açık sınırsız olacak şekilde, release öncesi düzeltilecekler arasına not al". Set `RENDER_LIMITS=1` on Vercel to turn
  them back on: 20 a day per account (`RENDER_LIMIT_PER_USER_DAY`), plus 40 a day and 10 per 10 minutes per IP. The
  code is in `lib/renderGuard.ts` and `lib/renderAccount.ts`. Some limits stay on even now: sign-in, the kill switch
  (`RENDERS_DISABLED`), the daily cap for everyone (`RENDER_DAILY_CAP`, 400) and 3 renders at a time per IP.
- **Render before Finalize.** Since 2026-11-03, Finalize doesn't wait for a render. Set `NEXT_PUBLIC_REQUIRE_RENDER=1`
  on Vercel (`lib/renderGate.ts`). Then flip the e2e checks that expect Finalize enabled without a render: F1, F13,
  renderKids, W1, W3, G1.
- **Prices.** The placeholder prices need the owner's real ones: table options, welcome board, giveaways, piñata,
  cake & sweets, the sweet cart and the Customized Themed set.
- **Payment.** Since 2026-11-05 the Review step ends in a DEMO payment (`lib/availability.ts`,
  `components/builder/steps/ReviewStep.tsx`): no card is asked for, the order is saved with
  `extras.payment = { mode: "demo", status: "authorized" }` and every supplier "waiting". Before release: a real
  provider's hosted page (authorize on pay, capture only after every supplier confirms, void if one can't), the
  suppliers' confirm links, and take the "DEMO" notes away. The demo must never look real until then.
- **Availability.** We do it can be paid only on a date the setup team is free. For now that is a demo check: any day
  at least `MIN_LEAD_DAYS` (3, a placeholder) ahead. It needs the owner's real lead time and her real calendar.
