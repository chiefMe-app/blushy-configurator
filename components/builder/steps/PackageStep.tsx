// Step 4 · Package, moved unchanged from app/builder/page.tsx (Phase 0.1c).
import { SERVICE_PACKAGES, formatAED, type BuilderConfig, type ServicePackageId } from "@/lib/config";
import { StepShell } from "@/components/builder/ui";

export default function PackageStep({ config, setServicePackage }: { config: BuilderConfig; setServicePackage: (id: ServicePackageId) => void }) {
  return (
    <StepShell
      title="Choose your service package"
      subtitle="Your design is ready — now choose how you want to use it."
    >
      <div className="bz-tip"><span className="icon">✳</span><span>Packages don’t change your design — they define what you receive and how the setup is handled.</span><span className="arrow">↙</span></div>

      {/* Design Packages */}
      <div className="mb-6">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#7f717c" }}>
          Design Packages
        </p>
        <div className="grid grid-cols-1 gap-3">
          {SERVICE_PACKAGES.filter((p) => p.group === "design").map((p) => {
            const selected = config.servicePackageId === p.id;
            return (
              <button key={p.id} type="button" onClick={() => setServicePackage(p.id)} aria-pressed={selected}
                className={`bz-choice ${selected ? "selected" : ""}`} style={{ width: "100%" }}>
                {selected && <span className="tick">✓</span>}
                <div className="flex items-baseline justify-between gap-2 pr-6">
                  <h3 style={{ fontSize: 21, margin: 0 }}>{p.name}</h3>
                  <span className="bz-hand" style={{ fontSize: 20, color: "#ff0d66", whiteSpace: "nowrap" }}>AED {formatAED(p.price)}</span>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {p.includes.map((line) => (
                    <li key={line} className="flex items-start gap-2 text-xs" style={{ color: "#4e4147" }}>
                      <span className="mt-[3px]" style={{ color: "#ff0d66" }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
        {/* 2026-10-27 (Phase 1.3): what a design package delivers, as a file to look at. */}
        <a className="bz-sample-pack" href="/api/packs/sample" download data-testid="sample-pack">
          <span className="icon" aria-hidden="true"><svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 2v8m0 0l-3.5-3.5M8 10l3.5-3.5M3 13.5h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
          <span><b>See what you receive:</b> download a free sample Design Pack (Beta) — specification PDF, lists and a labelled visual reference.</span>
        </a>
      </div>

      {/* Execution Packages */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#7f717c" }}>
          Execution Packages
        </p>
        <div className="grid grid-cols-1 gap-3">
          {SERVICE_PACKAGES.filter((p) => p.group === "execution").map((p) => {
            const selected = config.servicePackageId === p.id;
            return (
              <button key={p.id} type="button" onClick={() => setServicePackage(p.id)} aria-pressed={selected}
                className={`bz-choice ${selected ? "selected" : ""}`} style={{ width: "100%" }}>
                {selected && <span className="tick">✓</span>}
                <div className="flex items-baseline justify-between gap-2 pr-6">
                  <h3 style={{ fontSize: 21, margin: 0 }}>{p.name}</h3>
                  <span className="bz-hand" style={{ fontSize: 20, color: "#ff0d66", whiteSpace: "nowrap" }}>AED {formatAED(p.price)}</span>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {p.includes.map((line) => (
                    <li key={line} className="flex items-start gap-2 text-xs" style={{ color: "#4e4147" }}>
                      <span className="mt-[3px]" style={{ color: "#ff0d66" }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
      </div>
    </StepShell>
  );
}
