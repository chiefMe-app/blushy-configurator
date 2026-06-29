"use client";

import { priceBreakdown, formatAED, type BuilderConfig, type PriceLine } from "@/lib/config";

/** Compact total used in headers / sticky bars. */
export function TotalBadge({ config }: { config: BuilderConfig }) {
  const { total } = priceBreakdown(config);
  return (
    <div className="flex flex-col items-end leading-tight">
      <span className="text-[10px] uppercase tracking-wide text-black/40">Estimated</span>
      <span className="text-lg font-semibold text-accent">AED {formatAED(total)}</span>
    </div>
  );
}

function SectionGroup({
  title,
  lines,
}: {
  title: string;
  lines: PriceLine[];
}) {
  if (lines.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-black/35">
        {title}
      </p>
      <ul className="space-y-1.5">
        {lines.map((line, i) => (
          <li key={i} className="flex justify-between gap-3 text-sm">
            <span className="text-black/60">{line.label}</span>
            <span className="font-medium tabular-nums">
              {line.amount === 0
                ? <span className="text-black/40">Included</span>
                : <>AED {formatAED(line.amount)}</>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Full itemized breakdown card, grouped by section. */
export default function PriceSummary({
  config,
  className = "",
}: {
  config: BuilderConfig;
  className?: string;
}) {
  const { lines, total } = priceBreakdown(config);

  const designLines  = lines.filter((l) => l.section === "design");
  const packageLines = lines.filter((l) => l.section === "package");
  const addonLines   = lines.filter((l) => l.section === "addons");

  return (
    <div className={`rounded-2xl bg-white p-4 ${className}`} style={{ border: "1.5px solid #F1D8E2", boxShadow: "0 4px 16px rgba(39,40,68,0.05)" }}>
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm" style={{ color: "#EC4D8D" }}>▣</span>
        <h3 className="text-[13px] font-extrabold" style={{ color: "#15182E", letterSpacing: "-0.2px" }}>Estimated total</h3>
      </div>

      <div className="space-y-4">
        <SectionGroup title="Service Package" lines={packageLines} />
        <SectionGroup title="Design Items"    lines={designLines} />
        <SectionGroup title="Add-ons"         lines={addonLines} />
      </div>

      <div className="mt-4 flex items-baseline justify-between border-t border-black/10 pt-3">
        <span className="font-semibold">Total</span>
        <span className="text-xl font-bold text-accent">AED {formatAED(total)}</span>
      </div>
    </div>
  );
}
