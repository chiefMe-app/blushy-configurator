// Saves the design to the guest's party in the database (lib/serverDraft.ts),
// a moment after each change, once the customer has chosen something. Quietly
// does nothing when Supabase is not set up or guest sessions are switched
// off — the device copy (useLocalDraft) still keeps the design.
import { useEffect, useRef, useState } from "react";
import type { BuilderConfig } from "@/lib/config";
import { isWorthSaving } from "@/lib/draft";
// The Supabase client and the save itself are loaded on the first save, so
// the Builder's first load does not carry them.
const loadSaver = () => Promise.all([import("@/lib/supabase/browser"), import("@/lib/serverDraft")]);
const SERVER_DRAFT_KEY = "partymuse.party.v1"; // lib/serverDraft.ts

const SAVE_DELAY_MS = 1500;

/** "off": not saving to the server (no Supabase, no guest sessions). */
export type ServerSaveStatus = "off" | "saving" | "saved" | "error";

export function useServerDraft({ config, step, decorTab, enabled }: {
  config: BuilderConfig;
  step: number;
  decorTab: number;
  /** Off once the request is sent. */
  enabled: boolean;
}) {
  const [status, setStatus] = useState<ServerSaveStatus>("off");
  const unavailable = useRef(false);
  const running = useRef<Promise<void> | null>(null);

  useEffect(() => {
    // Supabase is set up when its public URL is (inlined at build time).
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || unavailable.current || !enabled || !isWorthSaving(config, step)) return;
    const t = setTimeout(() => {
      const run = async () => {
        await running.current; // one save at a time, in order
        const [{ browserSupabase }, { GuestSessionUnavailable, readRef, saveDesign, writeRef }] = await loadSaver();
        const sb = browserSupabase();
        if (!sb) return;
        setStatus("saving");
        try {
          writeRef(await saveDesign(sb, config, step, decorTab, readRef()));
          setStatus("saved");
        } catch (err) {
          if (err instanceof GuestSessionUnavailable) { unavailable.current = true; setStatus("off"); return; }
          if ((err as { resetParty?: boolean }).resetParty) writeRef({ ...readRef(), partyId: undefined, itemId: undefined });
          console.warn("[draft] could not save to the server; the device copy is kept", err);
          setStatus("error");
        }
      };
      running.current = run();
    }, SAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [config, step, decorTab, enabled]);

  return {
    status,
    /** A new design ("Start over"): the next save starts a new item. */
    forget: () => {
      try { window.localStorage.removeItem(SERVER_DRAFT_KEY); } catch { /* storage blocked */ }
      setStatus("off");
    },
  };
}
