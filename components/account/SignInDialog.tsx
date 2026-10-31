"use client";
// Sign in (Phase 0.4): Google, or a sign-in link by email. A guest's saved
// designs come along (lib/account.ts). Opened to save or to see a render
// (`purpose`), it says so, and the Builder does that as soon as the customer
// is back from signing in.
import { useEffect, useId, useRef, useState } from "react";
import { loadClient } from "./useAccount";

const COPY = {
  account: { title: "Keep your designs", lead: "Sign in to save your designs and open them on any device.", after: "" },
  save: {
    title: "Sign in to save your design",
    lead: "It only takes a moment. Your design is saved to My designs as soon as you're signed in — open it on any device.",
    after: " — your design is saved right after",
  },
  render: {
    title: "Sign in to see your render",
    lead: "Renders come with a free account. Sign in and your render starts right away — your design stays as it is.",
    after: " — your render starts right after",
  },
  "table-render": {
    title: "Sign in to see your table",
    lead: "Renders come with a free account. Sign in and your table render starts right away — your design stays as it is.",
    after: " — your render starts right after",
  },
  "welcome-render": {
    title: "Sign in to see your board",
    lead: "Renders come with a free account. Sign in and your welcome board render starts right away — your design stays as it is.",
    after: " — your render starts right after",
  },
};

export default function SignInDialog({ open, onClose, purpose }: { open: boolean; onClose: () => void; purpose?: "save" | "render" | "table-render" | "welcome-render" }) {
  const copy = COPY[purpose ?? "account"];
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId(); // the Builder has two of these windows (top bar and Save)

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) { setState("idle"); setError(null); d.showModal(); }
    if (!open && d.open) d.close();
  }, [open]);

  async function google() {
    setState("busy"); setError(null);
    const sb = await loadClient();
    if (!sb) { setState("error"); setError("Sign-in is not available right now."); return; }
    const { rememberReturn, signInWithGoogle } = await import("@/lib/account");
    rememberReturn(purpose);
    const r = await signInWithGoogle(sb);
    if (r.error) { setState("error"); setError(r.error); }
    // Otherwise the browser is on its way to Google.
  }

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setState("error"); setError("Please enter a valid email address."); return; }
    setState("busy"); setError(null);
    const sb = await loadClient();
    if (!sb) { setState("error"); setError("Sign-in is not available right now."); return; }
    const { rememberReturn, signInWithEmail } = await import("@/lib/account");
    const r = await signInWithEmail(sb, email.trim());
    if (r.error) { setState("error"); setError(r.error); return; }
    rememberReturn(purpose);
    setState("sent");
  }

  return (
    <dialog ref={dialog} className="bz-signin" onClose={onClose} onClick={(e) => { if (e.target === dialog.current) onClose(); }} aria-labelledby={`${id}-title`}>
      <div className="inner">
        <button type="button" className="x" aria-label="Close" onClick={onClose}>×</button>
        <h2 id={`${id}-title`}>{copy.title}</h2>
        <p className="lead">{copy.lead}</p>
        {state === "sent" ? (
          <div className="sent" role="status">
            <strong>Check your inbox ✉</strong>
            <p>We sent a sign-in link to <b>{email.trim()}</b>. Open it on this device to finish signing in{copy.after}.</p>
          </div>
        ) : (
          <>
            <button type="button" className="google" onClick={() => { void google(); }} disabled={state === "busy"}>
              <svg viewBox="0 0 48 48" aria-hidden="true" width="20" height="20"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.3-.4-3.5z"/></svg>
              Continue with Google
            </button>
            <div className="or"><span>or</span></div>
            <form onSubmit={sendLink} noValidate>
              <label htmlFor={`${id}-email`}>Email</label>
              <input id={`${id}-email`} type="email" autoComplete="email" placeholder="you@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)} />
              <button type="submit" className="email" disabled={state === "busy"}>Email me a sign-in link</button>
            </form>
            {error && <p className="err" role="alert">{error}</p>}
            <p className="fine">No password needed. By signing in you agree to our <a href="/terms" target="_blank">Terms</a> and <a href="/privacy" target="_blank">Privacy Policy</a>.</p>
          </>
        )}
      </div>
    </dialog>
  );
}
