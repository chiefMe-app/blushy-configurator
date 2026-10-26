// Step 6 · Venue, moved unchanged from app/builder/page.tsx (Phase 0.1c).
import type { BuilderConfig, VenueDetails, CustomerDetails } from "@/lib/config";
import VenueDetailsForm from "@/components/VenueDetailsForm";
import { StepShell } from "@/components/builder/ui";

export default function VenueStep({ config, patchVenue, patchCustomer }: {
  config: BuilderConfig;
  patchVenue: (patch: Partial<VenueDetails>) => void;
  patchCustomer: (patch: Partial<CustomerDetails>) => void;
}) {
  return (
    <StepShell title="Venue details">
      <div className="bz-tip"><span className="icon">✳</span><span>Almost ready! Tell us where the celebration happens.</span><span className="arrow">↙</span></div>
      <VenueDetailsForm
        venue={config.venue}
        customer={config.customer}
        onVenue={patchVenue}
        onCustomer={patchCustomer}
      />
    </StepShell>
  );
}
