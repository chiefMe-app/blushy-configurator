"use client";

import { priceBreakdown, formatAED, type BuilderConfig } from "@/lib/config";

/** Fixed bottom bar: step name + running total + primary action. */
export default function StickyBottomCTA({
  config,
  stepName,
  ctaLabel,
  onNext,
  onBack,
  showBack,
  disabled,
  busy,
}: {
  config: BuilderConfig;
  stepName: string;
  ctaLabel: string;
  onNext: () => void;
  onBack?: () => void;
  showBack?: boolean;
  disabled?: boolean;
  busy?: boolean;
}) {
  const { total } = priceBreakdown(config);
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/5 bg-warmwhite/95 px-4 py-3 backdrop-blur lg:left-auto lg:right-0 lg:w-1/2">
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        {showBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-full border border-black/15 bg-white px-4 py-3 text-sm font-medium text-black/60 transition hover:border-black/30"
          >
            Back
          </button>
        )}
        <div className="hidden flex-col leading-tight sm:flex">
          <span className="text-[10px] uppercase tracking-wide text-black/40">{stepName}</span>
          <span className="text-sm font-semibold text-accent">AED {formatAED(total)}</span>
        </div>
        <button
          type="button"
          onClick={onNext}
          disabled={disabled || busy}
          className="flex-1 rounded-full bg-accent py-3 text-sm font-semibold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-50"
        >
          {busy ? "Please wait…" : `${ctaLabel} · AED ${formatAED(total)}`}
        </button>
      </div>
    </div>
  );
}
