// Step 5 · Package (2026-11-04, the owner: "only two"): she has designed everything, so the only question left is
// who makes it. DIY: she does, with our files, shopping list and supplier list, and adds what she would still like
// from us (her experiences, the cake, the balloons, plinths to rent). We do it: we make it, deliver it, set it up and
// collect it. Shown on the right, beside her finished designs.
import { DIY_PIECES, SERVICE_PACKAGES, diyPieceOf, formatAED, priceBreakdown, type BuilderConfig, type DiyChoices, type DiyPiece, type ServicePackageId } from "@/lib/config";
import { EXPERIENCES, experiencePrice, type Experience } from "@/lib/studio/experiences";
import { StepShell } from "@/components/builder/ui";

const Tick = () => (
  <span className="mt-[3px]" style={{ color: "#ff0d66" }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
);

// The packages' headings (the owner: "daha renkli, daha canlı … bu görselleri kullan"): hand-painted pictures made for
// us in the style of her references (scripts/packages), under a pastel bunting drawn after the one she sent. The
// bicycle is the delivery ("delivery yapıyoruz vibe'ı").
const PORTRAIT: Record<ServicePackageId, { src: string; alt: string }> = {
  diy: { src: "/design/packages/diy.webp", alt: "A paper bunting being made, with a paintbrush and ribbon" },
  we_do_it: { src: "/design/packages/we-do-it.webp", alt: "A bicycle delivering balloons, flowers, a gift and a cake" },
};
// The DIY "from us" rows' pictures: the bouquet for the helium balloons, the flowered cake for the cake & sweets.
const PIECE_PIC: Record<DiyPiece, string> = {
  cake: "/design/packages/cake.webp", helium: "/design/packages/helium-bouquet.webp",
  pinata: "/design/pinata/butterfly.webp", rental: "/design/ui/extra-plinths.webp",
};
const FLAGS = ["#e6b8c0", "#a8e4f7", "#f7d9a8", "#7fc3b0", "#fbe6b0", "#9fe6d4", "#f59a8a", "#d48cc8"];

function Bunting() {
  // One string, sagging between two bows, its flags hanging straight down from it.
  const y = (x: number) => 8 + 14 * Math.sin((Math.PI * x) / 300);
  return (
    <svg className="bunting" viewBox="0 0 300 40" preserveAspectRatio="none" aria-hidden="true">
      <path d={`M4 ${y(4)} ${Array.from({ length: 30 }, (_, i) => `L${(i + 1) * 10} ${y((i + 1) * 10).toFixed(1)}`).join(" ")}`} fill="none" stroke="#7183b8" strokeWidth="1.6" />
      {FLAGS.map((c, i) => {
        const x = 26 + i * 35;
        return <path key={i} d={`M${x - 10} ${y(x - 10).toFixed(1)} L${x + 10} ${y(x + 10).toFixed(1)} L${x} ${(y(x) + 20).toFixed(1)} Z`} fill={c} opacity=".92" />;
      })}
      <path d="M4 8c-3-5-6 1-1 1m1-1c3-5 6 1 1 1M4 8l-2 7M4 8l3 6" fill="none" stroke="#7183b8" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M296 8c-3-5-6 1-1 1m1-1c3-5 6 1 1 1M296 8l-3 6M296 8l2 7" fill="none" stroke="#7183b8" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export default function PackageStep({ config, setServicePackage, setDiy }: {
  config: BuilderConfig;
  setServicePackage: (id: ServicePackageId) => void;
  setDiy: (d: DiyChoices) => void;
}) {
  const diy = config.servicePackageId === "diy";
  const choices: DiyChoices = config.diy ?? { bring: [], skipExperiences: [] };
  const all = priceBreakdown({ ...config, servicePackageId: "we_do_it" }).lines;

  // What DIY can still have from us: the experiences she picked, and the pieces she designed that we can bring.
  const x = config.experiences;
  const experiences = (x?.picked ?? []).map((id) => EXPERIENCES.find((e) => e.id === id)).filter((e): e is Experience => !!e);
  const pieces = DIY_PIECES.map((p) => ({ ...p, price: all.filter((l) => diyPieceOf(l) === p.id).reduce((t, l) => t + l.amount, 0) }))
    .filter((p) => p.price > 0);
  const bringing = (id: DiyPiece) => choices.bring.includes(id);
  const keeping = (id: string) => !choices.skipExperiences.includes(id);
  const togglePiece = (id: DiyPiece) => setDiy({ ...choices, bring: bringing(id) ? choices.bring.filter((b) => b !== id) : [...choices.bring, id] });
  const toggleExperience = (id: string) => setDiy({ ...choices, skipExperiences: keeping(id) ? [...choices.skipExperiences, id] : choices.skipExperiences.filter((s) => s !== id) });
  const fromUs = [
    ...experiences.filter((e) => keeping(e.id)).map((e) => ({ name: e.name, price: experiencePrice(e, x!) })),
    ...pieces.filter((p) => bringing(p.id)).map((p) => ({ name: p.name, price: p.price })),
  ];

  const row = (key: string, pic: string, name: string, note: string, price: number, on: boolean, toggle: () => void) => (
    <li key={key} className={on ? "on" : ""} data-testid={`diy-${key}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="pic" src={pic} alt="" loading="lazy" />
      <span className="txt"><b>{name}</b><small>{note}</small></span>
      <span className="price">AED {formatAED(price)}</span>
      <button type="button" aria-pressed={on} onClick={toggle} aria-label={`${on ? "Remove" : "Add"} ${name}`}>{on ? "Remove" : "+ Add"}</button>
    </li>
  );

  return (
    <StepShell title="Who makes your party?" subtitle="Your designs stay as they are — pick who makes them.">
      <div className="bz-pk-cards" role="radiogroup" aria-label="Package">
        {SERVICE_PACKAGES.map((p) => {
          const on = config.servicePackageId === p.id;
          const total = priceBreakdown({ ...config, servicePackageId: p.id }).total;
          const pieceTotal = all.filter((l) => l.section !== "package" && l.section !== "experiences").reduce((t, l) => t + l.amount, 0);
          const expTotal = all.filter((l) => l.section === "experiences").reduce((t, l) => t + l.amount, 0);
          return (
            <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => setServicePackage(p.id)}
              className={`bz-choice bz-pk-card ${on ? "selected" : ""}`} data-testid={`package-${p.id}`}>
              {on && <span className="tick">✓</span>}
              <span className={`bz-pk-head ${p.id}`}>
                <Bunting />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="art" src={PORTRAIT[p.id].src} alt={PORTRAIT[p.id].alt} />
                <span className="words">
                  <span className="bz-pk-tag">{p.tagline} <i aria-hidden="true">✳</i></span>
                  <h3>{p.name}</h3>
                  <svg className="squiggle" viewBox="0 0 120 10" aria-hidden="true"><path d="M2 6c12-5 22 4 34 0s22-5 34 0 22 4 34 0 10-3 14-2" /></svg>
                </span>
              </span>
              <ul>
                {p.includes.map((line) => <li key={line}><Tick /><span>{line}</span></li>)}
              </ul>
              <dl className="bz-pk-sum">
                <div><dt>{p.id === "diy" ? "Design files & lists" : "Delivery, setup & collection"}</dt><dd>AED {formatAED(p.price)}</dd></div>
                {p.id === "diy" ? fromUs.map((f) => <div key={f.name} className="from-us"><dt>+ {f.name}</dt><dd>AED {formatAED(f.price)}</dd></div>) : <>
                  {pieceTotal > 0 && <div><dt>Your designs, made by us</dt><dd>AED {formatAED(pieceTotal)}</dd></div>}
                  {expTotal > 0 && <div><dt>{experiences.length} experience{experiences.length > 1 ? "s" : ""}</dt><dd>AED {formatAED(expTotal)}</dd></div>}
                </>}
                <div className="total"><dt>You pay us</dt><dd data-testid={`package-total-${p.id}`}>AED {formatAED(total)}</dd></div>
              </dl>
            </button>
          );
        })}
      </div>

      {diy ? (
        (experiences.length > 0 || pieces.length > 0) && (
          <section className="bz-pk-panel bz-pk-extras" aria-label="From us" data-testid="diy-from-us">
            <h3>Would you like some of it from us?</h3>
            <p className="sub">You make the rest yourself. Add or remove — the price above follows.</p>
            {experiences.length > 0 && <>
              <h4>Your experiences</h4>
              <ul>{experiences.map((e) => row(e.id, `/design/experiences/${e.pic}.webp`, e.name, e.blurb, experiencePrice(e, x!), keeping(e.id), () => toggleExperience(e.id)))}</ul>
            </>}
            {pieces.length > 0 && <>
              <h4>Your designs we can bring</h4>
              <ul>{pieces.map((p) => row(p.id, PIECE_PIC[p.id], p.name, p.note, p.price, bringing(p.id), () => togglePiece(p.id)))}</ul>
            </>}
          </section>
        )
      ) : (
        <section className="bz-pk-panel" aria-label="How it goes" data-testid="we-do-it-steps">
          <h3>How it goes</h3>
          <ol className="bz-pk-steps">
            <li><b>We make every piece</b><span>As you designed it: the backdrop, the tables, the boards, the balloons.</span></li>
            <li><b>We deliver and set it up</b><span>Before the party, at your venue — you pick the time on the next step.</span></li>
            <li><b>You enjoy the party</b><span>{experiences.length > 0 ? `Your ${experiences.length} experience${experiences.length > 1 ? "s" : ""} arrive${experiences.length > 1 ? "" : "s"} on time too.` : "Nothing to carry, nothing to build."}</span></li>
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
