// Step 5 · Add-ons, moved unchanged from app/builder/page.tsx (Phase 0.1c).
import { ADDONS, isAddOnRecommended, type BuilderConfig, type AddOnId } from "@/lib/config";
import AddOnCard from "@/components/AddOnCard";
import { StepShell } from "@/components/builder/ui";

export default function AddOnsStep({ config, toggleAddOn, setAddOnOption }: {
  config: BuilderConfig;
  toggleAddOn: (id: AddOnId) => void;
  setAddOnOption: (id: AddOnId, key: string, value: string) => void;
}) {
  return (
    <StepShell title="Add experiences" subtitle="Optional extras for the day.">
      <div className="bz-tip"><span className="icon">✳</span><span>A little extra sparkle? Totally optional!</span><span className="arrow">↙</span></div>
      <div className="space-y-3">
        {ADDONS.map((addon) => (
          <div key={addon.id}>
            <AddOnCard
              addon={addon}
              selection={config.addOns.find((a) => a.id === addon.id)}
              recommended={isAddOnRecommended(addon, config)}
              onToggle={() => toggleAddOn(addon.id)}
              onOption={(k, v) => setAddOnOption(addon.id, k, v)}
            />
            {/* 2026-10-27: the kids' table can be designed in its own studio. */}
            {addon.id === "kids_tables" && (
              <a className="bz-studio-link" href="/studio/table" data-testid="table-studio-link">Design the kids' table in the Table Setup studio →</a>
            )}
          </div>
        ))}
      </div>
    </StepShell>
  );
}
