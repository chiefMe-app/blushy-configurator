/**
 * Measurement overlay for the Final Design Render.
 *
 * All labels come from scene state (backdropItems.widthCm/heightCm,
 * plinth diameterCm/heightCm). AI render is never trusted for measurements.
 *
 * TODO: Later: improve overlay alignment by storing final render layout
 * anchors from the controlled render / control map.
 *
 * Technical production layout is used for export/spec calculations and
 * optional admin view, not primary customer preview.
 */
"use client";

import type { BuilderConfig } from "@/lib/config";
import { ARCH_SIZES, RECT_SIZES } from "@/lib/config";
import { buildSceneModel } from "@/lib/buildSceneModel";
import { calculateExactLayout } from "@/lib/calculateExactLayout";

// Reference canvas that matches calculateExactLayout defaults
const REF_W = 800;
const REF_H = 600;

function panelSizeLabel(type: string, sizeId?: string): string {
  if (type === "arch" && sizeId) {
    const s = ARCH_SIZES.find((a) => a.id === sizeId);
    if (s) return s.label;
  }
  if (type === "rect" && sizeId) {
    const s = RECT_SIZES.find((r) => r.id === sizeId);
    if (s) return s.label;
  }
  return "";
}

function panelTypeLabel(type: string): string {
  const LABELS: Record<string, string> = {
    arch:         "Arch",
    rect:         "Rect",
    round:        "Round",
    shimmer_wall: "Shimmer Wall",
    wavy:         "Wavy",
  };
  return LABELS[type] ?? type;
}

interface LabelProps {
  x: number; y: number;
  text: string;
  anchor?: "start" | "middle" | "end";
  size?: number;
}

function Label({ x, y, text, anchor = "middle", size = 9.5 }: LabelProps) {
  return (
    <g>
      {/* Dark backing pill for legibility over any background */}
      <text
        x={x} y={y}
        textAnchor={anchor}
        dominantBaseline="middle"
        fontSize={size}
        fontFamily='"Inter", system-ui, sans-serif'
        fontWeight="500"
        stroke="rgba(0,0,0,0.75)"
        strokeWidth="3"
        paintOrder="stroke"
        fill="rgba(255,255,255,0.95)"
      >
        {text}
      </text>
    </g>
  );
}

function DimLine({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return (
    <line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke="rgba(255,255,255,0.85)"
      strokeWidth="1"
      strokeDasharray="4 3"
    />
  );
}

function Tick({ x, y, horiz = false }: { x: number; y: number; horiz?: boolean }) {
  return horiz
    ? <line x1={x} y1={y - 4} x2={x} y2={y + 4} stroke="rgba(255,255,255,0.85)" strokeWidth="1"/>
    : <line x1={x - 4} y1={y} x2={x + 4} y2={y} stroke="rgba(255,255,255,0.85)" strokeWidth="1"/>;
}

export default function MeasurementOverlay({ config }: { config: BuilderConfig }) {
  const sceneModel = buildSceneModel(config);
  const layout     = calculateExactLayout(
    config.decor.backdropItems,
    config.decor.plinthSizes,
    REF_W,
    REF_H,
  );

  return (
    <svg
      viewBox={`0 0 ${REF_W} ${REF_H}`}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      {/* ── Backdrop panels ─────────────────────────────────────────── */}
      {layout.panels.map((panel) => {
        const sm = sceneModel.panels[panel.idx];
        if (!sm) return null;

        const left  = panel.cx - panel.pw / 2;
        const right = panel.cx + panel.pw / 2;
        const top   = panel.apexY;
        const bot   = panel.floorY;

        // Width line: below floor level
        const wY   = bot + 14;
        // Height line: right of panel
        const hX   = right + 14;

        // Panel header label
        const sizeLbl = panelSizeLabel(sm.type, sm.sizeId);
        const typeStr = panelTypeLabel(sm.type);
        const headerLabel = sizeLbl ? `${typeStr} — ${sizeLbl}` : typeStr;

        return (
          <g key={`panel-${panel.idx}`}>
            {/* Panel header (above panel) */}
            <Label x={panel.cx} y={top - 10} text={headerLabel} size={9}/>

            {/* Width dimension line */}
            <DimLine x1={left} y1={wY} x2={right} y2={wY}/>
            <Tick x={left}  y={wY} horiz/>
            <Tick x={right} y={wY} horiz/>
            <Label x={panel.cx} y={wY + 10} text={`${sm.widthCm} cm`} size={9.5}/>

            {/* Height dimension line */}
            <DimLine x1={hX} y1={top} x2={hX} y2={bot}/>
            <Tick x={hX} y={top} horiz={false}/>
            <Tick x={hX} y={bot} horiz={false}/>
            <Label
              x={hX + 8} y={(top + bot) / 2}
              text={`${sm.heightCm} cm`}
              anchor="start" size={9.5}
            />
          </g>
        );
      })}

      {/* ── Plinths ─────────────────────────────────────────────────── */}
      {layout.plinths.map((plinth) => {
        const sp = sceneModel.plinths[plinth.idx];
        if (!sp) return null;
        const labelY = plinth.bottomY - plinth.heightPx - 10;
        return (
          <Label
            key={`plinth-${plinth.idx}`}
            x={plinth.cx}
            y={Math.max(labelY, 12)}
            text={`${sp.diameterCm} dia × ${sp.heightCm} cm`}
            size={8.5}
          />
        );
      })}
    </svg>
  );
}
