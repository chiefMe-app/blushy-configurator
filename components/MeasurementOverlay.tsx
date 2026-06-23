/**
 * Measurement overlay for the Final Design Render.
 *
 * All labels are app-generated from scene state — never from AI output.
 * Positions are approximate, anchored to the calculateExactLayout engine.
 *
 * TODO: Improve alignment by storing final render layout anchors from
 *       the controlled render / control map.
 */
"use client";

import type { BuilderConfig } from "@/lib/config";
import { ARCH_SIZES, RECT_SIZES } from "@/lib/config";
import { buildSceneModel } from "@/lib/buildSceneModel";
import { calculateExactLayout, type PanelLayout } from "@/lib/calculateExactLayout";
import { calculateRenderAspectRatio } from "@/lib/calculateRenderAspectRatio";

const REF_W = 800;
const REF_H = 600;

// ---------------------------------------------------------------------------
// Pill label — background rect + bold white text
// ---------------------------------------------------------------------------

interface PillProps {
  x: number;
  y: number;
  text: string;
  anchor?: "start" | "middle" | "end";
  size?: number;
}

function Pill({ x, y, text, anchor = "middle", size = 13 }: PillProps) {
  // Approximate text width (tuned for Inter at ~0.58 × font-size)
  const approxW = text.length * size * 0.58 + 16;
  const pillH   = size + 10;
  const rx      = anchor === "middle" ? x - approxW / 2
                : anchor === "start"  ? x
                : x - approxW;

  return (
    <g>
      <rect
        x={rx} y={y - pillH / 2}
        width={approxW} height={pillH} rx={5} ry={5}
        fill="rgba(10,10,20,0.78)"
        stroke="rgba(255,255,255,0.30)"
        strokeWidth="0.9"
      />
      <text
        x={x} y={y}
        textAnchor={anchor}
        dominantBaseline="middle"
        fontSize={size}
        fontFamily='"Inter", ui-sans-serif, system-ui, sans-serif'
        fontWeight="700"
        letterSpacing="-0.2"
        fill="rgba(255,255,255,0.97)"
      >
        {text}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Dimension line + ticks
// ---------------------------------------------------------------------------

function DimLine({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return (
    <line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke="rgba(255,255,255,0.70)"
      strokeWidth="1.5"
      strokeDasharray="5 4"
      vectorEffect="non-scaling-stroke"
    />
  );
}

function TickH({ x, y }: { x: number; y: number }) {
  return <line x1={x} y1={y - 5} x2={x} y2={y + 5} stroke="rgba(255,255,255,0.80)" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>;
}
function TickV({ x, y }: { x: number; y: number }) {
  return <line x1={x - 5} y1={y} x2={x + 5} y2={y} stroke="rgba(255,255,255,0.80)" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>;
}

// ---------------------------------------------------------------------------
// Single-panel measurements
// ---------------------------------------------------------------------------

function SinglePanelMeasurements({ panel, widthCm, heightCm, typeLabel }: {
  panel: PanelLayout; widthCm: number; heightCm: number; typeLabel: string;
}) {
  const left  = panel.cx - panel.pw / 2;
  const right = panel.cx + panel.pw / 2;
  const top   = panel.apexY;
  const bot   = panel.floorY;

  // Width line: 20px below the floor
  const wY  = Math.min(bot + 22, REF_H - 28);
  // Height line: 22px right of the panel
  const hX  = Math.min(right + 22, REF_W - 60);

  return (
    <g>
      {/* Type label above panel */}
      <Pill x={panel.cx} y={Math.max(top - 16, 20)} text={typeLabel} size={11}/>

      {/* Width dimension */}
      <DimLine x1={left} y1={wY} x2={right} y2={wY}/>
      <TickH x={left}  y={wY}/>
      <TickH x={right} y={wY}/>
      <Pill x={panel.cx} y={wY + 16} text={`${widthCm} cm`} size={13}/>

      {/* Height dimension */}
      <DimLine x1={hX} y1={top} x2={hX} y2={bot}/>
      <TickV x={hX} y={top}/>
      <TickV x={hX} y={bot}/>
      <Pill x={hX + 6} y={(top + bot) / 2} text={`${heightCm} cm`} anchor="start" size={13}/>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Multi-panel: total width + max height only (avoids crowding)
// ---------------------------------------------------------------------------

function MultiPanelMeasurements({ panels, sceneW, maxH }: {
  panels: PanelLayout[]; sceneW: { left: number; right: number }; maxH: number;
}) {
  const leftmost  = sceneW.left;
  const rightmost = sceneW.right;
  const tallest   = panels.reduce((t, p) => p.apexY < t.apexY ? p : t, panels[0]);

  const wY = Math.min(tallest.floorY + 22, REF_H - 28);
  const hX = Math.min(rightmost + 22, REF_W - 60);

  return (
    <g>
      {/* Total width */}
      <DimLine x1={leftmost} y1={wY} x2={rightmost} y2={wY}/>
      <TickH x={leftmost}  y={wY}/>
      <TickH x={rightmost} y={wY}/>
      <Pill x={(leftmost + rightmost) / 2} y={wY + 16} text={`Total width — see specs`} size={11}/>

      {/* Max height on the tallest panel */}
      <DimLine x1={hX} y1={tallest.apexY} x2={hX} y2={tallest.floorY}/>
      <TickV x={hX} y={tallest.apexY}/>
      <TickV x={hX} y={tallest.floorY}/>
      <Pill x={hX + 6} y={(tallest.apexY + tallest.floorY) / 2} text={`${maxH} cm`} anchor="start" size={13}/>

      {/* Per-panel width labels along the floor */}
      {panels.map((p) => {
        const sm = p; // widthCm not on PanelLayout — accessed via sceneModel below
        return null; // widths handled by caller that has widthCm
      })}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Plinth label
// ---------------------------------------------------------------------------

function PlinthLabel({ cx, topY, diameterCm }: { cx: number; topY: number; diameterCm: number }) {
  const y = Math.max(topY - 14, 16);
  return <Pill x={cx} y={y} text={`Ø ${diameterCm} cm`} size={11}/>;
}

// ---------------------------------------------------------------------------
// Main overlay
// ---------------------------------------------------------------------------

export default function MeasurementOverlay({ config }: { config: BuilderConfig }) {
  const sceneModel = buildSceneModel(config);
  const layout     = calculateExactLayout(
    config.decor.backdropItems,
    config.decor.plinthSizes,
    REF_W,
    REF_H,
  );

  const panelCount = layout.panels.length;
  const maxHeightCm = Math.max(...sceneModel.panels.map((p) => p.heightCm), 0);

  // Compute overall group bounding box for multi-panel mode
  const groupLeft  = Math.min(...layout.panels.map((p) => p.cx - p.pw / 2));
  const groupRight = Math.max(...layout.panels.map((p) => p.cx + p.pw / 2));

  function panelTypeLabel(idx: number): string {
    const sm = sceneModel.panels[idx];
    if (!sm) return "";
    const LABELS: Record<string, string> = {
      arch: "Arch", rect: "Rect", round: "Round",
      shimmer_wall: "Shimmer", wavy: "Wavy",
    };
    const sizeLabel = sm.type === "arch"
      ? ARCH_SIZES.find((a) => a.id === sm.sizeId)?.label ?? ""
      : sm.type === "rect"
        ? RECT_SIZES.find((r) => r.id === sm.sizeId)?.label ?? ""
        : "";
    const typeStr = LABELS[sm.type] ?? sm.type;
    return sizeLabel ? `${typeStr} ${sizeLabel}` : typeStr;
  }

  return (
    <svg
      viewBox={`0 0 ${REF_W} ${REF_H}`}
      preserveAspectRatio="xMidYMid meet"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
      style={{ zIndex: 20 }}
    >
      {panelCount === 1 ? (
        // Single panel — show all labels
        layout.panels.map((panel) => {
          const sm = sceneModel.panels[panel.idx];
          if (!sm) return null;
          return (
            <SinglePanelMeasurements
              key={`p-${panel.idx}`}
              panel={panel}
              widthCm={sm.widthCm}
              heightCm={sm.heightCm}
              typeLabel={panelTypeLabel(panel.idx)}
            />
          );
        })
      ) : (
        // Multi-panel summary mode — no per-panel labels, only total width + max height
        <g>
          {(() => {
            // Use overlap-aware total width from calculateRenderAspectRatio
            const { totalWidthCm } = calculateRenderAspectRatio(config.decor.backdropItems);

            const tallest = layout.panels.reduce((t, p) => p.apexY < t.apexY ? p : t, layout.panels[0]);
            const hX = Math.min(groupRight + 22, REF_W - 62);
            const wY = Math.min(tallest.floorY + 22, REF_H - 28);

            return (
              <>
                {/* Total width: span across full group, label centred */}
                <DimLine x1={groupLeft} y1={wY} x2={groupRight} y2={wY}/>
                <TickH x={groupLeft}  y={wY}/>
                <TickH x={groupRight} y={wY}/>
                <Pill x={(groupLeft + groupRight) / 2} y={wY + 16} text={`Total width: ${totalWidthCm} cm`} size={12}/>

                {/* Max height: right of the tallest panel */}
                <DimLine x1={hX} y1={tallest.apexY} x2={hX} y2={tallest.floorY}/>
                <TickV x={hX} y={tallest.apexY}/>
                <TickV x={hX} y={tallest.floorY}/>
                <Pill x={hX + 6} y={(tallest.apexY + tallest.floorY) / 2} text={`Max height: ${maxHeightCm} cm`} anchor="start" size={12}/>
              </>
            );
          })()}
        </g>
      )}

      {/* Plinths */}
      {layout.plinths.map((plinth) => {
        const sp = sceneModel.plinths[plinth.idx];
        if (!sp) return null;
        return (
          <PlinthLabel
            key={`pl-${plinth.idx}`}
            cx={plinth.cx}
            topY={plinth.bottomY - plinth.heightPx}
            diameterCm={sp.diameterCm}
          />
        );
      })}
    </svg>
  );
}
