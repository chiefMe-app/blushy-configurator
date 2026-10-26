// Saves the design to the guest's party in the database (lib/serverDraft.ts)
// when the customer presses Save — never on its own (2026-10-26: "müşteri
// save'e bassın öyle saved olsun"). The device copy (useLocalDraft) still
// keeps the design between visits without a button.
import { useMemo, useState } from "react";
import type { BuilderConfig } from "@/lib/config";
import { toDraft } from "@/lib/draft";

// The Supabase client and the save itself load on the first Save, so the
// Builder's first load does not carry them.
const loadSaver = () => Promise.all([import("@/lib/supabase/browser"), import("@/lib/serverDraft")]);
const SERVER_DRAFT_KEY = "partymuse.party.v1"; // lib/serverDraft.ts

/** "unavailable": guest sessions are switched off in Supabase. */
export type ServerSaveStatus = "idle" | "saving" | "saved" | "error" | "unavailable";

/** A short fingerprint of the design (not the step or tab), to tell saved from changed. */
function fingerprint(config: BuilderConfig): string {
  const s = JSON.stringify(toDraft(config, 0, 0, new Date(0)).config);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const readSavedPrint = (): string | null => {
  try { return (JSON.parse(window.localStorage.getItem(SERVER_DRAFT_KEY) ?? "{}") ?? {}).savedPrint ?? null; } catch { return null; }
};

export function useServerDraft({ config, step, decorTab }: { config: BuilderConfig; step: number; decorTab: number }) {
  // Supabase is set up when its public URL is (inlined at build time).
  const available = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const [status, setStatus] = useState<ServerSaveStatus>("idle");
  const [savedPrint, setSavedPrint] = useState<string | null>(() => (typeof window === "undefined" ? null : readSavedPrint()));
  const print = useMemo(() => fingerprint(config), [config]);

  async function save() {
    if (!available || status === "saving") return;
    const at = print;
    setStatus("saving");
    try {
      const [{ browserSupabase }, { GuestSessionUnavailable, readRef, saveDesign, writeRef }] = await loadSaver();
      const sb = browserSupabase();
      if (!sb) { setStatus("unavailable"); return; }
      try {
        writeRef({ ...(await saveDesign(sb, config, step, decorTab, readRef())), savedPrint: at });
        setSavedPrint(at);
        setStatus("saved");
      } catch (err) {
        if (err instanceof GuestSessionUnavailable) { setStatus("unavailable"); return; }
        if ((err as { resetParty?: boolean }).resetParty) writeRef({ ...readRef(), partyId: undefined, itemId: undefined });
        console.warn("[draft] could not save to the server", err);
        setStatus("error");
      }
    } catch (err) {
      console.warn("[draft] could not load the saver", err);
      setStatus("error");
    }
  }

  return {
    /** Supabase is configured, so Save can be offered. */
    available,
    status,
    /** This exact design is the one last saved. */
    saved: savedPrint === print && status !== "saving",
    /** Something was saved before (the button then says "Save changes"). */
    savedBefore: savedPrint !== null,
    save,
    /** A new design ("Start over", or after the request is sent): the next Save starts a new item. */
    forget: () => {
      try { window.localStorage.removeItem(SERVER_DRAFT_KEY); } catch { /* storage blocked */ }
      setSavedPrint(null);
      setStatus("idle");
    },
  };
}
