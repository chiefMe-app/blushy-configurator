"use client";

/**
 * Reusable selectable card used for event types, themes, shapes, etc.
 * Selected state: solid accent border + light accent tint (no harsh colors).
 */
export default function OptionCard({
  selected,
  onClick,
  title,
  subtitle,
  priceBadge,
  badge,
  swatches,
  emoji,
  className = "",
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
  priceBadge?: string;
  badge?: string;
  swatches?: string[];
  emoji?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`relative flex w-full flex-col gap-2 rounded-2xl border p-4 text-left transition ${
        selected
          ? "border-accent bg-accent-soft/60 shadow-sm"
          : "border-black/10 bg-white hover:border-accent/40"
      } ${className}`}
    >
      {badge && (
        <span className="absolute -top-2 right-3 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white shadow">
          {badge}
        </span>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {emoji && <span className="text-xl">{emoji}</span>}
          <span className="text-sm font-semibold">{title}</span>
        </div>
        {priceBadge && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              selected ? "bg-accent text-white" : "bg-black/5 text-black/60"
            }`}
          >
            {priceBadge}
          </span>
        )}
      </div>

      {swatches && swatches.length > 0 && (
        <div className="flex -space-x-1">
          {swatches.slice(0, 5).map((c, i) => (
            <span
              key={i}
              className="h-5 w-5 rounded-full border border-white shadow-sm"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      )}

      {subtitle && <span className="text-xs leading-snug text-black/50">{subtitle}</span>}
    </button>
  );
}
