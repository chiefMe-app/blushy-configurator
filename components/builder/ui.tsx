// Small presentational pieces shared by the builder's steps, moved unchanged
// from app/builder/page.tsx (Phase 0.1b).

/**
 * 2026-09-09: a real render under every option, so the customer can see what
 * they are buying instead of reading a sentence about it. Same framed tile as
 * the setup cards. Images live in public/option-samples and are generated with
 * the live pipeline at the production seed.
 */
export function OptionSample({ src, alt }: { src: string; alt: string }) {
  // 2026-10-22: example renders removed at the customer's request — "example
  // renderlari kaldir, sadece ikonlar kalsin".  Kept as a no-op so the call
  // sites stay put if they come back.
  void src; void alt;
  if (true as boolean) return null;
  return (
    <figure style={{ margin: "0 0 10px", width: "100%" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        style={{ width: "100%", maxWidth: 300, aspectRatio: "4 / 3", objectFit: "cover", display: "block",
          borderRadius: 12, border: "1px solid #F3D7E1", background: "white" }}
      />
      <figcaption style={{ fontSize: 9, color: "#BFA7B3", marginTop: 3, letterSpacing: 0.2 }}>
        Example render
      </figcaption>
    </figure>
  );
}

// Playful mini illustration for setup layout cards — Claude Design proportions:
// bigger pastel shapes with gradient fills on a 120×64 stage, no text.
export function SetupMiniPreview({ shapes }: { shapes: string[] }) {
  const els: JSX.Element[] = [];
  const drawShapes = shapes.filter(s => s !== "balloons");
  const hasBalloons = shapes.includes("balloons");
  const n = drawShapes.length;
  const BASE = 60; // floor line
  drawShapes.forEach((shape, i) => {
    // 2026-09-09: this only ever handled one or two pieces — with three, the
    // second and third both landed on 84 and the Triple Arch icon showed two
    // shapes instead of three.
    const cx = n === 1 ? 60 : n === 2 ? (i === 0 ? 40 : 84) : 34 + i * 26;
    const key = `${shape}-${i}`;
    if (shape === "arch" || shape === "arch_large" || shape === "arch_small") {
      const w = shape === "arch_large" ? 38 : shape === "arch_small" ? 26 : 34;
      const top = shape === "arch_large" ? 8 : shape === "arch_small" ? 26 : 12;
      const r = w / 2;
      els.push(
        <path key={key} d={`M ${cx - r},${BASE} L ${cx - r},${top + r} A ${r},${r} 0 0 1 ${cx + r},${top + r} L ${cx + r},${BASE} Z`}
          fill={`url(#gradArch)`} />
      );
    } else if (shape === "half_arch_left" || shape === "half_arch_right") {
      // An arch sliced down the middle: one quarter-round top corner facing
      // outward, the other edge straight and full height.
      const w = 22, top = 20, r = 22;
      const left = cx - w / 2, right = cx + w / 2;
      const facingLeft = shape === "half_arch_left";
      const outer = facingLeft ? left : right;
      const inner = facingLeft ? right : left;
      const sweep = facingLeft ? 1 : 0;
      els.push(
        <path key={key} d={`M ${outer},${BASE} L ${outer},${top + r} A ${r},${r} 0 0 ${sweep} ${inner},${top} L ${inner},${BASE} Z`}
          fill={`url(#gradArch)`} />
      );
    } else if (shape === "round") {
      els.push(<circle key={key} cx={cx} cy={36} r={24} fill="url(#gradRound)" />);
    } else if (shape === "shimmer") {
      els.push(
        <g key={key}>
          <rect x={cx - 19} y={16} width={38} height={44} rx={4} fill="url(#gradShim)" />
          {[25, 34, 43, 52].map(y => <line key={`h${y}`} x1={cx - 19} y1={y} x2={cx + 19} y2={y} stroke="white" strokeWidth={1.2} opacity={0.65} />)}
          {[-9.5, 0, 9.5].map(dx => <line key={`v${dx}`} x1={cx + dx} y1={16} x2={cx + dx} y2={60} stroke="white" strokeWidth={1.2} opacity={0.65} />)}
        </g>
      );
    } else if (shape === "ring") {
      els.push(
        <circle key={key} cx={cx} cy={34} r={22} fill="none" stroke="url(#gradRound)" strokeWidth={9} />
      );
    } else if (shape === "banner") {
      // Square 2x2m banner — a flat panel on a slim frame.
      els.push(
        <g key={key}>
          <rect x={cx - 21} y={18} width={42} height={42} rx={2} fill="url(#gradShim)" />
          <line x1={cx - 21} y1={BASE} x2={cx - 21} y2={BASE + 4} stroke="#C9A9C4" strokeWidth={2} />
          <line x1={cx + 21} y1={BASE} x2={cx + 21} y2={BASE + 4} stroke="#C9A9C4" strokeWidth={2} />
        </g>
      );
    } else if (shape === "open_frame") {
      const r = 15;
      els.push(
        <path key={key} d={`M ${cx - r},${BASE} L ${cx - r},${24 + r} A ${r},${r} 0 0 1 ${cx + r},${24 + r} L ${cx + r},${BASE}`}
          fill="none" stroke="#E8A9C4" strokeWidth={5} strokeLinecap="round" />
      );
    }
  });
  if (hasBalloons) {
    els.push(
      <g key="balloons">
        <circle cx={80} cy={12} r={6} fill="#F7A7C8" />
        <circle cx={91} cy={19} r={4.5} fill="#C9E4F5" />
        <circle cx={98} cy={11} r={3.5} fill="#F9DFA9" />
      </g>
    );
  }
  return (
    <svg width={120} height={64} viewBox="0 0 120 64" aria-hidden="true">
      <defs>
        <linearGradient id="gradArch" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F3A9C6" /><stop offset="100%" stopColor="#E27BA4" />
        </linearGradient>
        <linearGradient id="gradRound" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#BFD9F2" /><stop offset="100%" stopColor="#93BCE3" />
        </linearGradient>
        <linearGradient id="gradShim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E3D5F5" /><stop offset="100%" stopColor="#CBB3E8" />
        </linearGradient>
      </defs>
      {els}
    </svg>
  );
}
// 2026-10-23: the little hand-drawn dashes after a section title.
export function Dash() {
  return <svg className="bz-dash" viewBox="0 0 30 28" aria-hidden="true"><path d="M5 9L16 3M4 17H22M6 26L16 21" /></svg>;
}

export function StepShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="bz-step-title" style={{ font: "400 25px/1.25 var(--bz-hand)", color: "#271617", margin: "0 0 6px" }}>{title}</h2>
      {subtitle && <p className="bz-step-sub" style={{ color: "#7f717c", fontSize: 13, margin: "0 0 14px" }}>{subtitle}</p>}
      <div className={subtitle ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

/** Generic labelled button-group row for decor selects. */
export function ChoiceRow<T extends string>({
  label,
  value,
  options,
  onChange,
  priceOf,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  priceOf?: (id: T) => number;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-black/55">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = o.id === value;
          const price = priceOf?.(o.id) ?? 0;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                active ? "bg-accent text-white" : "bg-white text-black/60 border border-black/15"
              }`}
            >
              {o.label}
              {price > 0 && (
                <span className={active ? "text-white/80" : "text-black/40"}> +{price}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
