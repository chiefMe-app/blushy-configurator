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
- **Payment.** Payment is the last stage: checkout, then payment only after every supplier confirms, then staging. The
  mock payment must never look real.
