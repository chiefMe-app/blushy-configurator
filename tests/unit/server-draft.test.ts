// lib/serverDraft.ts: the customer's design saved to its party (Phase 0.3),
// against an in-memory stand-in for the Supabase client. The table rules
// themselves are tested on real Postgres in db.rls.test.ts.
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SignInNeeded, saveDesign, BACKDROP_ITEM, TABLE_ITEM } from "@/lib/serverDraft";
import { designCards, joinParty, type SavedItem } from "@/lib/savedDesigns";
import { toDraft } from "@/lib/draft";
import { themeById } from "@/lib/config";
import { defaultTableSetup } from "@/lib/studio/tableSetup";
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
      delete: () => ({
        eq: async (col: string, val: unknown) => {
          calls.push(`delete ${table}`);
          tables[table] = tables[table].filter((r) => !(r[col] === val && r.owner_id === user));
          return { data: null, error: null };
        },
      }),
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

// 2026-10-30: the backdrop and the kids' table are two saved designs.
describe("the backdrop and the kids' table saved apart", () => {
  const frozen = themeById("frozen")!;
  const withTable = { ...config, decor: { ...config.decor, backdropChoice: "yes" as const }, table: defaultTableSetup(frozen) };
  const items = (f: ReturnType<typeof fakeSupabase>) => f.tables.party_items.map((r) => ({ ...r, updated_at: "2026-10-30T10:00:00Z", price_snapshot: r.price_snapshot ?? null })) as unknown as SavedItem[];

  it("one party, two items: the backdrop without the table, the table on its own", async () => {
    const f = fakeSupabase();
    const ref = await saveDesign(f.sb, withTable, 2, 0, {});
    expect(f.calls).toEqual(["insert parties", "insert party_items", "insert party_items"]);
    expect(ref).toEqual({ userId: "account-1", partyId: "parties-1", itemId: "party_items-2", tableItemId: "party_items-3" });
    const [backdrop, table] = f.tables.party_items;
    expect(backdrop.ref_id).toBe(BACKDROP_ITEM);
    expect((backdrop.config as { config: object }).config).not.toHaveProperty("table");
    expect(table).toMatchObject({ ref_id: TABLE_ITEM, party_id: "parties-1", config: { v: 1, kind: "table", theme: "frozen", table: { kids: 10 } } });
    expect((table.price_snapshot as { total: number }).total).toBeGreaterThan(0);
    // Each its own card in My designs; Open puts them back together.
    expect(designCards(items(f)).map((c) => c.kind)).toEqual(["backdrop", "table"]);
    const joined = joinParty(items(f), "parties-1")!;
    expect(joined).toMatchObject({ itemId: "party_items-2", tableItemId: "party_items-3" });
    expect(joined.draft.config.table?.kids).toBe(10);
  });

  it("a skipped part is no design: skipping the table later removes its item", async () => {
    const f = fakeSupabase();
    const ref = await saveDesign(f.sb, withTable, 2, 0, {});
    f.calls.length = 0;
    const again = await saveDesign(f.sb, { ...withTable, table: { ...withTable.table, enabled: false } }, 2, 0, ref);
    expect(f.calls).toEqual(["update parties", "update party_items", "delete party_items"]);
    expect(again.tableItemId).toBeUndefined();
    expect(f.tables.party_items.map((r) => r.ref_id)).toEqual([BACKDROP_ITEM]);
  });

  it("only a table (the backdrop skipped): one table design, which opens as it was", async () => {
    const f = fakeSupabase();
    const ref = await saveDesign(f.sb, { ...withTable, decor: { ...withTable.decor, backdropChoice: "skip" } }, 2, 0, {});
    expect(ref.itemId).toBeUndefined();
    expect(f.tables.party_items.map((r) => r.ref_id)).toEqual([TABLE_ITEM]);
    expect(designCards(items(f)).map((c) => c.kind)).toEqual(["table"]);
    const joined = joinParty(items(f), "parties-1")!;
    expect(joined.draft.config).toMatchObject({ theme: "frozen", decor: { backdropChoice: "skip" }, table: { enabled: true } });
  });

  it("a design saved before (the table inside the backdrop item) shows two cards, and the next save moves the table out", async () => {
    const f = fakeSupabase();
    f.tables.parties.push({ id: "p-old", owner_id: "account-1" });
    f.tables.party_items.push({ id: "i-old", owner_id: "account-1", party_id: "p-old", ref_id: BACKDROP_ITEM, config: toDraft(withTable, 2, 0) as unknown as Record<string, unknown> });
    expect(designCards(items(f)).map((c) => `${c.kind} ${c.item.id}`)).toEqual(["backdrop i-old", "table i-old"]);
    const ref = await saveDesign(f.sb, withTable, 2, 0, { userId: "account-1", partyId: "p-old", itemId: "i-old" });
    expect(ref).toMatchObject({ itemId: "i-old", tableItemId: expect.any(String) });
    expect(f.tables.party_items.map((r) => r.ref_id)).toEqual([BACKDROP_ITEM, TABLE_ITEM]);
    expect(designCards(items(f)).map((c) => c.kind)).toEqual(["backdrop", "table"]);
  });
});
