// lib/account.ts: a guest's saved designs and signing in (Phase 0.4), with
// an in-memory stand-in for the Supabase client and for localStorage.
import { beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AFTER_SIGN_IN_KEY, IMPORT_KEY, afterSignIn, importGuestDesigns, rememberReturn, signInWithEmail, signInWithGoogle, takeAfterSignIn } from "@/lib/account";
import { SERVER_DRAFT_KEY } from "@/lib/serverDraft";

const store = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  },
  location: { origin: "https://blushy-events.vercel.app", pathname: "/builder" },
};

const GUEST = "guest-1", ACCOUNT = "account-1";
type Row = Record<string, unknown> & { id: string; owner_id: string };

function fake(opts: { user: { id: string; is_anonymous: boolean } | null; linkError?: string; updateError?: string; failInsert?: boolean }) {
  const tables: Record<string, Row[]> = {
    parties: [{ id: "p-guest", owner_id: GUEST, title: "My party", context: { theme: "frozen" } }],
    party_items: [
      { id: "i-guest-1", owner_id: GUEST, party_id: "p-guest", kind: "product", ref_id: "studio.backdrop", config: { v: 1, n: 1 }, price_snapshot: { total: 1090 } },
      { id: "i-guest-2", owner_id: GUEST, party_id: "p-guest", kind: "product", ref_id: "studio.backdrop", config: { v: 1, n: 2 }, price_snapshot: null },
    ],
  };
  const calls: string[] = [];
  let n = 0;
  const me = () => opts.user?.id;
  const sb = {
    auth: {
      getSession: async () => ({ data: { session: opts.user ? { user: opts.user } : null } }),
      linkIdentity: async () => { calls.push("linkIdentity"); return { error: opts.linkError ? { message: opts.linkError } : null }; },
      signInWithOAuth: async () => { calls.push("signInWithOAuth"); return { error: null }; },
      updateUser: async () => { calls.push("updateUser"); return { error: opts.updateError ? { message: opts.updateError } : null }; },
      signInWithOtp: async () => { calls.push("signInWithOtp"); return { error: null }; },
    },
    from: (t: string) => ({
      select: () => ({ eq: async (_c: string, v: string) => ({ data: tables[t].filter((r) => r.owner_id === v), error: null }) }),
      insert: (rows: Record<string, unknown> | Record<string, unknown>[]) => {
        calls.push(`insert ${t}`);
        const added = (Array.isArray(rows) ? rows : [rows]).map((r) => ({ id: `${t}-new-${++n}`, owner_id: me()!, ...r }));
        if (!opts.failInsert || t === "parties") tables[t].push(...added);
        const res = { data: added.map((r) => ({ id: r.id })), error: opts.failInsert && t === "party_items" ? { message: "boom" } : null };
        return { select: () => Object.assign(Promise.resolve(res), { single: async () => ({ data: res.data[0], error: res.error }) }) };
      },
    }),
  } as unknown as SupabaseClient;
  return { sb, tables, calls };
}

beforeEach(() => store.clear());

describe("signing in", () => {
  it("a guest's Google sign-in links the guest, after keeping a copy of its designs", async () => {
    const f = fake({ user: { id: GUEST, is_anonymous: true } });
    expect(await signInWithGoogle(f.sb)).toEqual({});
    expect(f.calls).toEqual(["linkIdentity"]);
    expect(JSON.parse(store.get(IMPORT_KEY)!).items).toHaveLength(2);
  });
  it("linking switched off: signs in to Google instead (designs copied after)", async () => {
    const f = fake({ user: { id: GUEST, is_anonymous: true }, linkError: "Manual linking is disabled" });
    await signInWithGoogle(f.sb);
    expect(f.calls).toEqual(["linkIdentity", "signInWithOAuth"]);
  });
  it("nobody yet: plain Google sign-in, no copy", async () => {
    const f = fake({ user: null });
    await signInWithGoogle(f.sb);
    expect(f.calls).toEqual(["signInWithOAuth"]);
    expect(store.has(IMPORT_KEY)).toBe(false);
  });
  it("a guest's email: added to the guest; if it already has an account, a sign-in link to it", async () => {
    const linked = fake({ user: { id: GUEST, is_anonymous: true } });
    await signInWithEmail(linked.sb, "a@example.com");
    expect(linked.calls).toEqual(["updateUser"]);
    const existing = fake({ user: { id: GUEST, is_anonymous: true }, updateError: "already been registered" });
    await signInWithEmail(existing.sb, "a@example.com");
    expect(existing.calls).toEqual(["updateUser", "signInWithOtp"]);
  });
});

