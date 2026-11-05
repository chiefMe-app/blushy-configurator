// Step 7 · Review, then the payment (2026-11-05): what stands before she can pay — her details and, We do it, a date
// the setup team is free on — and when she is charged: only once every supplier has confirmed. A DEMO until release:
// no card is asked for, and nothing is charged (lib/availability.ts, RELEASE_CHECKLIST.md).
import { MAX_NOTES, cleanNotes, formatAED, priceBreakdown, type BuilderConfig } from "@/lib/config";
import { niceDate, partySuppliers, paymentBlockers, setupAvailability } from "@/lib/availability";
import ReviewSummary from "@/components/ReviewSummary";
import { StepShell } from "@/components/builder/ui";

export default function ReviewStep({ config, submitError, setNotes }: { config: BuilderConfig; submitError: string | null; setNotes?: (notes: string) => void }) {
  const diy = config.servicePackageId === "diy";
  const blockers = paymentBlockers(config);
  const details = config.customer.name.trim().length > 1 && config.customer.whatsapp.trim().length >= 7;
  const free = setupAvailability(config.venue.date);
  const suppliers = partySuppliers(config);
  const total = priceBreakdown(config).total;
  return (
    <StepShell title="Review & pay">
      <div className="bz-tip"><span className="icon">✳</span><span>Ta-da! Here’s what you’ve created 🎉</span><span className="arrow">↙</span></div>
      <div className="space-y-4">
        {/* Includes the detailed price breakdown (PriceSummary, the existing pricing engine). */}
        <ReviewSummary config={config} />

        {/* 2026-11-05 (the owner: "müşteri biyere notlarını yazabilmeli designla ilgili yapmamızı istediği bişiler varsa
            ekstra"): anything else for the design, in her own words — it goes to the team with the order. */}
        {setNotes && (
          <label className="bz-notes" data-testid="design-notes">
            <span>Notes for our design team <small>(optional)</small></span>
            <textarea value={config.notes ?? ""} maxLength={MAX_NOTES} rows={4} data-testid="design-notes-input"
              placeholder="Anything else you'd like us to do — a colour to match, a name to spell a special way, a surprise to add…"
              onChange={(e) => setNotes(cleanNotes(e.target.value))} />
            <small>{(config.notes ?? "").length} / {MAX_NOTES}</small>
          </label>
        )}

        <section className="bz-pay" aria-label="Payment" data-testid="payment">
          <p className="bz-pay-demo" role="note" data-testid="payment-demo">
            <b>DEMO — no real payment.</b> No card is asked for and nothing is charged. Real payment comes later, on our
            payment partner&apos;s secure page.
          </p>
          <h3>Before you pay</h3>
          <ul className="bz-pay-checks">
            <li className={details ? "ok" : "no"} data-testid="payment-check-details">
              <span className="mark" aria-hidden="true">{details ? "✓" : "•"}</span>
              {details ? "Your name and WhatsApp number" : "Add your name and WhatsApp number in the Venue step"}
            </li>
            {!diy && (
              <li className={free.ok ? "ok" : "no"} data-testid="payment-check-date">
                <span className="mark" aria-hidden="true">{free.ok ? "✓" : "•"}</span>
                {free.ok ? <>PartyMuse is free on {niceDate(free.date)}</> : `${free.message.replace(/\.$/, "")} — in the Venue step`}
              </li>
            )}
          </ul>
          <h3>When you&apos;re charged</h3>
          <p className="sub">
            Paying holds AED {formatAED(total)} on your card. It is charged only once {suppliers.length > 1 ? "every one of them has" : suppliers.length ? "they have" : "we have"} confirmed your date — if one can&apos;t, we tell you before anything is charged.
          </p>
          {suppliers.length > 0 && (
            <ul className="bz-pay-suppliers" data-testid="payment-suppliers">
              {suppliers.map((s) => <li key={s.id}><span>{s.name}</span><small>confirms after you pay</small></li>)}
            </ul>
          )}
          {blockers.length > 0 && <p className="bz-pay-wait" data-testid="payment-blocked">{blockers[0]}</p>}
        </section>
        {submitError && (
          <p className="text-center text-xs text-red-500">{submitError}</p>
        )}
      </div>
    </StepShell>
  );
}
