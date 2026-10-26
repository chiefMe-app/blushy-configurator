// Phase 0.2: the database rules, run on a real Postgres (PGlite, in memory)
// set up the way Supabase is — the anon / authenticated roles, auth.uid() and
// auth.jwt() read from the request's JWT claims, and Supabase's default
// grants. Then supabase/schema.sql (today's orders table) and the migrations,
// twice (they must be safe to re-run), and their rollbacks.
import fs from "fs";
import path from "path";
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";

const ROOT = path.join(__dirname, "..", "..", "supabase");
const MIGRATIONS = fs.readdirSync(path.join(ROOT, "migrations")).filter((f) => f.endsWith(".sql")).sort();
const ROLLBACKS = fs.readdirSync(path.join(ROOT, "rollback")).filter((f) => f.endsWith(".sql")).sort().reverse();
const read = (...p: string[]) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

const SUPABASE_LIKE = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.jwt() returns jsonb language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on all functions in schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

const A = "00000000-0000-4000-8000-00000000000a"; // a guest (anonymous session)
const B = "00000000-0000-4000-8000-00000000000b"; // another guest
const REAL = "00000000-0000-4000-8000-0000000000cc"; // a signed-in customer
const STAFF = "00000000-0000-4000-8000-0000000000dd";

type Who = "nobody" | { sub: string; anonymous: boolean };
let db: PGlite;

