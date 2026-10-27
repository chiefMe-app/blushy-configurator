// lib/serverDraft.ts: the customer's design saved to its party (Phase 0.3),
// against an in-memory stand-in for the Supabase client. The table rules
// themselves are tested on real Postgres in db.rls.test.ts.
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SignInNeeded, saveDesign, BACKDROP_ITEM } from "@/lib/serverDraft";
import { fixtureById } from "../fixtures/configs";

type Row = Record<string, unknown> & { id: string };

function fakeSupabase(opts: { startUser?: string | null; anonymous?: boolean } = {}) {
  const tables: Record<string, Row[]> = { parties: [], party_items: [] };
  let user: string | null = opts.startUser === undefined ? "account-1" : opts.startUser;
  let n = 0;
  const calls: string[] = [];
  const from = (table: string) => {
    const result = (rows: Row[]) => {
      const p = Promise.resolve({ data: rows, error: null });
      return Object.assign(p, {
        select: () => Object.assign(Promise.resolve({ data: rows.map((r) => ({ id: r.id })), error: null }), {
          single: async () => ({ data: rows[0] ? { id: rows[0].id } : null, error: rows[0] ? null : { message: "no row" } }),
        }),
      });
    };
    return {
      insert: (row: Record<string, unknown>) => {
        calls.push(`insert ${table}`);
        if (table === "party_items" && !tables.parties.some((p) => p.id === row.party_id && p.owner_id === user)) {
          return { select: () => ({ single: async () => ({ data: null, error: { message: "row-level security" } }) }) };
        }
        const r: Row = { id: `${table}-${++n}`, owner_id: user, ...row };
        tables[table].push(r);
        return result([r]);
      },
      update: (row: Record<string, unknown>) => ({
        eq: (col: string, val: unknown) => {
          calls.push(`update ${table}`);
          const hit = tables[table].filter((r) => r[col] === val && r.owner_id === user);
          hit.forEach((r) => Object.assign(r, row));
          return result(hit);
        },
      }),
    };
  };
  const sb = {
    auth: {
      getSession: async () => ({ data: { session: user ? { user: { id: user, is_anonymous: !!opts.anonymous } } : null } }),
    },
    from,
  } as unknown as SupabaseClient;
  return { sb, tables, calls, setUser: (u: string | null) => { user = u; } };
}

const config = (() => {
  const c = fixtureById("N01-soft-signature-round").config;
  return { ...c, customer: { ...c.customer, name: "Ayşe Test", whatsapp: "+971500000000" }, venue: { ...c.venue, area: "Villa 12" } };
})();

describe("saving the customer's design", () => {
  it("first save: a party, the backdrop design in it — design only", async () => {
    const f = fakeSupabase();
    const ref = await saveDesign(f.sb, config, 2, 1, {});
    expect(f.calls).toEqual(["insert parties", "insert party_items"]);
    expect(ref).toEqual({ userId: "account-1", partyId: "parties-1", itemId: "party_items-2" });
    const item = f.tables.party_items[0];
    expect(item).toMatchObject({ kind: "product", ref_id: BACKDROP_ITEM, party_id: "parties-1" });
    expect(item.config).toMatchObject({ v: 1, step: 2, decorTab: 1 });
    const text = JSON.stringify(f.tables);
    for (const s of ["Ayşe Test", "971500000000", "Villa 12"]) expect(text).not.toContain(s);
    expect((item.price_snapshot as { total: number }).total).toBeGreaterThan(0);
    expect(f.tables.parties[0].context).toEqual({ theme: "frozen", eventType: "birthday" });
  });

  it("later saves change the same item; no new party or item", async () => {
    const f = fakeSupabase();
    const ref = await saveDesign(f.sb, config, 2, 1, {});
    f.calls.length = 0;
    const again = await saveDesign(f.sb, { ...config, theme: "unicorn" }, 3, 0, ref);
    expect(again).toEqual(ref);
    expect(f.calls).toEqual(["update parties", "update party_items"]);
    expect(f.tables.party_items).toHaveLength(1);
    expect((f.tables.party_items[0].config as { step: number }).step).toBe(3);
  });

  it("a different account on this device starts its own party", async () => {
    const f = fakeSupabase();
    const ref = await saveDesign(f.sb, config, 2, 1, {});
    f.setUser("someone-else");
    const other = await saveDesign(f.sb, config, 2, 1, ref);
    expect(other.userId).toBe("someone-else");
    expect(other.partyId).not.toBe(ref.partyId);
    expect(f.tables.parties).toHaveLength(2);
  });

  it("an item deleted elsewhere is added again", async () => {
    const f = fakeSupabase();
    const ref = await saveDesign(f.sb, config, 2, 1, {});
    f.tables.party_items.length = 0;
    const again = await saveDesign(f.sb, config, 2, 1, ref);
    expect(again.itemId).not.toBe(ref.itemId);
    expect(f.tables.party_items).toHaveLength(1);
  });

  it("nobody signed in: asks to sign in, starts no guest session, writes nothing", async () => {
    const f = fakeSupabase({ startUser: null });
    await expect(saveDesign(f.sb, config, 2, 1, {})).rejects.toBeInstanceOf(SignInNeeded);
    expect(f.calls).toEqual([]);
    expect(f.tables.parties).toHaveLength(0);
  });

  it("an old guest session also asks to sign in (signing in keeps its designs)", async () => {
    const f = fakeSupabase({ startUser: "guest-1", anonymous: true });
    await expect(saveDesign(f.sb, config, 2, 1, { userId: "guest-1", partyId: "p", itemId: "i" })).rejects.toBeInstanceOf(SignInNeeded);
    expect(f.calls).toEqual([]);
  });

  it("a party that is gone asks for a new one (resetParty)", async () => {
    const f = fakeSupabase();
    const ref = await saveDesign(f.sb, config, 2, 1, {});
    f.tables.parties.length = 0;
    f.tables.party_items.length = 0;
    await expect(saveDesign(f.sb, config, 2, 1, ref)).rejects.toMatchObject({ resetParty: true });
  });
});
