// Accounts (Phase 0.4): sign in with Google or an emailed link, and keep a
// guest's saved designs. Since 2026-10-27 saving needs an account, so guests
// are only those who saved before then.
//
// - A guest (anonymous session) who signs in with a NEW Google account or
//   email is linked: same user id, so every saved design simply stays theirs.
// - A guest who signs in to an account that ALREADY EXISTS cannot be linked;
//   their saved designs are copied into that account ("Imported from guest
//   session"), from a copy taken before leaving for the sign-in page. Each
//   copy is inserted with the account's own session, under the table rules —
//   nothing needs a server key.
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { SERVER_DRAFT_KEY, readRef, writeRef } from "@/lib/serverDraft";

export const IMPORT_KEY = "partymuse.import.v1";
const IMPORT_MAX_AGE_MS = 60 * 60_000;

export type AccountState =
  | { kind: "none" }
  | { kind: "guest"; userId: string }
  | { kind: "user"; userId: string; email: string | null; name: string | null };

export function accountOf(user: User | null | undefined): AccountState {
  if (!user) return { kind: "none" };
  if (user.is_anonymous) return { kind: "guest", userId: user.id };
  const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
  return { kind: "user", userId: user.id, email: user.email ?? null, name: meta.full_name ?? meta.name ?? null };
}

export async function currentAccount(sb: SupabaseClient): Promise<AccountState> {
  const { data } = await sb.auth.getSession();
  return accountOf(data.session?.user);
}

export const callbackUrl = () => `${window.location.origin}/account/callback`;

// 2026-10-27: after signing in, the customer goes back to the page they
// signed in from — and when they signed in to save, the Builder saves the
// design straight away.
export const AFTER_SIGN_IN_KEY = "partymuse.after-sign-in.v1";
interface AfterSignIn { to: string; save: boolean; at: number }

/** Before leaving for Google or the inbox: where to come back to. */
export function rememberReturn(save: boolean) {
  const to = window.location.pathname || "/my-designs";
  try { window.localStorage.setItem(AFTER_SIGN_IN_KEY, JSON.stringify({ to, save, at: Date.now() } satisfies AfterSignIn)); } catch { /* storage blocked */ }
}

/** Where the sign-in callback sends the customer; the save itself is the Builder's to take. */
export function afterSignIn(): { to: string; save: boolean } | null {
  let a: AfterSignIn | null = null;
  try { a = JSON.parse(window.localStorage.getItem(AFTER_SIGN_IN_KEY) ?? "null"); } catch { /* storage blocked */ }
  const fresh = a && Date.now() - a.at < IMPORT_MAX_AGE_MS && typeof a.to === "string" && a.to.startsWith("/") && !a.to.startsWith("//");
  if (!fresh || !a!.save) { try { window.localStorage.removeItem(AFTER_SIGN_IN_KEY); } catch { /* storage blocked */ } }
  return fresh ? { to: a!.to, save: a!.save } : null;
}

interface Stash {
  fromUserId: string;
  at: number;
  parties: { id: string; title: string; context: Record<string, unknown> }[];
  items: { id: string; party_id: string; kind: string; ref_id: string; config: unknown; price_snapshot: unknown }[];
}

/** Before a guest leaves for a sign-in page: a copy of their saved designs. */
async function stashGuestDesigns(sb: SupabaseClient, guestId: string) {
  const [{ data: parties }, { data: items }] = await Promise.all([
    sb.from("parties").select("id, title, context").eq("owner_id", guestId),
    sb.from("party_items").select("id, party_id, kind, ref_id, config, price_snapshot").eq("owner_id", guestId),
  ]);
  const stash: Stash = { fromUserId: guestId, at: Date.now(), parties: (parties ?? []) as Stash["parties"], items: (items ?? []) as Stash["items"] };
  try { window.localStorage.setItem(IMPORT_KEY, JSON.stringify(stash)); } catch { /* storage blocked: nothing to bring over */ }
}

