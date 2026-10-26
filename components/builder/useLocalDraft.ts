// Keeps the builder design on this device (lib/draft.ts): restores it once on
// arrival, then saves it shortly after every change. Storage can be missing or
// blocked (private windows, full quota); the builder then works as before.
import { useEffect, useRef, useState } from "react";
import type { BuilderConfig } from "@/lib/config";
import { DRAFT_KEY, fromDraft, isWorthSaving, toDraft, type RestoredDraft } from "@/lib/draft";

const SAVE_DELAY_MS = 400;

export function useLocalDraft({ config, step, decorTab, enabled, onRestore }: {
  config: BuilderConfig;
  step: number;
  decorTab: number;
  /** Off once the request is sent, so the sent design is not saved again. */
  enabled: boolean;
  onRestore: (draft: RestoredDraft) => void;
}) {
  const [restored, setRestored] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    let draft: RestoredDraft | null = null;
    try { draft = fromDraft(window.localStorage.getItem(DRAFT_KEY)); } catch { /* storage blocked */ }
    if (draft) { onRestore(draft); setRestored(true); }
    loaded.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded.current || !enabled || !isWorthSaving(config, step)) return;
    const t = setTimeout(() => {
      try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify(toDraft(config, step, decorTab))); } catch { /* storage full or blocked */ }
    }, SAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [config, step, decorTab, enabled]);

  return {
    /** The design on screen came back from an earlier visit. */
    restored,
    dismiss: () => setRestored(false),
    clear: () => {
      setRestored(false);
      try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* storage blocked */ }
    },
  };
}