describe("bringing a guest's designs into the account", () => {
  async function stashAsGuest() {
    const g = fake({ user: { id: GUEST, is_anonymous: true } });
    await signInWithGoogle(g.sb); // takes the copy
  }

  it("into an existing account: one imported party, every design, and the open design follows", async () => {
    await stashAsGuest();
    store.set(SERVER_DRAFT_KEY, JSON.stringify({ userId: GUEST, partyId: "p-guest", itemId: "i-guest-2", savedPrint: "x" }));
    const f = fake({ user: { id: ACCOUNT, is_anonymous: false } });
    expect(await importGuestDesigns(f.sb)).toBe(2);
    const party = f.tables.parties.find((p) => p.owner_id === ACCOUNT)!;
    expect(party).toMatchObject({ title: "Imported from guest session", context: { theme: "frozen" } });
    const mine = f.tables.party_items.filter((i) => i.owner_id === ACCOUNT);
    expect(mine.map((i) => i.config)).toEqual([{ v: 1, n: 1 }, { v: 1, n: 2 }]);
    expect(mine.every((i) => i.party_id === party.id)).toBe(true);
    expect(JSON.parse(store.get(SERVER_DRAFT_KEY)!)).toMatchObject({ userId: ACCOUNT, partyId: party.id, itemId: mine[1].id, savedPrint: "x" });
    expect(store.has(IMPORT_KEY)).toBe(false);
    expect(await importGuestDesigns(f.sb)).toBe(0); // never twice
  });

  it("linked (same user id): nothing to copy", async () => {
    await stashAsGuest();
    const f = fake({ user: { id: GUEST, is_anonymous: false } });
    expect(await importGuestDesigns(f.sb)).toBe(0);
    expect(f.calls).toEqual([]);
    expect(store.has(IMPORT_KEY)).toBe(false);
  });

  it("not signed in yet: waits (the copy is kept)", async () => {
    await stashAsGuest();
    const f = fake({ user: { id: GUEST, is_anonymous: true } });
    expect(await importGuestDesigns(f.sb)).toBe(0);
    expect(store.has(IMPORT_KEY)).toBe(true);
  });

  it("a failed copy is put back to try again", async () => {
    await stashAsGuest();
    const f = fake({ user: { id: ACCOUNT, is_anonymous: false }, failInsert: true });
    await expect(importGuestDesigns(f.sb)).rejects.toThrow("boom");
    expect(store.has(IMPORT_KEY)).toBe(true);
  });

  it("an old copy (over an hour) is ignored", async () => {
    await stashAsGuest();
    const s = JSON.parse(store.get(IMPORT_KEY)!);
    store.set(IMPORT_KEY, JSON.stringify({ ...s, at: Date.now() - 2 * 60 * 60_000 }));
    const f = fake({ user: { id: ACCOUNT, is_anonymous: false } });
    expect(await importGuestDesigns(f.sb)).toBe(0);
  });
});

describe("after signing in", () => {
  const loc = (globalThis as unknown as { window: { location: { pathname: string } } }).window.location;
  beforeEach(() => { loc.pathname = "/builder"; });

  it("signed in to save, or to see a render: back to the Builder, which then takes the action once", () => {
    for (const then of ["save", "render"] as const) {
      rememberReturn(then);
      expect(afterSignIn()).toEqual({ to: "/builder", then });
      expect(takeAfterSignIn()).toBe(then);
      expect(takeAfterSignIn()).toBeNull();
    }
  });
  it("signed in from the top bar: back to that page, nothing left over", () => {
    loc.pathname = "/my-designs";
    rememberReturn();
    expect(afterSignIn()).toEqual({ to: "/my-designs", then: undefined });
    expect(store.has(AFTER_SIGN_IN_KEY)).toBe(false);
  });
  it("old, missing or foreign destinations are ignored", () => {
    expect(afterSignIn()).toBeNull();
    store.set(AFTER_SIGN_IN_KEY, JSON.stringify({ to: "//evil.example", at: Date.now() }));
    expect(afterSignIn()).toBeNull();
    store.set(AFTER_SIGN_IN_KEY, JSON.stringify({ to: "/builder", then: "render", at: Date.now() - 2 * 60 * 60_000 }));
    expect(takeAfterSignIn()).toBeNull(); // too old to act on
    store.set(AFTER_SIGN_IN_KEY, JSON.stringify({ to: "/builder", then: "save", at: Date.now() - 2 * 60 * 60_000 }));
    expect(afterSignIn()).toBeNull();
    expect(store.has(AFTER_SIGN_IN_KEY)).toBe(false);
  });
});
