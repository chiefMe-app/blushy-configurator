"use client";

import { formatAED, type Package } from "@/lib/config";

export default function PackageCard({
  pkg,
  selected,
  onClick,
}: {
  pkg: Package;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`relative flex w-full flex-col gap-3 rounded-2xl border p-5 text-left transition ${
        selected
          ? "border-accent bg-accent-soft/60 shadow-sm"
          : "border-black/10 bg-white hover:border-accent/40"
      }`}
    >
      {pkg.popular && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow">
          Most Popular
        </span>
      )}

      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold">{pkg.label}</h3>
        <span className="text-sm font-bold text-accent">
          AED {formatAED(pkg.base)}
        </span>
      </div>

      <ul className="space-y-1.5">
        {pkg.includes.map((line) => (
          <li key={line} className="flex items-start gap-2 text-xs text-black/65">
            <span className="mt-[3px] text-accent">✓</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <p className="mt-1 text-[11px] italic text-black/45">Best for: {pkg.bestFor}</p>
    </button>
  );
}
