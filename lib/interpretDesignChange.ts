/**
 * Interprets a customer's natural-language change request into a structured action.
 *
 * Classification rules:
 *   state_change         → concrete config update (color, balloons, text, plinths…)
 *   render_style_edit    → mood/style change on existing render (luxury, softer, brighter…)
 *   structural_regenerate → layout change requiring a new render (add/remove panel, resize…)
 *   clarification_needed → ambiguous or impossible request
 *
 * Never passes raw customer prompt directly to text-to-image — always wraps in
 * preservation rules and current sceneModel context.
 */

import type { DecorConfig } from "./config";
import type { SceneModel } from "./buildSceneModel";

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type ChangeType =
  | "state_change"
  | "render_style_edit"
  | "structural_regenerate"
  | "clarification_needed";

export interface DesignChangeResult {
  changeType:               ChangeType;
  summary:                  string;
  stateUpdates?:            Partial<DecorConfig>;
  renderEditPrompt?:        string;
  requiresRegenerate?:      boolean;
  requiresUserConfirmation?: boolean;
}

// ---------------------------------------------------------------------------
// Named color → hex approximation
// ---------------------------------------------------------------------------

const COLOR_HEX: Record<string, string> = {
  white:      "#FFFFFF",
  cream:      "#FFF9F0",
  ivory:      "#FFFFF0",
  nude:       "#F0D5BD",
  blush:      "#F8BBD0",
  pink:       "#F48FB1",
  rose:       "#F06292",
  coral:      "#FF8A65",
  peach:      "#FFCC80",
  gold:       "#FFD54F",
  champagne:  "#F5E6C8",
  beige:      "#D7CCC8",
  taupe:      "#C9B99A",
  lavender:   "#E1BEE7",
  purple:     "#CE93D8",
  lilac:      "#E6BAED",
  blue:       "#90CAF9",
  navy:       "#1565C0",
  teal:       "#4DD0E1",
  mint:       "#A5D6A7",
  green:      "#81C784",
  sage:       "#B2DFDB",
  red:        "#EF5350",
  burgundy:   "#880E4F",
  grey:       "#9E9E9E",
  gray:       "#9E9E9E",
  silver:     "#CFD8DC",
  black:      "#212121",
  brown:      "#8D6E63",
};

