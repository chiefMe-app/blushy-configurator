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
    <div
      className="fixed inset-x-0 bottom-0 z-30 px-4 py-3 backdrop-blur lg:left-auto lg:right-0 lg:w-1/2"
      style={{ background: "rgba(255,255,255,.94)", borderTop: "1px solid #F3D7E1", boxShadow: "0 -8px 24px rgba(216,84,138,.07)" }}
    >
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
        {showBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-full px-5 py-2.5 text-[13px] font-semibold transition"
            style={{ border: "1.5px solid #F3D7E1", background: "white", color: "#97808A" }}
          >
            ‹ Back
          </button>
        )}
        <div className="ml-auto flex items-center gap-3.5">
          <div className="hidden flex-col text-right leading-tight sm:flex">
            <span className="text-[10px] font-bold uppercase" style={{ color: "#B79AA6", letterSpacing: "0.1em" }}>{stepName}</span>
            <span className="text-[13px] font-bold" style={{ color: "#46313B" }}>AED {formatAED(total)} so far</span>
          </div>
          <button
            type="button"
            onClick={onNext}
            disabled={disabled || busy}
            className="rounded-full px-7 py-3 text-sm font-bold text-white transition active:scale-[0.99] disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#E36A97,#D8548A)", boxShadow: "0 8px 22px rgba(216,84,138,.4)" }}
          >
            {busy ? "Please wait…" : `${ctaLabel} ✨`}
          </button>
        </div>
      </div>
    </div>
  );
}
