// The customer's design saved in the database (Phase 0.3): a party with the
// backdrop design and the kids' table in it (2026-10-30: two items), written with the customer's own session under the
// table rules of supabase/migrations (only its owner can read or change it).
// 2026-10-27: saving needs a signed-in account ("misafirler save edemesin"):
// no guest (anonymous) sessions are started, and an old guest session is
// asked to sign in, which keeps its designs (lib/account.ts).
// Only design choices are stored — the same fields as the device copy
// (lib/draft.ts), never the customer's name, phone or venue.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BuilderConfig } from "@/lib/config";
import { BACKDROP_ITEM, TABLE_ITEM, splitDesign } from "@/lib/savedDesigns";

export { BACKDROP_ITEM, TABLE_ITEM };
export const SERVER_DRAFT_KEY = "partymuse.party.v1";

/** Which party and item this browser writes to, and for which session. */
export interface ServerDraftRef {
  userId?: string;
  partyId?: string;
  itemId?: string;
  /** The kids' table's own item (2026-10-30). */
  tableItemId?: string;
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
 * Saves the design to the customer's party, creating the party and its items the
 * first time: the backdrop and the kids' table as two items (lib/savedDesigns.ts),
 * each only while the customer has it. Returns the reference to keep for the next save.
 */
export async function saveDesign(sb: SupabaseClient, config: BuilderConfig, step: number, decorTab: number, ref: ServerDraftRef): Promise<ServerDraftRef> {
  const userId = await sessionUser(sb);
  let next: ServerDraftRef = ref.userId === userId ? { ...ref } : { userId };
  const { backdrop, table } = splitDesign(config, step, decorTab);
  const context = { theme: config.theme, eventType: config.eventType };

  if (!next.partyId) {
    const { data, error } = await sb.from("parties").insert({ context }).select("id").single();
    if (error || !data) throw new Error(error?.message ?? "party not created");
    next = { ...next, partyId: (data as { id: string }).id, itemId: undefined, tableItemId: undefined };
  } else {
    await sb.from("parties").update({ context }).eq("id", next.partyId);
  }

  const itemId = await putItem(sb, next.partyId!, BACKDROP_ITEM, backdrop, next.itemId);
  const tableItemId = await putItem(sb, next.partyId!, TABLE_ITEM, table, next.tableItemId);
  return { userId: next.userId, partyId: next.partyId, ...(itemId ? { itemId } : {}), ...(tableItemId ? { tableItemId } : {}) };
}

/** Writes one item of the party (or removes it, once the customer no longer has that part); its id after. */
async function putItem(sb: SupabaseClient, partyId: string, refId: string, row: { config: object; price_snapshot: object } | null, id?: string): Promise<string | undefined> {
  if (!row) {
    if (id) await sb.from("party_items").delete().eq("id", id);
    return undefined;
  }
  if (id) {
    const { data, error } = await sb.from("party_items").update(row).eq("id", id).select("id");
    if (error) throw new Error(error.message);
    if ((data ?? []).length) return id;
    // The item is gone (deleted elsewhere): add it again below.
  }
  const { data, error } = await sb.from("party_items")
    .insert({ party_id: partyId, kind: "product", ref_id: refId, ...row })
    .select("id").single();
  if (error || !data) {
    // The party is gone too: start a new one next time.
    throw Object.assign(new Error(error?.message ?? "item not created"), { resetParty: true });
  }
  return (data as { id: string }).id;
}
