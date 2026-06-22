"use client";

import { useState } from "react";
import type { DecorConfig } from "@/lib/config";
import type { SceneModel } from "@/lib/buildSceneModel";
import { interpretDesignChange } from "@/lib/interpretDesignChange";

const QUICK_CHIPS = [
  "Make it more luxury",
  "Use softer pastel balloons",
  "Make backdrop white",
  "Make backdrop blush pink",
  "Make balloons gold and white",
  "Add birthday text",
];

interface Props {
  sceneModel:    SceneModel;
  finalUrl:      string | null;
  themeAccent:   string;
  onPatchDecor:  (patch: Partial<DecorConfig>) => void;
  onRenderEdit:  (editPrompt: string) => Promise<void>;
  onMarkStale:   () => void;
}

export default function DesignChangePrompt({
  sceneModel,
  finalUrl,
  themeAccent,
  onPatchDecor,
  onRenderEdit,
  onMarkStale,
}: Props) {
  const [prompt, setPrompt]       = useState("");
  const [processing, setProc]     = useState(false);
  const [message, setMessage]     = useState<{ text: string; type: "success" | "info" | "warn" } | null>(null);

  async function applyChange(text: string) {
    const trimmed = text.trim();
    if (!trimmed || processing) return;

    setProc(true);
    setMessage(null);

    if (process.env.NODE_ENV === "development") {
      console.group("[DesignChangePrompt] applyChange");
      console.log("raw prompt:", trimmed);
    }

    const result = interpretDesignChange(trimmed, sceneModel);

    if (process.env.NODE_ENV === "development") {
      console.log("changeType:", result.changeType);
      console.log("summary:", result.summary);
      console.log("stateUpdates:", result.stateUpdates);
      console.log("renderEditPrompt:", result.renderEditPrompt);
      console.groupEnd();
    }

    try {
      switch (result.changeType) {
        case "state_change": {
          if (result.stateUpdates && Object.keys(result.stateUpdates).length > 0) {
            onPatchDecor(result.stateUpdates);
            onMarkStale();
          }
          // Handle text signal — update global backdrop text (simpler than per-panel)
          if (result.renderEditPrompt?.startsWith("text:")) {
            const textVal = result.renderEditPrompt.slice(5);
            const first   = sceneModel.panels[0];
            onPatchDecor({
              backdropText: {
                enabled:         true,
                type:            "custom" as const,
                name:            "",
                customText:      textVal,
                fontStyle:       first?.text.fontStyle ?? "elegant",
                color:           first?.text.color    ?? "white",
                fontSize:        4,
                lineHeight:      140,
                verticalOffset:  30,
                horizontalOffset: 50,
                align:           "center" as const,
              },
            });
            onMarkStale();
          }
          setMessage({ text: result.summary, type: "success" });
          setPrompt("");
          break;
        }

        case "render_style_edit": {
          if (!finalUrl) {
            setMessage({ text: "Generate a Final Render first, then apply style changes.", type: "warn" });
            break;
          }
          if (result.renderEditPrompt) {
            setMessage({ text: "Applying style edit…", type: "info" });
            await onRenderEdit(result.renderEditPrompt);
            setMessage({ text: result.summary, type: "success" });
          }
          setPrompt("");
          break;
        }

        case "structural_regenerate": {
          setMessage({ text: result.summary, type: "info" });
          onMarkStale();
          break;
        }

        case "clarification_needed":
        default: {
          setMessage({ text: result.summary, type: "warn" });
          break;
        }
      }
    } catch {
      setMessage({ text: "Something went wrong — please try again.", type: "warn" });
    } finally {
      setProc(false);
    }
  }

  const msgColor = message?.type === "success"
    ? "text-green-700 bg-green-50 border-green-200"
    : message?.type === "warn"
      ? "text-amber-700 bg-amber-50 border-amber-200"
      : "text-black/60 bg-black/4 border-black/10";

  return (
    <div className="mt-3 rounded-2xl border border-black/10 bg-white p-3">
      <p className="mb-2 text-[11px] font-semibold text-black/60">Ask for a change</p>

      {/* Quick chips */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {QUICK_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => applyChange(chip)}
            disabled={processing}
            className="rounded-full border border-black/12 bg-white px-2.5 py-1 text-[10px] font-medium text-black/55 transition hover:border-accent/40 hover:text-accent disabled:opacity-50"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Custom prompt */}
      <div className="flex gap-2">
        <textarea
          rows={2}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); applyChange(prompt); } }}
          placeholder="Example: Make the balloons more pastel, add Arya is turning 6, make it more luxury"
          disabled={processing}
          className="flex-1 resize-none rounded-xl border border-black/10 bg-white px-3 py-2 text-[11px] outline-none placeholder:text-black/30 focus:border-accent focus:ring-1 focus:ring-accent/30 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => applyChange(prompt)}
          disabled={!prompt.trim() || processing}
          className="self-end rounded-xl px-3 py-2 text-[11px] font-medium text-white transition disabled:opacity-50"
          style={{ backgroundColor: themeAccent }}
        >
          {processing ? "…" : "Apply"}
        </button>
      </div>

      {/* Result message */}
      {message && (
        <p className={`mt-2 rounded-lg border px-3 py-1.5 text-[11px] ${msgColor}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
