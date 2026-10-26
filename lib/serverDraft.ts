// The guest's design saved in the database (Phase 0.3): a party with the
// backdrop design in it, written with the guest's own session under the
// table rules of supabase/migrations (only its owner can read or change it).
// The session is anonymous and starts only once the customer has chosen
// something (lazy), so visits that only look around create nothing.
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
}

export class GuestSessionUnavailable extends Error {}

export function readRef(): ServerDraftRef {
  try { return JSON.parse(window.localStorage.getItem(SERVER_DRAFT_KEY) ?? "{}") ?? {}; } catch { return {}; }
}
export function writeRef(ref: ServerDraftRef) {
  try { window.localStorage.setItem(SERVER_DRAFT_KEY, JSON.stringify(ref)); } catch { /* storage blocked */ }
}
export function forgetRef() {
  try { window.localStorage.removeItem(SERVER_DRAFT_KEY); } catch { /* storage blocked */ }
}

/** The signed-in or guest user, starting a guest session if there is none. */
async function sessionUser(sb: SupabaseClient): Promise<string> {
  const { data } = await sb.auth.getSession();
  if (data.session?.user) return data.session.user.id;
  const { data: anon, error } = await sb.auth.signInAnonymously();
  // e.g. "Anonymous sign-ins are disabled": stay on the device copy.
  if (error || !anon.user) throw new GuestSessionUnavailable(error?.message ?? "no guest session");
  return anon.user.id;
}

/**
 * Saves the design to the guest's party, creating the party and the item the
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
