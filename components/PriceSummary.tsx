"use client";

import { priceBreakdown, formatAED, type BuilderConfig } from "@/lib/config";

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

/** Full itemized breakdown card. */
export default function PriceSummary({
  config,
  className = "",
}: {
  config: BuilderConfig;
  className?: string;
}) {
  const { lines, total } = priceBreakdown(config);
  return (
    <div className={`rounded-2xl border border-black/10 bg-white p-4 ${className}`}>
      <h3 className="mb-3 text-sm font-semibold">Estimated total</h3>
      <ul className="space-y-2">
        {lines.map((line, i) => (
          <li key={i} className="flex justify-between gap-3 text-sm">
            <span className="text-black/55">{line.label}</span>
            <span className="font-medium tabular-nums">
              {line.amount < 0 ? "−" : ""}AED {formatAED(Math.abs(line.amount))}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-baseline justify-between border-t border-black/10 pt-3">
        <span className="font-semibold">Total</span>
        <span className="text-xl font-bold text-accent">AED {formatAED(total)}</span>
      </div>
    </div>
  );
}
