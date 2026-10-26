"use client";
// Where Google and the emailed sign-in link come back to (Phase 0.4). The
// Supabase client finishes the sign-in from the link itself (PKCE); then a
// guest's saved designs are brought into the account and the customer goes
// to My designs.
import { useEffect, useRef, useState } from "react";
import { loadClient } from "@/components/account/useAccount";

export default function AccountCallback() {
  const [problem, setProblem] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // once, also under React's development double-run
    started.current = true;
    void (async () => {
      const sb = await loadClient();
      if (!sb) { setProblem("Sign-in is not available right now."); return; }
      const params = new URLSearchParams(window.location.search + "&" + window.location.hash.replace(/^#/, ""));
      const code = params.get("error_code") ?? "";
      const account = await import("@/lib/account");
      // A guest linking a Google account that already has a PartyMuse account:
      // sign in to that account instead (the designs are copied over).
      if (code === "identity_already_exists" || /already (linked|exists|registered)/i.test(params.get("error_description") ?? "")) {
        const r = await account.signInWithGoogle(sb);
        if (r.error) setProblem(r.error);
        return;
      }
      if (params.get("error")) {
        setProblem("That sign-in did not go through. Please try again.");
        return;
      }
      const now = await account.currentAccount(sb); // waits for the link's code to be exchanged
      if (now.kind !== "user") {
        setProblem("That sign-in link has expired, or was opened on another device. Please ask for a new one on this device.");
        return;
      }
      let imported = 0;
      try { imported = await account.importGuestDesigns(sb); } catch (err) { console.warn("[account] import failed", err); }
      window.location.replace(`/my-designs${imported ? `?imported=${imported}` : ""}`);
    })();
  }, []);

  return (
    <main className="bz-plain" aria-live="polite">
      {problem ? (
        <>
          <h1>Almost…</h1>
          <p>{problem}</p>
          <a className="bz-next" href="/builder">Back to the builder</a>
        </>
      ) : (
        <>
          <span className="bz-spinner big" aria-hidden="true" />
          <h1>Signing you in…</h1>
        </>
      )}
    </main>
  );
}
