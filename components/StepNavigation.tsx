"use client";

/** Horizontal progress bar + clickable step labels. */
export default function StepNavigation({
  steps,
  current,
  onSelect,
}: {
  steps: string[];
  current: number;
  onSelect: (i: number) => void;
}) {
  const pct = ((current + 1) / steps.length) * 100;
  return (
    <div>
      <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-black/10">
        <div
          className="h-full rounded-full bg-accent transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <button
              key={label}
              type="button"
              onClick={() => onSelect(i)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? "bg-accent text-white"
                  : done
                    ? "bg-accent-soft text-accent"
                    : "bg-white text-black/50 border border-black/10"
              }`}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] ${
                  active ? "bg-white/25" : done ? "bg-accent text-white" : "bg-black/10"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