function readStash(): Stash | null {
  try {
    const s = JSON.parse(window.localStorage.getItem(IMPORT_KEY) ?? "null") as Stash | null;
    return s && Date.now() - s.at < IMPORT_MAX_AGE_MS && Array.isArray(s.items) ? s : null;
  } catch { return null; }
}
const dropStash = () => { try { window.localStorage.removeItem(IMPORT_KEY); } catch { /* storage blocked */ } };

/** Google. A guest is linked (keeps its designs); everyone else signs in. */
export async function signInWithGoogle(sb: SupabaseClient): Promise<{ error?: string }> {
  const account = await currentAccount(sb);
  const options = { redirectTo: callbackUrl() };
  if (account.kind === "guest") {
    await stashGuestDesigns(sb, account.userId);
    const { error } = await sb.auth.linkIdentity({ provider: "google", options });
    if (!error) return {};
    // Linking switched off in Supabase: plain sign-in; designs are copied over.
  }
  const { error } = await sb.auth.signInWithOAuth({ provider: "google", options });
  return error ? { error: error.message } : {};
}

/** An emailed sign-in link. A guest's email is added to the guest (linked). */
export async function signInWithEmail(sb: SupabaseClient, email: string): Promise<{ error?: string }> {
  const account = await currentAccount(sb);
  const emailRedirectTo = callbackUrl();
  if (account.kind === "guest") {
    await stashGuestDesigns(sb, account.userId);
    const { error } = await sb.auth.updateUser({ email }, { emailRedirectTo });
    if (!error) return {};
    // The email already has an account: sign in to it instead (designs copied over).
  }
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo } });
  return error ? { error: error.message } : {};
}

/**
 * After sign-in: bring a guest's saved designs into the account. Returns how
 * many came over (0 when the guest was linked — the designs never left).
 */
export async function importGuestDesigns(sb: SupabaseClient): Promise<number> {
  const stash = readStash();
  if (!stash) return 0;
  const account = await currentAccount(sb);
  if (account.kind !== "user") return 0; // try again once signed in
  // Claimed before anything is written, so a second run (a reloaded page, two
  // tabs) cannot copy the designs twice; put back if the copy fails.
  dropStash();
  if (account.userId === stash.fromUserId || stash.items.length === 0) return 0;
  const putBack = () => { try { window.localStorage.setItem(IMPORT_KEY, JSON.stringify(stash)); } catch { /* storage blocked */ } };
  const context = stash.parties[0]?.context ?? {};
  const { data: party, error } = await sb.from("parties").insert({ title: "Imported from guest session", context }).select("id").single();
  if (error || !party) { putBack(); throw new Error(error?.message ?? "could not import"); }
  const partyId = (party as { id: string }).id;
  const rows = stash.items.map(({ kind, ref_id, config, price_snapshot }) => ({ party_id: partyId, kind, ref_id, config, price_snapshot }));
  const { data: inserted, error: itemsError } = await sb.from("party_items").insert(rows).select("id");
  if (itemsError) { putBack(); throw new Error(itemsError.message); }
  // The design open in the Builder now lives in the account: Save updates its copy.
  const ref = readRef();
  const i = stash.items.findIndex((it) => it.id === ref.itemId);
  const newIds = (inserted ?? []) as { id: string }[];
  if (i >= 0 && newIds[i]) writeRef({ ...ref, userId: account.userId, partyId, itemId: newIds[i].id });
  else if (ref.userId === stash.fromUserId) {
    try { window.localStorage.removeItem(SERVER_DRAFT_KEY); } catch { /* storage blocked */ }
  }
  return rows.length;
}

export async function signOut(sb: SupabaseClient) {
  await sb.auth.signOut();
  // The next Save starts afresh (a new guest).
  try { window.localStorage.removeItem(SERVER_DRAFT_KEY); } catch { /* storage blocked */ }
}
