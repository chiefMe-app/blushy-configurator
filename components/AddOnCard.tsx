"use client";

import type { AddOn, SelectedAddOn } from "@/lib/config";

/**
 * Add-on card with inline (non-modal) expand for sub-options that only show
 * once the add-on is selected.
 */
export default function AddOnCard({
  addon,
  selection,
  recommended,
  onToggle,
  onOption,
}: {
  addon: AddOn;
  selection?: SelectedAddOn;
  recommended: boolean;
  onToggle: () => void;
  onOption: (key: string, value: string) => void;
}) {
  const selected = !!selection;

  return (
    <div
      className={`rounded-2xl border p-4 transition ${
        selected ? "border-accent bg-accent-soft/50 shadow-sm" : "border-black/10 bg-white"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={selected}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{addon.label}</span>
            {recommended && (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
                Recommended
              </span>
            )}
          </div>
          <span className="mt-0.5 text-xs text-black/50">{addon.description}</span>
          <span className="mt-1 text-xs font-medium text-accent">{addon.priceLabel}</span>
        </div>

        <span
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
            selected ? "border-accent bg-accent text-white" : "border-black/20 text-transparent"
          }`}
        >
          ✓
        </span>
      </button>

      {/* Inline sub-options — only when selected */}
      {selected && addon.subOptions && addon.subOptions.length > 0 && (
        <div className="mt-3 space-y-3 border-t border-accent/15 pt-3">
          {addon.subOptions.map((opt) => (
            <div key={opt.key}>
              <label className="mb-1 block text-[11px] font-medium text-black/55">
                {opt.label}
              </label>

              {opt.type === "choice" && (
                <div className="flex flex-wrap gap-2">
                  {opt.choices?.map((c) => {
                    const active = selection?.options?.[opt.key] === c.value;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => onOption(opt.key, c.value)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                          active
                            ? "bg-accent text-white"
                            : "bg-white text-black/60 border border-black/15"
                        }`}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {opt.type === "text" && (
                <input
                  type="text"
                  value={selection?.options?.[opt.key] ?? ""}
                  onChange={(e) => onOption(opt.key, e.target.value)}
                  placeholder="Type here…"
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                />
              )}

              {opt.type === "number" && (
                <input
                  type="number"
                  min={0}
                  value={selection?.options?.[opt.key] ?? ""}
                  onChange={(e) => onOption(opt.key, e.target.value)}
                  placeholder="0"
                  className="w-28 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
