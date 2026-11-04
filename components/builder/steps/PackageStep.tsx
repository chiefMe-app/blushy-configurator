// Step 5 · Package (2026-11-04, the owner: "only two"): she has designed everything, so the only question left is
// who makes it. DIY: she does, with our shopping list and supplier list. We do it: we make it, deliver it, set it
// up and collect it. Shown on the right, beside her finished designs.
import { SERVICE_PACKAGES, formatAED, priceBreakdown, type BuilderConfig, type ServicePackageId } from "@/lib/config";
import { experiencesTotal } from "@/lib/studio/experiences";
import { shoppingList } from "@/lib/studio/shopping";
import { StepShell } from "@/components/builder/ui";

const Tick = () => (
  <span className="mt-[3px]" style={{ color: "#ff0d66" }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
);

export default function PackageStep({ config, setServicePackage }: { config: BuilderConfig; setServicePackage: (id: ServicePackageId) => void }) {
  const shop = shoppingList(config);
  const exp = config.experiences?.picked.length ? experiencesTotal(config.experiences) : 0;
  const expCount = config.experiences?.picked.length ?? 0;
  const diy = config.servicePackageId === "diy";
  // The theme's own price (its artwork), in both packages; the only "design" line DIY keeps.
  const themeLine = priceBreakdown({ ...config, servicePackageId: "diy" }).lines.find((l) => l.section === "design");

  return (
    <StepShell title="Who makes your party?" subtitle="Your designs stay as they are — pick who makes them.">
      <div className="bz-pk-cards" role="radiogroup" aria-label="Package">
        {SERVICE_PACKAGES.map((p) => {
          const on = config.servicePackageId === p.id;
          const b = priceBreakdown({ ...config, servicePackageId: p.id });
          const total = b.total;
          return (
            <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => setServicePackage(p.id)}
              className={`bz-choice bz-pk-card ${on ? "selected" : ""}`} data-testid={`package-${p.id}`}>
              {on && <span className="tick">✓</span>}
              <span className="bz-pk-tag">{p.tagline}</span>
              <h3>{p.name}</h3>
              <ul>
                {p.includes.map((line) => <li key={line}><Tick /><span>{line}</span></li>)}
              </ul>
              <dl className="bz-pk-sum">
                <div><dt>{p.id === "diy" ? "Design fee" : "Delivery, setup & collection"}</dt><dd>AED {formatAED(p.price)}</dd></div>
                {p.id === "we_do_it" && shop.total > 0 && <div><dt>Your pieces, made by us</dt><dd>AED {formatAED(shop.total)}</dd></div>}
                {themeLine && <div><dt>{themeLine.label}</dt><dd>AED {formatAED(themeLine.amount)}</dd></div>}
                {exp > 0 && <div><dt>{expCount} experience{expCount > 1 ? "s" : ""}</dt><dd>AED {formatAED(exp)}</dd></div>}
                <div className="total"><dt>You pay us</dt><dd data-testid={`package-total-${p.id}`}>AED {formatAED(total)}</dd></div>
                {p.id === "diy" && shop.total > 0 && <div className="shops"><dt>+ your shopping, at the shops</dt><dd>≈ AED {formatAED(shop.total)}</dd></div>}
              </dl>
            </button>
          );
        })}
      </div>

      {diy ? (
        <section className="bz-pk-panel" aria-label="Your shopping list" data-testid="shopping-list">
          <h3>Your shopping list</h3>
          {shop.groups.length ? <>
            <p className="sub">Everything you designed, by the shop that sells it. The full list, with quantities and balloon codes, comes in your Design Pack.</p>
            {shop.groups.map((g) => (
              <div key={g.supplier.id} className="bz-pk-shop" data-testid={`shop-${g.supplier.id}`}>
                <div className="head"><b>{g.supplier.name}</b><span>≈ AED {formatAED(g.total)}</span></div>
                <p className="note">{g.supplier.note}</p>
                {g.supplier.shops.length > 0 && <p className="note">Our picks: {g.supplier.shops.join(" · ")}</p>}
                <ul>
                  {g.items.map((i, n) => <li key={n}><span><em>{i.piece}</em> {i.label}</span><span>≈ AED {formatAED(i.amount)}</span></li>)}
                </ul>
              </div>
            ))}
            <p className="bz-pk-foot">≈ AED {formatAED(shop.total)} at the shops — you buy these yourself. Estimates, the shops set their own prices.</p>
          </> : <p className="sub">Nothing to buy yet — design a piece in Decor and it is listed here.</p>}
          {expCount > 0 && <p className="bz-pk-foot">Your {expCount} experience{expCount > 1 ? "s are" : " is"} still booked by us — AED {formatAED(exp)}.</p>}
        </section>
      ) : (
        <section className="bz-pk-panel" aria-label="How it goes" data-testid="we-do-it-steps">
          <h3>How it goes</h3>
          <ol className="bz-pk-steps">
            <li><b>We make every piece</b><span>As you designed it: the backdrop, the tables, the boards, the balloons.</span></li>
            <li><b>We deliver and set it up</b><span>Before the party, at your venue — you pick the time on the next step.</span></li>
            <li><b>You enjoy the party</b><span>{expCount > 0 ? `Your ${expCount} experience${expCount > 1 ? "s" : ""} arrive${expCount > 1 ? "" : "s"} on time too.` : "Nothing to carry, nothing to build."}</span></li>
            <li><b>We collect it after</b><span>We take everything down and away when the party is over.</span></li>
          </ol>
        </section>
      )}

      {/* 2026-10-27 (Phase 1.3): what the Design Pack holds, as a file to look at; it comes with both packages. */}
      <a className="bz-sample-pack" href="/api/packs/sample" download data-testid="sample-pack">
        <span className="icon" aria-hidden="true"><svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 2v8m0 0l-3.5-3.5M8 10l3.5-3.5M3 13.5h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
        <span><b>See what you receive:</b> download a free sample Design Pack — specification PDF, lists and a labelled visual reference.</span>
      </a>
    </StepShell>
  );
}
