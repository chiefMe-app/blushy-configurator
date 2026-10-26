// Step 7 · Review, moved unchanged from app/builder/page.tsx (Phase 0.1c).
import type { BuilderConfig } from "@/lib/config";
import ReviewSummary from "@/components/ReviewSummary";
import { StepShell } from "@/components/builder/ui";

export default function ReviewStep({ config, canSubmit, submitError }: { config: BuilderConfig; canSubmit: boolean; submitError: string | null }) {
  return (
    <StepShell title="Review & submit">
      <div className="bz-tip"><span className="icon">✳</span><span>Ta-da! Here’s what you’ve created 🎉</span><span className="arrow">↙</span></div>
      <div className="space-y-4">
        {/* Includes the detailed price breakdown (PriceSummary, the existing pricing engine). */}
        <ReviewSummary config={config} />

        {!canSubmit && (
          <p className="text-center text-xs" style={{ color: "#7f717c" }}>
            Add your name &amp; WhatsApp number in the Venue step to submit.
          </p>
        )}
        {submitError && (
          <p className="text-center text-xs text-red-500">{submitError}</p>
        )}
      </div>
    </StepShell>
  );
}