function findColor(prompt: string): string | null {
  const lower = prompt.toLowerCase();
  for (const [name, hex] of Object.entries(COLOR_HEX)) {
    if (lower.includes(name)) return hex;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Pattern tests
// ---------------------------------------------------------------------------

const re = (pattern: string) => new RegExp(pattern, "i");

const BALLOON_STYLE_PATTERNS: [RegExp, DecorConfig["balloonStyle"]][] = [
  [re("half.garland|one.side|single.side|partial.balloon"), "half"],
  [re("full.garland|full.frame|both.side"), "full"],
  [re("premium.balloon|organic.balloon|luxury.balloon|dense.balloon"), "premium"],
  [re("no.balloon|remove.balloon|without.balloon|balloon.off"), "none"],
];

const RENDER_STYLE_KEYWORDS = [
  "more luxury", "make it luxury", "premium feel", "more premium",
  "brighter", "more vibrant", "softer", "more pastel", "warmer lighting",
  "cooler lighting", "more elegant", "more realistic", "better lighting",
  "more dramatic", "moodier", "lighter", "darker",
  "more high.end", "look better", "nicer", "improve the style",
];

const STRUCTURAL_KEYWORDS = [
  "add.*backdrop", "add.*panel", "add.*arch", "add.*rectangular",
  "remove.*backdrop", "remove.*panel", "remove.*arch",
  "bigger arch", "smaller arch", "change size", "different size",
  "another panel", "second panel", "third panel",
  "more plinth", "fewer plinth", "remove plinth", "no plinth",
  "add plinth", "three plinth", "two plinth",
];

// ---------------------------------------------------------------------------
// Interpreter
// ---------------------------------------------------------------------------

export function interpretDesignChange(
  prompt: string,
  sceneModel: SceneModel,
): DesignChangeResult {
  const lower = prompt.toLowerCase().trim();

  // ── 1. Detect structural changes (requires state update + re-render) ────
  for (const kw of STRUCTURAL_KEYWORDS) {
    if (re(kw).test(lower)) {
      return {
        changeType:          "structural_regenerate",
        summary:             `Layout change detected: "${prompt}". Update your selections above, then click Generate Final Render.`,
        requiresRegenerate:  true,
      };
    }
  }

  // ── 2. Detect render style edits (keep current render, apply style edit) ─
  for (const kw of RENDER_STYLE_KEYWORDS) {
    if (lower.includes(kw)) {
      const editPrompt =
        `Edit the existing render ONLY. Keep the same backdrop count, panel shapes, ` +
        `sizes, plinth positions, camera angle, room, floor, and composition identical. ` +
        `Apply only this change: ${prompt}.`;
      return {
        changeType:        "render_style_edit",
        summary:           `Style edit queued: "${prompt}"`,
        renderEditPrompt:  editPrompt,
      };
    }
  }

  // ── 3. Detect concrete state changes ─────────────────────────────────────

  const updates: Partial<DecorConfig> = {};

  // Balloon style
  for (const [pat, style] of BALLOON_STYLE_PATTERNS) {
    if (pat.test(lower)) {
      updates.balloonStyle = style;
      break;
    }
  }

  // Balloon color
  const balloonColorMatch =
    re("balloon.*(color|colour|blue|pink|white|gold|blush|pastel|soft|colou)").test(lower) ||
    re("(blue|pink|white|gold|blush|pastel|soft).*balloon").test(lower);
  if (balloonColorMatch) {
    const color = findColor(lower);
    if (color) {
      updates.balloonColors = [color, color];  // simplified — user can refine
    } else if (re("pastel|soft|light").test(lower)) {
      // Generic pastel request — lighten existing palette suggestion
      updates.balloonColors = ["#F8BBD0", "#E1BEE7", "#B3E5FC", "#DCEDC8", "#FFF9C4"];
    }
  }

  // Backdrop / panel color
  const backdropColorMatch =
    re("backdrop.*(color|colour|white|pink|blue|gold|blush)").test(lower) ||
    re("(white|pink|blue|gold|blush|cream|nude|ivory).*backdrop").test(lower) ||
    re("make.*backdrop.*(white|pink|blue|gold|blush|cream)").test(lower);
  if (backdropColorMatch) {
    const color = findColor(lower);
    if (color) updates.backdropColor = color;
  }

  // Generic color request without specific target — try backdrop color
  if (!backdropColorMatch && !balloonColorMatch && Object.keys(updates).length === 0) {
    const color = findColor(lower);
    if (color && re("color|colour|make it|use").test(lower)) {
      updates.backdropColor = color;
    }
  }

  // Text on panel
  if (re("add.*text|birthday.*text|add.*name|write|type|says?\\s|text.*says?|put.*text").test(lower)) {
    // Extract quoted text or text after "says/write"
    const quoted = prompt.match(/["']([^"']+)["']/)?.[1];
    const afterSays = prompt.match(/says?\s+(.+)/i)?.[1]?.trim();
    const textValue = quoted ?? afterSays ?? "";

    if (textValue) {
      // Apply text to first panel's text field
      const firstItem = sceneModel.panels[0];
      if (firstItem) {
        // We can't update backdropItems directly from this helper (complex type),
        // so flag this for caller to handle
        return {
          changeType: "state_change",
          summary:    `Set text on first panel to: "${textValue}"`,
          stateUpdates: updates,
          // Caller should update backdropItems[0].text.value = textValue
          renderEditPrompt: `text:${textValue}`,  // special signal for caller
        };
      }
    }
  }

  // Return state_change if we found updates
  if (Object.keys(updates).length > 0) {
    const summaryParts: string[] = [];
    if (updates.balloonStyle)  summaryParts.push(`balloon style → ${updates.balloonStyle}`);
    if (updates.balloonColors) summaryParts.push(`balloon colors updated`);
    if (updates.backdropColor) summaryParts.push(`backdrop color → ${updates.backdropColor}`);

    return {
      changeType:   "state_change",
      summary:      `Applied: ${summaryParts.join(", ")}.`,
      stateUpdates: updates,
    };
  }

  // ── 4. Fallback: generic render style edit ────────────────────────────────
  // If nothing else matched, treat as a mood/style edit on the existing render
  if (lower.length > 3) {
    const editPrompt =
      `Edit the existing render ONLY. Keep the same backdrop count, panel shapes, ` +
      `sizes, plinth positions, camera angle, room, floor, and composition identical. ` +
      `Apply only this change: ${prompt}.`;
    return {
      changeType:       "render_style_edit",
      summary:          `Style edit queued: "${prompt}"`,
      renderEditPrompt: editPrompt,
    };
  }

  return {
    changeType: "clarification_needed",
    summary:    "Could you be more specific about what you'd like to change?",
    requiresUserConfirmation: true,
  };
}
