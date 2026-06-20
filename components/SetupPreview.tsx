"use client";

import { useEffect, useRef, useState } from "react";
import type {
  BuilderConfig,
  PlinthSize,
  FontStyle,
  TextColor,
  TextAlign,
  CutoutSize,
  CutoutPosition,
  BackdropShapeId,
  ThemeId,
} from "@/lib/config";
import { resolveBackdropText, THEMES } from "@/lib/config";
import type { ChangeType } from "@/lib/generatePrompt";
import LiveSetupPreview from "./LiveSetupPreview";

const PLINTH_MODE: "ai" | "svg" = "ai";

export type PreviewStatus = "idle" | "loading" | "done" | "error";

export function deriveExtras(config: BuilderConfig): string[] {
  const e: string[] = [];
  if (config.decor.cakeTable) e.push("dessert_table");
  return e;
}

const PLINTH_HEIGHT_PCT: Record<PlinthSize, number> = {
  small: 22, medium: 25, large: 28,
};
const PLINTH_X_PCT: Record<number, number[]> = {
  1: [50], 2: [35, 65], 3: [25, 50, 75],
};

function PlinthOverlay({ sizes }: { sizes: PlinthSize[] }) {
  const n = Math.min(3, sizes.length);
  if (n === 0) return null;
  const xPositions = PLINTH_X_PCT[n] ?? [50];
  return (
    <div className="pointer-events-none absolute inset-0">
      {sizes.slice(0, 3).map((size, i) => (
        <div key={i} style={{
          position: "absolute", bottom: "5%", left: `${xPositions[i] ?? 50}%`,
          transform: "translateX(-50%)", width: "6%", height: `${PLINTH_HEIGHT_PCT[size] ?? 25}%`,
          background: "#FFFFFF", borderRadius: "4px",
          boxShadow: "2px 2px 8px rgba(0,0,0,0.25), inset -2px 0 4px rgba(0,0,0,0.08)",
        }} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Text overlay — anchored to backdrop safe area, no AI regeneration.
// ---------------------------------------------------------------------------

const FONT_FAMILY: Record<FontStyle, string> = {
  script:  '"Brush Script MT", "Segoe Script", cursive',
  block:   '"Arial Black", Impact, sans-serif',
  elegant: 'Georgia, "Times New Roman", serif',
};
const FONT_WEIGHT: Record<FontStyle, number> = { script: 400, block: 900, elegant: 400 };

const BACKDROP_SAFE_AREA: Record<BackdropShapeId, { x: number; y: number; w: number; h: number }> = {
  arch:         { x: 22, y: 16, w: 56, h: 40 },
  round:        { x: 26, y: 22, w: 48, h: 32 },
  rect:         { x: 20, y: 15, w: 60, h: 44 },
  shimmer_wall: { x: 16, y: 14, w: 68, h: 46 },
  wavy:         { x: 18, y: 16, w: 64, h: 40 },
};

function resolveTextColor(color: TextColor, accent: string): string {
  if (color === "white") return "#FFFFFF";
  if (color === "gold")  return "#D4AF37";
  if (color === "black") return "#222222";
  return accent;
}

function TextOverlay({
  text, fontStyle, color, themeAccent,
  fontSize = 4, lineHeight = 140,
  verticalOffset = 30, horizontalOffset = 50,
  align = "center", shape = "arch",
  panelIndex = 0, totalPanels = 1,
}: {
  text: string; fontStyle: FontStyle; color: TextColor; themeAccent: string;
  fontSize?: number; lineHeight?: number;
  verticalOffset?: number; horizontalOffset?: number;
  align?: TextAlign; shape?: BackdropShapeId;
  /** Which panel slot this text belongs to (0-indexed). */
  panelIndex?: number;
  /** Total number of panels in the current layout. */
  totalPanels?: number;
}) {
  const safe = BACKDROP_SAFE_AREA[shape] ?? BACKDROP_SAFE_AREA.arch;
  const resolvedColor = resolveTextColor(color, themeAccent);
  const textShadow = color === "black"
    ? "0 1px 3px rgba(255,255,255,0.5)"
    : "0 1px 5px rgba(0,0,0,0.65), 0 0 14px rgba(0,0,0,0.25)";

  // Divide the safe area horizontally by the number of panels so each
  // panel's text stays within its own slice of the backdrop.
  const sliceW   = safe.w / totalPanels;
  const sliceX   = safe.x + sliceW * panelIndex;
  const blockCX  = sliceX + sliceW * (horizontalOffset / 100);
  const leftPct  = blockCX - sliceW / 2;
  const topPct   = safe.y + safe.h * (verticalOffset / 100);

  return (
    <div className="pointer-events-none absolute"
         style={{ top: `${topPct}%`, left: `${leftPct}%`, width: `${sliceW}%` }}>
      {text.split(/\\n|\n/).map((line, i) => (
        <p key={i} style={{
          fontFamily:    FONT_FAMILY[fontStyle],
          fontWeight:    FONT_WEIGHT[fontStyle],
          fontStyle:     fontStyle === "script" ? "italic" : "normal",
          color:         resolvedColor,
          textShadow,
          fontSize:      `${(fontSize * 0.25 + 0.75).toFixed(2)}rem`,
          letterSpacing: fontStyle === "elegant" ? "0.1em" : fontStyle === "block" ? "0.04em" : "0.02em",
          textAlign:     align,
          lineHeight:    (lineHeight / 100).toFixed(2),
          margin: 0, padding: "0 4px",
          userSelect: "none", whiteSpace: "pre-wrap",
        }}>
          {line || " "}
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cutout overlay — themed standee SVGs per theme, no AI call.
// No generic human/person placeholders.
// Small=2  Medium=4  Premium=6+1 feature piece
// ---------------------------------------------------------------------------

type ArtFn = (c1: string, c2: string) => React.ReactNode;

// --- FROZEN shapes: ice princess, snowman, castle, snowflake, crystal, star ---

const FrozenPrincess: ArtFn = (c1, c2) => (
  <>
    <polygon points="30,30 35,8 44,22 50,5 56,22 65,8 70,30" fill={c2} stroke={c1} strokeWidth="1.5"/>
    <ellipse cx="50" cy="48" rx="18" ry="20" fill="#E8F4FD" stroke={c2} strokeWidth="1"/>
    <path d="M 32 42 Q 22 60 24 78" stroke={c2} strokeWidth="8" fill="none" strokeLinecap="round"/>
    <path d="M 68 42 Q 78 60 76 78" stroke={c2} strokeWidth="8" fill="none" strokeLinecap="round"/>
    <path d="M 36 68 L 24 148 L 76 148 L 64 68 Z" fill={c1}/>
    <path d="M 24 148 L 6 168 L 94 168 L 76 148 Z" fill={c2}/>
    <rect x="37" y="72" width="26" height="6" rx="3" fill="#6BB8E0"/>
    <path d="M 36 70 Q 20 90 14 112" stroke={c1} strokeWidth="10" fill="none" strokeLinecap="round"/>
    <path d="M 64 70 Q 80 90 86 112" stroke={c1} strokeWidth="10" fill="none" strokeLinecap="round"/>
    <circle cx="12" cy="116" r="6" fill="#E8F4FD"/>
    <circle cx="88" cy="116" r="6" fill="#E8F4FD"/>
    <line x1="50" y1="100" x2="50" y2="116" stroke="#E8F4FD" strokeWidth="2" opacity="0.7"/>
    <line x1="42" y1="108" x2="58" y2="108" stroke="#E8F4FD" strokeWidth="2" opacity="0.7"/>
  </>
);

const FrozenSnowman: ArtFn = (_c1, c2) => (
  <>
    <circle cx="50" cy="140" r="27" fill="white" stroke={c2} strokeWidth="2"/>
    <circle cx="50" cy="100" r="20" fill="white" stroke={c2} strokeWidth="2"/>
    <circle cx="50" cy="64" r="16" fill="white" stroke={c2} strokeWidth="2"/>
    <rect x="31" y="50" width="38" height="5" rx="2" fill="#223344"/>
    <rect x="37" y="20" width="26" height="32" rx="3" fill="#223344"/>
    <path d="M 34 80 Q 50 88 66 80" stroke="#E05C5C" strokeWidth="6" fill="none" strokeLinecap="round"/>
    <path d="M 52 85 L 56 100" stroke="#E05C5C" strokeWidth="5" strokeLinecap="round"/>
    <circle cx="44" cy="59" r="2.5" fill="#223344"/>
    <circle cx="56" cy="59" r="2.5" fill="#223344"/>
    <polygon points="50,65 50,70 59,67" fill="#FF7700"/>
    <circle cx="50" cy="93" r="2.5" fill="#445566"/>
    <circle cx="50" cy="100" r="2.5" fill="#445566"/>
    <circle cx="50" cy="107" r="2.5" fill="#445566"/>
    <line x1="30" y1="95" x2="10" y2="80" stroke="#8D6E63" strokeWidth="4" strokeLinecap="round"/>
    <line x1="70" y1="95" x2="90" y2="80" stroke="#8D6E63" strokeWidth="4" strokeLinecap="round"/>
  </>
);

const FrozenCastle: ArtFn = (c1, c2) => (
  <>
    <rect x="8" y="90" width="22" height="78" fill={c2} stroke={c1} strokeWidth="1.5"/>
    <rect x="8" y="82" width="6" height="10" fill={c1}/><rect x="16" y="82" width="6" height="10" fill={c1}/><rect x="24" y="82" width="6" height="10" fill={c1}/>
    <rect x="70" y="90" width="22" height="78" fill={c2} stroke={c1} strokeWidth="1.5"/>
    <rect x="70" y="82" width="6" height="10" fill={c1}/><rect x="78" y="82" width="6" height="10" fill={c1}/><rect x="86" y="82" width="6" height="10" fill={c1}/>
    <rect x="28" y="55" width="44" height="113" fill="#E8F4FD" stroke={c1} strokeWidth="1.5"/>
    <rect x="28" y="47" width="9" height="12" fill={c2}/><rect x="41" y="47" width="9" height="12" fill={c2}/><rect x="54" y="47" width="9" height="12" fill={c2}/><rect x="63" y="47" width="9" height="12" fill={c2}/>
    <line x1="50" y1="47" x2="50" y2="20" stroke={c1} strokeWidth="2"/>
    <polygon points="50,20 68,28 50,36" fill={c1}/>
    <ellipse cx="50" cy="80" rx="7" ry="9" fill={c1} opacity="0.7"/>
    <ellipse cx="19" cy="115" rx="5" ry="7" fill={c1} opacity="0.7"/>
    <ellipse cx="81" cy="115" rx="5" ry="7" fill={c1} opacity="0.7"/>
    <path d="M 40 168 L 40 140 Q 50 128 60 140 L 60 168 Z" fill={c1} opacity="0.8"/>
  </>
);

const FrozenSnowflake: ArtFn = (c1, c2) => {
  const cx = 50, cy = 85;
  return (
    <>
      {[0, 60, 120, 180, 240, 300].map((deg) => {
        const a = (deg * Math.PI) / 180;
        const ex = cx + 60 * Math.cos(a), ey = cy + 60 * Math.sin(a);
        const mx = cx + 32 * Math.cos(a), my = cy + 32 * Math.sin(a);
        const p1a = a + Math.PI / 2, p2a = a - Math.PI / 2;
        return (
          <g key={deg}>
            <line x1={cx} y1={cy} x2={ex} y2={ey} stroke={c1} strokeWidth="5" strokeLinecap="round"/>
            <circle cx={ex} cy={ey} r="5" fill={c2}/>
            <line x1={mx} y1={my} x2={mx + 16 * Math.cos(p1a)} y2={my + 16 * Math.sin(p1a)} stroke={c1} strokeWidth="3" strokeLinecap="round"/>
            <line x1={mx} y1={my} x2={mx + 16 * Math.cos(p2a)} y2={my + 16 * Math.sin(p2a)} stroke={c1} strokeWidth="3" strokeLinecap="round"/>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r="10" fill={c1}/>
      <circle cx={cx} cy={cy} r="5" fill="white"/>
    </>
  );
};

const FrozenCrystal: ArtFn = (c1, c2) => (
  <>
    <polygon points="50,5 80,42 68,165 32,165 20,42" fill={c2} stroke={c1} strokeWidth="1.5"/>
    <polygon points="50,5 80,42 50,42 20,42" fill="#E8F4FD" opacity="0.85"/>
    <polygon points="50,42 65,62 50,165 35,62" fill={c1} opacity="0.22"/>
    <line x1="50" y1="5" x2="50" y2="165" stroke="white" strokeWidth="1.5" opacity="0.5"/>
    <line x1="80" y1="42" x2="20" y2="140" stroke="white" strokeWidth="1" opacity="0.4"/>
    <line x1="20" y1="42" x2="80" y2="140" stroke="white" strokeWidth="1" opacity="0.4"/>
  </>
);

const WinterStar: ArtFn = (c1, c2) => {
  const cx = 50, cy = 82, OR = 60, IR = 26;
  const pts = Array.from({ length: 16 }, (_, i) => {
    const a = (i * 22.5 - 90) * Math.PI / 180;
    const r = i % 2 === 0 ? OR : IR;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  });
  return (
    <>
      <polygon points={pts.join(" ")} fill={c1} stroke={c2} strokeWidth="1.5"/>
      <circle cx={cx} cy={cy} r="12" fill={c2}/>
      <circle cx={cx} cy={cy} r="6" fill="white"/>
    </>
  );
};

// --- Generic/fallback shapes (no human figures) ---

const StarShape: ArtFn = (c1) => {
  const cx = 50, cy = 78, OR = 65, IR = 28;
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (i * 36 - 90) * Math.PI / 180;
    const r = i % 2 === 0 ? OR : IR;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  });
  return <polygon points={pts.join(" ")} fill={c1} stroke="white" strokeWidth="2"/>;
};

const HeartShape: ArtFn = (c1) => (
  <path d="M 50 150 C 50 150 5 110 5 68 C 5 38 28 20 50 45 C 72 20 95 38 95 68 C 95 110 50 150 50 150 Z"
        fill={c1} stroke="white" strokeWidth="1.5"/>
);

const FlowerShape: ArtFn = (c1, c2) => (
  <>
    {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
      const a = (deg * Math.PI) / 180;
      const px = 50 + 36 * Math.cos(a), py = 72 + 36 * Math.sin(a);
      return <ellipse key={deg} cx={px} cy={py} rx="18" ry="26" fill={c1} opacity="0.88"
                      transform={`rotate(${deg} ${px} ${py})`}/>;
    })}
    <circle cx="50" cy="72" r="20" fill={c2}/>
    <line x1="50" y1="98" x2="50" y2="165" stroke="#4CAF50" strokeWidth="6" strokeLinecap="round"/>
    <path d="M 50 138 Q 68 126 72 110" stroke="#4CAF50" strokeWidth="4" fill="none" strokeLinecap="round"/>
  </>
);

const CrownShape: ArtFn = (c1, c2) => (
  <>
    <polygon points="10,160 10,70 28,102 50,40 72,102 90,70 90,160" fill={c1} stroke={c2} strokeWidth="2"/>
    <rect x="10" y="148" width="80" height="20" rx="4" fill={c2} stroke={c1} strokeWidth="1.5"/>
    <circle cx="50" cy="42" r="10" fill={c2}/>
    <circle cx="12" cy="72" r="8" fill={c2}/>
    <circle cx="88" cy="72" r="8" fill={c2}/>
    <circle cx="30" cy="157" r="5" fill={c1}/><circle cx="50" cy="157" r="7" fill="white" stroke={c1} strokeWidth="1"/><circle cx="70" cy="157" r="5" fill={c1}/>
  </>
);

const CastleTower: ArtFn = (c1, c2) => (
  <>
    <rect x="25" y="60" width="50" height="110" fill={c2} stroke={c1} strokeWidth="1.5"/>
    <rect x="25" y="50" width="10" height="14" fill={c1}/><rect x="40" y="50" width="10" height="14" fill={c1}/><rect x="55" y="50" width="10" height="14" fill={c1}/>
    <line x1="50" y1="50" x2="50" y2="22" stroke={c1} strokeWidth="2"/>
    <polygon points="50,22 66,32 50,42" fill={c1}/>
    <ellipse cx="50" cy="95" rx="8" ry="10" fill={c1} opacity="0.7"/>
    <path d="M 38 170 L 38 145 Q 50 132 62 145 L 62 170 Z" fill={c1} opacity="0.8"/>
  </>
);

const RocketShape: ArtFn = (c1, c2) => (
  <>
    <path d="M 35 55 Q 35 8 50 3 Q 65 8 65 55 Z" fill={c1}/>
    <rect x="35" y="55" width="30" height="88" rx="5" fill={c2} stroke={c1} strokeWidth="1.5"/>
    <circle cx="50" cy="82" r="10" fill={c2}/>
    <circle cx="50" cy="82" r="7" fill="#B3D9F2"/>
    <path d="M 35 118 L 20 150 L 35 142 Z" fill={c1}/>
    <path d="M 65 118 L 80 150 L 65 142 Z" fill={c1}/>
    <path d="M 40 143 Q 50 172 60 143" fill="#FF8C00" opacity="0.85"/>
    <path d="M 43 143 Q 50 160 57 143" fill="#FFD700" opacity="0.9"/>
  </>
);

const UnicornShape: ArtFn = (c1, c2) => (
  <>
    <polygon points="50,3 44,52 56,52" fill="#FFD700" stroke="#E8B800" strokeWidth="1"/>
    <ellipse cx="50" cy="76" rx="34" ry="36" fill="white" stroke={c2} strokeWidth="1.5"/>
    <path d="M 18 62 Q 6 78 8 98 Q 12 115 20 120" stroke={c1} strokeWidth="12" fill="none" strokeLinecap="round"/>
    <path d="M 18 62 Q 4 80 6 100 Q 10 118 18 122" stroke={c2} strokeWidth="6" fill="none" strokeLinecap="round"/>
    <ellipse cx="60" cy="74" rx="7" ry="8" fill="#333"/>
    <ellipse cx="62" cy="72" rx="3" ry="3" fill="white"/>
    <ellipse cx="70" cy="90" rx="4" ry="3" fill="#FFB6C1"/>
    <polygon points="28,46 18,22 38,34" fill="white" stroke={c2} strokeWidth="1"/>
    <polygon points="28,46 22,28 34,36" fill="#FFB6C1"/>
    <path d="M 16 112 Q 20 148 30 162" stroke="white" strokeWidth="15" fill="none" strokeLinecap="round"/>
    <path d="M 16 112 Q 20 148 30 162" stroke={c2} strokeWidth="9" fill="none" strokeLinecap="round"/>
  </>
);

const MermaidTail: ArtFn = (c1, c2) => (
  <>
    <ellipse cx="50" cy="52" rx="22" ry="26" fill="#FFCC99"/>
    <path d="M 30 38 Q 12 62 14 86" stroke={c1} strokeWidth="14" fill="none" strokeLinecap="round"/>
    <path d="M 70 38 Q 85 62 82 86" stroke={c2} strokeWidth="10" fill="none" strokeLinecap="round"/>
    <path d="M 35 65 Q 50 74 65 65" fill={c2} stroke={c1} strokeWidth="1.5"/>
    <path d="M 28 80 Q 50 92 72 80 Q 78 118 80 150 Q 50 162 20 150 Q 22 118 28 80 Z" fill={c1}/>
    {[98, 113, 128, 143].map(y => (
      <path key={y} d={`M 32 ${y} Q 50 ${y - 5} 68 ${y}`} stroke={c2} strokeWidth="1.5" fill="none" opacity="0.6"/>
    ))}
    <path d="M 20 150 Q 8 165 14 175" stroke={c1} strokeWidth="8" fill="none" strokeLinecap="round"/>
    <path d="M 80 150 Q 92 165 86 175" stroke={c1} strokeWidth="8" fill="none" strokeLinecap="round"/>
    <path d="M 14 175 Q 50 165 86 175" stroke={c1} strokeWidth="6" fill="none" strokeLinecap="round"/>
    <circle cx="43" cy="47" r="4.5" fill="#333"/>
    <circle cx="57" cy="47" r="4.5" fill="#333"/>
    <circle cx="44" cy="46" r="1.8" fill="white"/>
    <circle cx="58" cy="46" r="1.8" fill="white"/>
  </>
);

const PalmTree: ArtFn = (c1) => (
  <>
    <path d="M 42 165 Q 45 122 52 82 Q 56 62 50 42" stroke="#A0785A" strokeWidth="14" fill="none" strokeLinecap="round"/>
    <circle cx="50" cy="45" r="6" fill="#8B6914"/>
    <circle cx="42" cy="50" r="5" fill="#8B6914"/>
    <path d="M 50 40 Q 20 15 5 25" stroke="#4CAF50" strokeWidth="7" fill="none" strokeLinecap="round"/>
    <path d="M 50 40 Q 30 10 30 0" stroke="#66BB6A" strokeWidth="6" fill="none" strokeLinecap="round"/>
    <path d="M 50 40 Q 72 10 85 22" stroke="#4CAF50" strokeWidth="7" fill="none" strokeLinecap="round"/>
    <path d="M 50 40 Q 75 15 90 28" stroke="#66BB6A" strokeWidth="6" fill="none" strokeLinecap="round"/>
    <path d="M 50 40 Q 68 20 80 8" stroke="#4CAF50" strokeWidth="6" fill="none" strokeLinecap="round"/>
    <path d="M 50 40 Q 18 20 5 8" stroke="#66BB6A" strokeWidth="6" fill="none" strokeLinecap="round"/>
    {/* "floor" suggestion — no human body */}
    <ellipse cx="42" cy="166" rx="14" ry="4" fill={c1} opacity="0.2"/>
  </>
);

const DinoShape: ArtFn = (c1, c2) => (
  <>
    <ellipse cx="44" cy="98" rx="28" ry="38" fill={c1}/>
    <path d="M 55 58 Q 90 44 94 70 Q 90 88 55 86 Z" fill={c1}/>
    <path d="M 55 78 Q 90 80 90 90 Q 80 98 55 88 Z" fill={c2}/>
    <circle cx="80" cy="60" r="5" fill="#333"/>
    <circle cx="81" cy="59" r="2" fill="white"/>
    {[60, 68, 76, 84].map(x => (
      <polygon key={x} points={`${x},78 ${x + 3},86 ${x + 6},78`} fill="white"/>
    ))}
    <path d="M 68 93 Q 82 98 80 108" stroke={c1} strokeWidth="8" fill="none" strokeLinecap="round"/>
    <path d="M 18 103 Q 5 113 8 132" stroke={c1} strokeWidth="18" fill="none" strokeLinecap="round"/>
    <rect x="28" y="130" width="15" height="28" rx="7" fill={c1}/>
    <rect x="48" y="130" width="15" height="28" rx="7" fill={c2}/>
  </>
);

const BallShape: ArtFn = (c1, c2) => (
  <>
    <circle cx="50" cy="80" r="64" fill="white" stroke={c1} strokeWidth="2"/>
    <path d="M 50 16 Q 70 38 78 80 Q 70 122 50 144 Q 30 122 22 80 Q 30 38 50 16 Z" fill={c1} opacity="0.85"/>
    <path d="M 50 16 C 60 38 60 122 50 144" stroke={c2} strokeWidth="1" fill="none"/>
    <path d="M 10 55 Q 50 42 90 55" stroke={c1} strokeWidth="2" fill="none" opacity="0.6"/>
    <path d="M 6 80 Q 50 92 94 80" stroke={c1} strokeWidth="2" fill="none" opacity="0.6"/>
    <path d="M 10 105 Q 50 118 90 105" stroke={c1} strokeWidth="2" fill="none" opacity="0.6"/>
  </>
);

const TeddyBear: ArtFn = (c1, c2) => (
  <>
    <circle cx="26" cy="44" r="16" fill={c1} stroke={c2} strokeWidth="1.5"/>
    <circle cx="74" cy="44" r="16" fill={c1} stroke={c2} strokeWidth="1.5"/>
    <circle cx="50" cy="90" r="42" fill={c1} stroke={c2} strokeWidth="1.5"/>
    <circle cx="50" cy="58" r="28" fill={c1} stroke={c2} strokeWidth="1.5"/>
    <circle cx="50" cy="68" r="16" fill={c2}/>
    <circle cx="42" cy="52" r="5" fill="#333"/>
    <circle cx="58" cy="52" r="5" fill="#333"/>
    <circle cx="43" cy="51" r="2" fill="white"/>
    <circle cx="59" cy="51" r="2" fill="white"/>
    <ellipse cx="50" cy="62" rx="5" ry="4" fill="#C2185B"/>
    <path d="M 44 67 Q 50 73 56 67" stroke="#C2185B" strokeWidth="2" fill="none"/>
    <path d="M 15 100 Q 5 120 10 140" stroke={c1} strokeWidth="18" fill="none" strokeLinecap="round"/>
    <path d="M 85 100 Q 95 120 90 140" stroke={c1} strokeWidth="18" fill="none" strokeLinecap="round"/>
  </>
);

const RoseShape: ArtFn = (c1, c2) => (
  <>
    <path d="M 50 20 C 35 20 15 35 15 55 C 15 80 35 90 50 90 C 65 90 85 80 85 55 C 85 35 65 20 50 20 Z" fill={c1}/>
    <path d="M 50 28 C 40 28 25 40 25 55 C 25 72 40 80 50 80 C 60 80 75 72 75 55 C 75 40 60 28 50 28 Z" fill={c2}/>
    <path d="M 50 36 C 43 36 34 44 34 55 C 34 66 43 72 50 72 C 57 72 66 66 66 55 C 66 44 57 36 50 36 Z" fill={c1} opacity="0.8"/>
    <circle cx="50" cy="55" r="8" fill={c2}/>
    <line x1="50" y1="90" x2="50" y2="162" stroke="#4CAF50" strokeWidth="6" strokeLinecap="round"/>
    <path d="M 50 130 Q 68 120 70 106" stroke="#4CAF50" strokeWidth="4" fill="none" strokeLinecap="round"/>
    <path d="M 50 130 Q 32 120 30 106" stroke="#4CAF50" strokeWidth="4" fill="none" strokeLinecap="round"/>
    {/* Thorns */}
    <polygon points="56,140 65,136 60,146" fill="#4CAF50"/>
  </>
);

const ButterflyShape: ArtFn = (c1, c2) => (
  <>
    <path d="M 50 84 C 50 84 10 40 10 20 C 10 5 30 5 45 30 C 48 40 50 60 50 84 Z" fill={c1} opacity="0.88"/>
    <path d="M 50 84 C 50 84 90 40 90 20 C 90 5 70 5 55 30 C 52 40 50 60 50 84 Z" fill={c1} opacity="0.88"/>
    <path d="M 50 84 C 50 84 18 110 20 130 C 22 148 38 145 48 120 C 49 110 50 96 50 84 Z" fill={c2} opacity="0.88"/>
    <path d="M 50 84 C 50 84 82 110 80 130 C 78 148 62 145 52 120 C 51 110 50 96 50 84 Z" fill={c2} opacity="0.88"/>
    <circle cx="42" cy="30" r="8" fill={c2} opacity="0.5"/>
    <circle cx="58" cy="30" r="8" fill={c2} opacity="0.5"/>
    <line x1="50" y1="84" x2="44" y2="5" stroke="#333" strokeWidth="2" strokeLinecap="round"/>
    <line x1="50" y1="84" x2="56" y2="5" stroke="#333" strokeWidth="2" strokeLinecap="round"/>
    <ellipse cx="50" cy="84" rx="4" ry="80" fill="#333" opacity="0.7"/>
  </>
);

// --- Shape registry ---
type ThemeShapes = { floor: ArtFn[]; mounted: ArtFn[] };

const THEME_SHAPES: Partial<Record<ThemeId, ThemeShapes>> = {
  frozen: {
    floor:   [FrozenPrincess, FrozenSnowman, FrozenCastle, FrozenSnowflake, FrozenCrystal, WinterStar],
    mounted: [FrozenSnowflake, FrozenCrystal, WinterStar, FrozenSnowflake, FrozenCrystal, WinterStar],
  },
  unicorn: {
    floor:   [UnicornShape, StarShape, HeartShape, FlowerShape, CrownShape, StarShape],
    mounted: [StarShape, HeartShape, FlowerShape, StarShape, HeartShape, FlowerShape],
  },
  princess: {
    floor:   [CrownShape, CastleTower, RoseShape, HeartShape, StarShape, CrownShape],
    mounted: [CrownShape, HeartShape, StarShape, CrownShape, HeartShape, StarShape],
  },
  barbie: {
    floor:   [StarShape, CrownShape, HeartShape, RoseShape, StarShape, HeartShape],
    mounted: [StarShape, HeartShape, StarShape, HeartShape, StarShape, HeartShape],
  },
  mermaid: {
    floor:   [MermaidTail, StarShape, FlowerShape, MermaidTail, StarShape, FlowerShape],
    mounted: [StarShape, FlowerShape, HeartShape, StarShape, FlowerShape, HeartShape],
  },
  dinosaur: {
    floor:   [DinoShape, PalmTree, StarShape, DinoShape, PalmTree, StarShape],
    mounted: [StarShape, FlowerShape, StarShape, StarShape, FlowerShape, StarShape],
  },
  safari: {
    floor:   [PalmTree, StarShape, FlowerShape, PalmTree, StarShape, FlowerShape],
    mounted: [StarShape, FlowerShape, StarShape, StarShape, FlowerShape, StarShape],
  },
  space: {
    floor:   [RocketShape, StarShape, RocketShape, StarShape, RocketShape, StarShape],
    mounted: [StarShape, StarShape, StarShape, StarShape, StarShape, StarShape],
  },
  football: {
    floor:   [BallShape, StarShape, CrownShape, BallShape, StarShape, CrownShape],
    mounted: [StarShape, StarShape, HeartShape, StarShape, StarShape, HeartShape],
  },
  teddy_bear: {
    floor:   [TeddyBear, HeartShape, StarShape, TeddyBear, HeartShape, StarShape],
    mounted: [HeartShape, StarShape, HeartShape, StarShape, HeartShape, StarShape],
  },
  blush_garden: {
    floor:   [RoseShape, ButterflyShape, FlowerShape, RoseShape, ButterflyShape, FlowerShape],
    mounted: [FlowerShape, ButterflyShape, FlowerShape, FlowerShape, ButterflyShape, FlowerShape],
  },
  luxury_neutral: {
    floor:   [CrownShape, StarShape, FlowerShape, CrownShape, StarShape, FlowerShape],
    mounted: [StarShape, CrownShape, HeartShape, StarShape, CrownShape, HeartShape],
  },
};

const GENERIC_FLOOR: ArtFn[]   = [StarShape, HeartShape, FlowerShape, CrownShape, StarShape, HeartShape];
const GENERIC_MOUNTED: ArtFn[] = [StarShape, FlowerShape, HeartShape, StarShape, FlowerShape, HeartShape];

function getShapes(themeId: ThemeId, isMounted: boolean): ArtFn[] {
  const entry = THEME_SHAPES[themeId];
  if (entry) return isMounted ? entry.mounted : entry.floor;
  return isMounted ? GENERIC_MOUNTED : GENERIC_FLOOR;
}

function lightenHex(hex: string, amt: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return hex;
  const r = Math.min(255, ((n >> 16) & 255) + amt);
  const g = Math.min(255, ((n >> 8) & 255) + amt);
  const b = Math.min(255, (n & 255) + amt);
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, "0")).join("")}`;
}

// Standee wrapper: artwork + white base stand + shadow
function StandeeSVG({ artFn, c1, c2, tall }: { artFn: ArtFn; c1: string; c2: string; tall?: boolean }) {
  const artH = tall ? 188 : 168;
  return (
    <svg viewBox={`0 0 100 ${artH + 32}`} xmlns="http://www.w3.org/2000/svg"
         style={{ width: "100%", height: "100%", display: "block" }}>
      <g>{artFn(c1, c2)}</g>
      {/* White base stand */}
      <rect x="28" y={artH + 1} width="44" height="13" rx="3" fill="white" stroke="#D8D8D8" strokeWidth="0.8"/>
      {/* Shadow */}
      <ellipse cx="50" cy={artH + 29} rx="26" ry="3" fill="rgba(0,0,0,0.12)"/>
    </svg>
  );
}

function StandeePiece({
  left, bottom, widthPct, heightPct, artFn, c1, c2, tall,
}: {
  left: number; bottom: number; widthPct: number; heightPct: number;
  artFn: ArtFn; c1: string; c2: string; tall?: boolean;
}) {
  return (
    <div style={{
      position: "absolute",
      bottom: `${bottom}%`, left: `${left}%`,
      transform: "translateX(-50%)",
      width: `${widthPct}%`, height: `${heightPct}%`,
      filter: "drop-shadow(0 3px 10px rgba(0,0,0,0.20))",
    }}>
      <StandeeSVG artFn={artFn} c1={c1} c2={c2} tall={tall}/>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI-generated cutout asset types + layout constants
// ---------------------------------------------------------------------------

interface CutoutAsset {
  id: string;
  url: string;
  widthCm: number;
  heightCm: number;
  isFeature: boolean;
  recommendedPosition: "floor" | "backdrop";
}

const CUTOUT_COUNT: Record<Exclude<CutoutSize, "none">, number> = {
  small: 2, medium: 4, premium: 6,
};
const FLOOR_X: Record<number, number[]> = {
  2: [18, 82],
  4: [12, 32, 68, 88],
  6: [8, 22, 37, 63, 78, 92],
};
const MOUNTED_X: Record<number, number[]> = {
  2: [30, 70],
  4: [24, 40, 60, 76],
  6: [18, 30, 43, 57, 70, 82],
};

/**
 * Fetches AI-generated cutout assets for a theme+size combination.
 * Results are cached in a component-level Map so toggling cutouts on/off
 * never re-triggers generation for the same theme+size.
 * Falls back silently to empty array (SVG shapes are shown as fallback).
 */
function useCutoutAssets(themeId: ThemeId, cutoutSize: CutoutSize) {
  const [assets, setAssets]   = useState<CutoutAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const cache = useRef(new Map<string, CutoutAsset[]>());

  useEffect(() => {
    if (cutoutSize === "none") { setAssets([]); return; }
    const key = `${themeId}_${cutoutSize}`;
    if (cache.current.has(key)) {
      setAssets(cache.current.get(key)!);
      return;
    }
    setLoading(true);
    fetch("/api/generate-cutouts", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ themeId, cutoutSetSize: cutoutSize }),
    })
      .then((r) => r.json())
      .then((data) => {
        const list = (data.assets ?? []) as CutoutAsset[];
        cache.current.set(key, list);
        setAssets(list);
      })
      .catch(() => { /* keep SVG fallback on error */ })
      .finally(() => setLoading(false));
  }, [themeId, cutoutSize]);

  return { assets, loading };
}

function CutoutOverlay({
  size, position, themeAccent, themeId, assets = [],
}: {
  size: CutoutSize; position: CutoutPosition; themeAccent: string; themeId: ThemeId;
  assets?: CutoutAsset[];
}) {
  if (size === "none") return null;

  const c1        = themeAccent;
  const c2        = lightenHex(themeAccent, 52);
  const count     = CUTOUT_COUNT[size];
  const isFloor   = position === "floor";
  const isPremium = size === "premium";
  const xArr      = isFloor ? (FLOOR_X[count] ?? [50]) : (MOUNTED_X[count] ?? [50]);
  const bottomPct = isFloor ? 5 : 18;
  const pieceH    = isFloor ? 42 : 36;

  // Use real AI-generated transparent PNG assets when available
  if (assets.length > 0) {
    const regularAssets = assets.filter((a) => !a.isFeature);
    const featureAsset  = assets.find((a) => a.isFeature);
    return (
      <div className="pointer-events-none absolute inset-0">
        {isPremium && featureAsset && (
          <div style={{
            position: "absolute", bottom: `${bottomPct}%`, left: "50%",
            transform: "translateX(-50%)", width: "9%", height: "52%",
            filter: "drop-shadow(0 4px 14px rgba(0,0,0,0.28))",
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={featureAsset.url} alt="party standee"
                 style={{ width: "100%", height: "100%", objectFit: "contain" }}/>
          </div>
        )}
        {xArr.map((left, i) => {
          const asset = regularAssets[i] ?? regularAssets[regularAssets.length - 1];
          if (!asset) return null;
          return (
            <div key={i} style={{
              position: "absolute", bottom: `${bottomPct}%`, left: `${left}%`,
              transform: "translateX(-50%)", width: "6.5%", height: `${pieceH}%`,
              filter: "drop-shadow(0 3px 10px rgba(0,0,0,0.22))",
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset.url} alt="party standee"
                   style={{ width: "100%", height: "100%", objectFit: "contain" }}/>
            </div>
          );
        })}
      </div>
    );
  }

  // Fallback: themed SVG shape standees (while assets are loading or on error)
  const shapes = getShapes(themeId, !isFloor);
  return (
    <div className="pointer-events-none absolute inset-0">
      {isPremium && (
        <StandeePiece
          left={50} bottom={bottomPct} widthPct={9} heightPct={52}
          artFn={shapes[0]} c1={c1} c2={c2} tall
        />
      )}
      {xArr.map((left, i) => (
        <StandeePiece
          key={i}
          left={left} bottom={bottomPct} widthPct={6.5} heightPct={pieceH}
          artFn={shapes[i % shapes.length]} c1={c1} c2={c2}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generation hook
// ---------------------------------------------------------------------------

type Snap = {
  theme: string; pkg: string; nonce: number;
  shapes: string; color: string; balloonStyle: string;
  balloonColors: string; backdropPrint: string;
  plinthSizes: string; extras: string;
};

function detectChangeType(curr: Snap, base: Snap): ChangeType {
  if (curr.nonce !== base.nonce)           return "full";
  if (curr.theme !== base.theme)           return "full";
  if (curr.pkg !== base.pkg)               return "full";
  if (curr.shapes !== base.shapes)         return "full";
  if (curr.balloonStyle !== base.balloonStyle) return "full";
  if (curr.backdropPrint !== base.backdropPrint) return "full";
  if (curr.plinthSizes !== base.plinthSizes || curr.extras !== base.extras) return "full";
  if (curr.color !== base.color || curr.balloonColors !== base.balloonColors) return "colors";
  return "full";
}

export function useSetupPreview(config: BuilderConfig) {
  const [status, setStatus]               = useState<PreviewStatus>("idle");
  const [imageUrl, setImageUrl]           = useState<string | null>(null);
  const [isIncremental, setIsIncremental] = useState(false);
  const reqId           = useRef(0);
  const [nonce, setNonce] = useState(0);
  const baseSnap          = useRef<Snap | null>(null);
  const baseImageUrlRef   = useRef<string | null>(null);
  const extras = deriveExtras(config);
  const d = config.decor;

  // Structural-only: exclude per-panel color/text/graphic to prevent AI
  // regeneration when overlay-only fields change.
  const structuralItems = d.backdropItems.map(i => ({
    t: i.type, s: i.sizeId, w: i.widthCm, h: i.heightCm,
  }));
  const sig = JSON.stringify({
    t: config.theme, p: config.package, et: config.eventType,
    items: structuralItems, b: d.balloonStyle,
    bc: d.backdropColor, blc: d.balloonColors,
    bp: d.backdropPrint,
    pl: PLINTH_MODE === "ai" ? d.plinthSizes : undefined,
    e: extras, n: nonce,
  });

  useEffect(() => {
    const id = ++reqId.current;
    const curr: Snap = {
      theme: config.theme, pkg: config.package, nonce,
      shapes: JSON.stringify(structuralItems),
      color: d.backdropColor ?? "",
      balloonStyle: d.balloonStyle,
      balloonColors: JSON.stringify(d.balloonColors),
      backdropPrint: JSON.stringify(d.backdropPrint),
      plinthSizes: JSON.stringify(PLINTH_MODE === "ai" ? d.plinthSizes : []),
      extras: JSON.stringify(extras),
    };
    const base = baseSnap.current;
    const changeType: ChangeType =
      base && baseImageUrlRef.current ? detectChangeType(curr, base) : "full";
    const incremental = changeType !== "full" && changeType !== "theme";
    if (!incremental) baseImageUrlRef.current = null;
    setIsIncremental(incremental);
    setStatus("loading");
    const capturedBaseUrl = baseImageUrlRef.current;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/generate", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            theme: config.theme, package: config.package, eventType: config.eventType,
            backdropItems: d.backdropItems, backdropColor: d.backdropColor,
            balloonStyle: d.balloonStyle, balloonColors: d.balloonColors,
            backdropText: d.backdropText, backdropPrint: d.backdropPrint,
            cutouts: d.cutouts,
            plinthSizes: PLINTH_MODE === "ai" ? d.plinthSizes : undefined,
            extras, baseImageUrl: incremental ? capturedBaseUrl : undefined, changeType,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (id !== reqId.current) return;
        if (!res.ok || !data.imageUrl) { setStatus("error"); return; }
        baseSnap.current        = curr;
        baseImageUrlRef.current = data.imageUrl;
        setImageUrl(data.imageUrl);
        setStatus("done");
      } catch {
        if (id === reqId.current) setStatus("error");
      }
    }, 1500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  return { status, imageUrl, isIncremental, regenerate: () => setNonce((n) => n + 1) };
}

// ---------------------------------------------------------------------------
// Preview component
// ---------------------------------------------------------------------------

export default function SetupPreview({
  config, status, imageUrl, isIncremental = false, onRegenerate, showControls = true,
}: {
  config: BuilderConfig; status: PreviewStatus; imageUrl: string | null;
  isIncremental?: boolean; onRegenerate: () => void; showControls?: boolean;
}) {
  const themeAccent = THEMES.find((t) => t.id === config.theme)?.accent ?? "#C77DD6";

  // Fetch AI-generated cutout assets (cached per theme+size, no base-render side-effect)
  const { assets: cutoutAssets } = useCutoutAssets(config.theme, config.decor.cutouts.size);

  // Track AI inspiration image separately — it never replaces the primary canvas view
  const [aiUrl, setAiUrl]         = useState<string | null>(null);
  const [aiOpacity, setAiOpacity] = useState(1);
  const [aiKey, setAiKey]         = useState(0);
  const aiUrlRef                  = useRef<string | null>(null);

  useEffect(() => {
    if (!imageUrl || imageUrl === aiUrlRef.current) return;
    const img = new window.Image();
    img.onload = () => {
      aiUrlRef.current = imageUrl;
      setAiOpacity(0);
      setAiUrl(imageUrl);
      setAiKey((k) => k + 1);
      requestAnimationFrame(() => requestAnimationFrame(() => setAiOpacity(1)));
    };
    img.src = imageUrl;
  }, [imageUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const aiIsLoading = status === "loading";

  return (
    <div className="space-y-4">
      {/* ─── 1. AI Inspiration Render (top, optional, mood only) ─────────── */}
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-black/60">AI Inspiration Render</span>
            <span className="rounded-full bg-black/8 px-2 py-0.5 text-[10px] text-black/45">
              Mood only — not used for production
            </span>
          </div>
          {showControls && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={aiIsLoading}
              className="flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-[11px] font-medium text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {aiIsLoading ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white"/>
                  <span>Generating…</span>
                </>
              ) : (
                <>
                  <span className="text-sm leading-none">✦</span>
                  <span>{aiUrl ? "Regenerate" : "Generate Inspiration Render"}</span>
                </>
              )}
            </button>
          )}
        </div>

        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black/5 shadow-inner">
          {aiUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={aiKey}
              src={aiUrl}
              alt="AI inspiration render"
              style={{ opacity: aiOpacity, transition: "opacity 0.4s ease" }}
              className="h-full w-full object-cover"
            />
          ) : aiIsLoading ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-black/10 border-t-black/35"/>
              <span className="text-[11px] text-black/40">Creating AI render…</span>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-black/30">
              <span className="text-3xl">✦</span>
              <span className="text-[11px]">Click &ldquo;Generate Inspiration Render&rdquo; to create an AI concept</span>
            </div>
          )}

          {status === "error" && (
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/45 px-3 py-1.5 backdrop-blur">
              <span className="text-[11px] text-white">AI render unavailable</span>
              {showControls && (
                <button type="button" onClick={onRegenerate}
                        className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium text-white">
                  Retry
                </button>
              )}
            </div>
          )}
        </div>

        <p className="mt-1 text-center text-[10px] text-black/35">
          Optional AI concept for mood only. Production files are based on the Customer Approval Preview below.
        </p>
      </div>

      {/* ─── 2. Customer Approval Preview (below, always deterministic) ──── */}
      {/*
       * Customer Approval Preview and production exports are generated from
       * scene state. AI render is not the source of truth.
       */}
      <div>
        <LiveSetupPreview config={config}>
          {/* Plinth overlay — SVG mode only */}
          {PLINTH_MODE === "svg" && (
            <PlinthOverlay sizes={config.decor.plinthSizes}/>
          )}

          {/* Cutout overlay — AI transparent assets when ready, SVG fallback */}
          {config.decor.cutouts.size !== "none" && (
            <CutoutOverlay
              size={config.decor.cutouts.size}
              position={config.decor.cutouts.position}
              themeAccent={themeAccent}
              themeId={config.theme}
              assets={cutoutAssets}
            />
          )}

          {/* Per-panel text overlays — instant update, no AI regeneration */}
          {config.decor.backdropItems.map((item, idx) => {
            if (!item.text.enabled || !item.text.value.trim()) return null;
            return (
              <TextOverlay
                key={item.id}
                text={item.text.value}
                fontStyle={item.text.fontStyle}
                color={item.text.color}
                themeAccent={themeAccent}
                fontSize={config.decor.backdropText.fontSize}
                lineHeight={config.decor.backdropText.lineHeight}
                verticalOffset={config.decor.backdropText.verticalOffset}
                horizontalOffset={config.decor.backdropText.horizontalOffset}
                align={config.decor.backdropText.align}
                shape={item.type}
                panelIndex={idx}
                totalPanels={config.decor.backdropItems.length}
              />
            );
          })}

          {/* Label badge */}
          <div className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur">
            Customer Approval Preview
          </div>
        </LiveSetupPreview>

        <p className="mt-1.5 text-center text-[11px] text-black/50">
          What you approve here is used for the final production files.
        </p>
      </div>
    </div>
  );
}
