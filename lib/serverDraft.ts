// The customer's design saved in the database (Phase 0.3): a party with the
// backdrop design in it, written with the customer's own session under the
// table rules of supabase/migrations (only its owner can read or change it).
// 2026-10-27: saving needs a signed-in account ("misafirler save edemesin"):
// no guest (anonymous) sessions are started, and an old guest session is
// asked to sign in, which keeps its designs (lib/account.ts).
// Only design choices are stored — the same fields as the device copy
// (lib/draft.ts), never the customer's name, phone or venue.
import type { SupabaseClient } from "@supabase/supabase-js";
import { priceBreakdown, type BuilderConfig } from "@/lib/config";
import { toDraft } from "@/lib/draft";

export const SERVER_DRAFT_KEY = "partymuse.party.v1";
export const BACKDROP_ITEM = "studio.backdrop";

/** Which party and item this browser writes to, and for which session. */
export interface ServerDraftRef {
  userId?: string;
  partyId?: string;
  itemId?: string;
  /** Fingerprint of the design last saved (components/builder/useServerDraft.ts). */
  savedPrint?: string;
}

/** Nobody signed in (or only an old guest session): sign in first. */
export class SignInNeeded extends Error {}

export function readRef(): ServerDraftRef {
  try { return JSON.parse(window.localStorage.getItem(SERVER_DRAFT_KEY) ?? "{}") ?? {}; } catch { return {}; }
}
export function writeRef(ref: ServerDraftRef) {
  try { window.localStorage.setItem(SERVER_DRAFT_KEY, JSON.stringify(ref)); } catch { /* storage blocked */ }
}
export function forgetRef() {
  try { window.localStorage.removeItem(SERVER_DRAFT_KEY); } catch { /* storage blocked */ }
}

/** The signed-in customer. */
async function sessionUser(sb: SupabaseClient): Promise<string> {
  const { data } = await sb.auth.getSession();
  const user = data.session?.user;
  if (!user || user.is_anonymous) throw new SignInNeeded("sign in to save");
  return user.id;
}

/**
 * Saves the design to the customer's party, creating the party and the item the
 * first time. Returns the reference to keep for the next save.
 */
export async function saveDesign(sb: SupabaseClient, config: BuilderConfig, step: number, decorTab: number, ref: ServerDraftRef): Promise<ServerDraftRef> {
  const userId = await sessionUser(sb);
  let next: ServerDraftRef = ref.userId === userId ? { ...ref } : { userId };
  const design = toDraft(config, step, decorTab);
  const context = { theme: config.theme, eventType: config.eventType };
  const price = { total: priceBreakdown(config).total, currency: "AED", confidence: "estimate" };

  if (!next.partyId) {
    const { data, error } = await sb.from("parties").insert({ context }).select("id").single();
    if (error || !data) throw new Error(error?.message ?? "party not created");
    next = { ...next, partyId: (data as { id: string }).id, itemId: undefined };
  } else {
    await sb.from("parties").update({ context }).eq("id", next.partyId);
  }

  const row = { config: design, price_snapshot: price };
  if (next.itemId) {
    const { data, error } = await sb.from("party_items").update(row).eq("id", next.itemId).select("id");
    if (error) throw new Error(error.message);
    if ((data ?? []).length) return next;
    // The item is gone (deleted elsewhere): add it again below.
  }
  const { data, error } = await sb.from("party_items")
    .insert({ party_id: next.partyId, kind: "product", ref_id: BACKDROP_ITEM, ...row })
    .select("id").single();
  if (error || !data) {
    // The party is gone too: start a new one next time.
    throw Object.assign(new Error(error?.message ?? "item not created"), { resetParty: true });
  }
  return { ...next, itemId: (data as { id: string }).id };
}
