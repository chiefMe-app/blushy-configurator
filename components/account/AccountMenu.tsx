"use client";
// The top bar's account corner (Phase 0.4): "Sign in", or the customer's
// initial with My designs and Sign out.
import { useState } from "react";
import SignInDialog from "./SignInDialog";
import { loadClient, useAccount } from "./useAccount";

export default function AccountMenu() {
  const { available, account } = useAccount();
  const [signingIn, setSigningIn] = useState(false);
  const [menu, setMenu] = useState(false);
  if (!available || !account) return null;

  if (account.kind === "user") {
    const label = account.name || account.email || "Account";
    return (
      <div className="bz-account">
        <a href="/my-designs" className="bz-account-link">My designs</a>
        <button type="button" className="bz-avatar" aria-haspopup="menu" aria-expanded={menu} aria-label={`Account: ${label}`}
          onClick={() => setMenu((m) => !m)}>{label.trim().charAt(0).toUpperCase()}</button>
        {menu && (
          <div className="bz-account-menu" role="menu">
            <span className="who">{account.email ?? label}</span>
            <a role="menuitem" href="/my-designs">My designs</a>
            <button role="menuitem" type="button" onClick={async () => {
              const sb = await loadClient();
              if (sb) { const { signOut } = await import("@/lib/account"); await signOut(sb); }
              window.location.href = "/builder";
            }}>Sign out</button>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="bz-account">
      {account.kind === "guest" && <a href="/my-designs" className="bz-account-link">My designs</a>}
      <button type="button" className="bz-signin-btn" onClick={() => setSigningIn(true)}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="2.2" /><path d="M4 21c1.2-4.2 4.3-6.3 8-6.3s6.8 2.1 8 6.3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
        Sign in
      </button>
      <SignInDialog open={signingIn} onClose={() => setSigningIn(false)} />
    </div>
  );
}
