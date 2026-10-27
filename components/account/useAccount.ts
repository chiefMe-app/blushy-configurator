// Who is here (Phase 0.4): nobody, a guest (saved without signing in) or a
// signed-in customer. The Supabase client is loaded only when there is a
// session cookie, or when sign-in is asked for, so a first visit stays light.
import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountState } from "@/lib/account";

const hasSessionCookie = () => typeof document !== "undefined" && /(^|;\s*)sb-[^=]+-auth-token/.test(document.cookie);

export async function loadClient(): Promise<SupabaseClient | null> {
  const { browserSupabase } = await import("@/lib/supabase/browser");
  return browserSupabase();
}

/**
 * The signed-in customer's session token, for the render API (0.5b).
 * undefined: no sign-in on this site (Supabase not set up) — nothing to ask for;
 * null: nobody signed in (or an old guest session).
 */
export async function accountToken(): Promise<string | null | undefined> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return undefined;
  const sb = await loadClient();
  if (!sb) return undefined;
  const { data } = await sb.auth.getSession();
  const s = data.session;
  return s && !s.user.is_anonymous ? s.access_token : null;
}

export function useAccount() {
  const available = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const [account, setAccount] = useState<AccountState | null>(null); // null: not known yet

  const refresh = useCallback(async () => {
    const sb = await loadClient();
    if (!sb) { setAccount({ kind: "none" }); return; }
    const { currentAccount } = await import("@/lib/account");
    setAccount(await currentAccount(sb));
  }, []);

  useEffect(() => {
    if (!available) { setAccount({ kind: "none" }); return; }
    if (!hasSessionCookie()) { setAccount({ kind: "none" }); return; }
    let unsub: (() => void) | undefined;
    void (async () => {
      await refresh();
      const sb = await loadClient();
      const { accountOf } = await import("@/lib/account");
      unsub = sb?.auth.onAuthStateChange((_e, session) => setAccount(accountOf(session?.user))).data.subscription.unsubscribe;
    })();
    return () => unsub?.();
  }, [available, refresh]);

  return { available, account, refresh };
}