/** Runs one statement as a visitor: no session (anon role) or a signed-in / guest JWT. */
async function as<T = Record<string, unknown>>(who: Who, sql: string, params: unknown[] = []) {
  const claims = who === "nobody" ? "" : JSON.stringify({ sub: who.sub, role: "authenticated", is_anonymous: who.anonymous });
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [claims]);
  await db.exec(`set role ${who === "nobody" ? "anon" : "authenticated"}`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role");
  }
}
const fails = async (p: Promise<unknown>) => { try { await p; return false; } catch { return true; } };
const guest = (sub: string): Who => ({ sub, anonymous: true });
const user = (sub: string): Who => ({ sub, anonymous: false });

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_LIKE);
  await db.exec(read("schema.sql"));
  for (const f of MIGRATIONS) await db.exec(read("migrations", f));
  for (const f of MIGRATIONS) await db.exec(read("migrations", f)); // re-runnable
  await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}'), ('${REAL}'), ('${STAFF}');
                 insert into public.staff (user_id) values ('${STAFF}');`);
}, 60_000);

const order = `insert into public.orders (theme, shape, garland, total_price, customer_name, customer_phone)
               values ('frozen', 'round', 'full', 1090, 'Test', '+971500000000')`;

describe("orders (0.2 · 1/3)", () => {
  it("the configurator can still create an order with the anon key", async () => {
    expect(await fails(as("nobody", order))).toBe(false);
  });
  it("nobody but staff can read orders: not a visitor, not a guest, not a customer", async () => {
    expect(await as("nobody", "select * from public.orders")).toEqual([]);
    expect(await as(guest(A), "select * from public.orders")).toEqual([]);
    expect(await as(user(REAL), "select * from public.orders")).toEqual([]);
    expect((await as(user(STAFF), "select * from public.orders")).length).toBeGreaterThan(0);
  });
  it("why: under today's schema.sql alone, a guest session reads every order", async () => {
    const old = new PGlite();
    await old.exec(SUPABASE_LIKE);
    await old.exec(read("schema.sql"));
    await old.exec(order);
    await old.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: A, is_anonymous: true })]);
    await old.exec("set role authenticated");
    expect((await old.query("select customer_phone from public.orders")).rows).toEqual([{ customer_phone: "+971500000000" }]);
    await old.close();
  }, 60_000);
  it("the staff list itself is closed to the app", async () => {
    expect(await as(user(REAL), "select * from public.staff")).toEqual([]);
    expect(await fails(as(user(REAL), `insert into public.staff (user_id) values ('${REAL}')`))).toBe(true);
  });
});

describe("helpers (0.2 · 2/3)", () => {
  it("is_real_user: a customer yes, a guest or a visitor no", async () => {
    expect((await as<{ r: boolean }>(user(REAL), "select public.is_real_user() as r"))[0].r).toBe(true);
    expect((await as<{ r: boolean }>(guest(A), "select public.is_real_user() as r"))[0].r).toBe(false);
    expect((await as<{ r: boolean }>("nobody", "select public.is_real_user() as r"))[0].r).toBe(false);
  });
});

describe("parties and items (0.2 · 3/3)", () => {
  let partyA = "";
  it("a guest creates a party and puts a backdrop design in it", async () => {
    partyA = (await as<{ id: string }>(guest(A), `insert into public.parties (title) values ('Arya''s 5th') returning id`))[0].id;
    const item = await as<{ owner_id: string; status: string }>(guest(A),
      `insert into public.party_items (party_id, kind, ref_id, config) values ($1, 'product', 'studio.backdrop', '{"theme":"frozen"}') returning owner_id, status`, [partyA]);
    expect(item[0]).toEqual({ owner_id: A, status: "draft" });
    expect((await as(guest(A), "select * from public.parties")).length).toBe(1);
  });
  it("another guest cannot see, change, delete or add to it", async () => {
    expect(await as(guest(B), "select * from public.parties")).toEqual([]);
    expect(await as(guest(B), "select * from public.party_items")).toEqual([]);
    expect(await as(guest(B), `update public.parties set title = 'mine' where id = $1 returning id`, [partyA])).toEqual([]);
    expect(await as(guest(B), `delete from public.parties where id = $1 returning id`, [partyA])).toEqual([]);
    expect(await fails(as(guest(B), `insert into public.party_items (party_id, kind, ref_id) values ($1, 'product', 'studio.backdrop')`, [partyA]))).toBe(true);
  });
  it("nobody can create a party in someone else's name, or hand one over", async () => {
    expect(await fails(as(guest(B), `insert into public.parties (owner_id, title) values ('${A}', 'x')`))).toBe(true);
    expect(await fails(as(guest(A), `update public.parties set owner_id = '${B}' where id = $1`, [partyA]))).toBe(true);
  });
  it("a visitor with no session can do nothing", async () => {
    expect(await fails(as("nobody", "select * from public.parties"))).toBe(true);
    expect(await fails(as("nobody", `insert into public.parties (title) values ('x')`))).toBe(true);
  });
  it("only draft items, known fulfilment and a plain item id", async () => {
    expect(await fails(as(guest(A), `insert into public.party_items (party_id, kind, ref_id, status) values ($1, 'product', 'studio.backdrop', 'confirmed')`, [partyA]))).toBe(true);
    expect(await fails(as(guest(A), `insert into public.party_items (party_id, kind, ref_id, fulfillment) values ($1, 'product', 'studio.backdrop', 'free')`, [partyA]))).toBe(true);
    expect(await fails(as(guest(A), `insert into public.party_items (party_id, kind, ref_id) values ($1, 'product', 'Robert''); drop table x')`, [partyA]))).toBe(true);
  });
  it("staff can read every party (support); updated_at moves on change", async () => {
    expect((await as(user(STAFF), "select * from public.parties")).length).toBe(1);
    const before = (await db.query<{ u: string }>(`select updated_at::text as u from public.parties where id = $1`, [partyA])).rows[0].u;
    await new Promise((r) => setTimeout(r, 5));
    await as(guest(A), `update public.parties set title = 'Arya''s party' where id = $1`, [partyA]);
    const after = (await db.query<{ u: string }>(`select updated_at::text as u from public.parties where id = $1`, [partyA])).rows[0].u;
    expect(after > before).toBe(true);
  });
});

describe("the one-file version for the SQL editor", () => {
  it("supabase/apply/phase-0.2.sql is exactly the migrations, in order", () => {
    const apply = read("apply", "phase-0.2.sql").replace(/\r\n/g, "\n");
    const body = MIGRATIONS.map((f) => `\n-- ===== ${f} =====\n` + read("migrations", f).replace(/\r\n/g, "\n")).join("");
    expect(apply.endsWith(body)).toBe(true);
  });
  it("and runs on its own, twice", async () => {
    const fresh = new PGlite();
    await fresh.exec(SUPABASE_LIKE);
    await fresh.exec(read("schema.sql"));
    await fresh.exec(read("apply", "phase-0.2.sql"));
    await fresh.exec(read("apply", "phase-0.2.sql"));
    await fresh.close();
  }, 60_000);
});

describe("rollback", () => {
  it("every migration undoes cleanly and applies again", async () => {
    const fresh = new PGlite();
    await fresh.exec(SUPABASE_LIKE);
    await fresh.exec(read("schema.sql"));
    for (const f of MIGRATIONS) await fresh.exec(read("migrations", f));
    for (const f of ROLLBACKS) await fresh.exec(read("rollback", f));
    const left = await fresh.query<{ t: string }>(`select table_name as t from information_schema.tables where table_schema = 'public' order by 1`);
    expect(left.rows.map((r) => r.t)).toEqual(["orders"]);
    for (const f of MIGRATIONS) await fresh.exec(read("migrations", f));
    await fresh.close();
  }, 60_000);
});
