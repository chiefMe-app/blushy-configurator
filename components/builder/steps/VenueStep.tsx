// Step 6 · Venue & party details (2026-11-04, the owner): DIY asks for the home address, We do it for the venue,
// when we set up and when we collect.
import { useEffect } from "react";
import { diyPieceOf, priceBreakdown, type BuilderConfig, type VenueDetails, type CustomerDetails, type DiyPiece } from "@/lib/config";
import VenueDetailsForm from "@/components/VenueDetailsForm";
import { StepShell } from "@/components/builder/ui";

const BROUGHT: Record<DiyPiece, string> = { cake: "the cake", helium: "the helium balloons", pinata: "the piñata", rental: "the plinths" };

export default function VenueStep({ config, patchVenue, patchCustomer }: {
  config: BuilderConfig;
  patchVenue: (patch: Partial<VenueDetails>) => void;
  patchCustomer: (patch: Partial<CustomerDetails>) => void;
}) {
  const diy = config.servicePackageId === "diy";
  // What DIY asked us to bring and designed (a piece with a price in the party).
  const lines = priceBreakdown(config).lines;
  const fromUs = diy ? (config.diy?.bring ?? []).filter((id) => lines.some((l) => diyPieceOf(l) === id)).map((id) => BROUGHT[id]) : [];

  // The guests she told the experiences, if she has not said here yet.
  const x = config.experiences;
  useEffect(() => {
    if (x && !config.venue.childrenCount && !config.venue.adultsCount) {
      patchVenue({ childrenCount: x.children, adultsCount: x.adults, guestCount: x.children + x.adults });
    }
    // Once, on the way in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <StepShell title={diy ? "Your party & delivery" : "Your venue & setup"}>
      <div className="bz-tip"><span className="icon">✳</span>
        <span>{diy ? "Almost ready! When is the party, and where shall we deliver?" : "Almost ready! Where is the party, and when shall we set up?"}</span>
        <span className="arrow">↙</span></div>
      <VenueDetailsForm
        venue={config.venue}
        customer={config.customer}
        onVenue={patchVenue}
        onCustomer={patchCustomer}
        diy={diy}
        fromUs={fromUs}
      />
    </StepShell>
  );
}
