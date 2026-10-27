// lib/renderAccount.ts (Phase 0.5b): a paid render needs a signed-in account,
// and each account has a daily limit, counted by the database's take_render.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { renderUser, takeAccountRender, resetAccountRenderFallback, LIMIT_REACHED } from "@/lib/renderAccount";

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: { getUser } }) }));

const ENV = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "VERCEL_ENV", "RENDER_LIMIT_PER_USER_DAY"];
const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const k of ENV) { saved[k] = process.env[k]; delete process.env[k]; }
  getUser.mockReset();
  resetAccountRenderFallback();
});
afterEach(() => { for (const k of ENV) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

const withDb = () => { process.env.SUPABASE_URL = "https://x.supabase.co"; process.env.SUPABASE_ANON_KEY = "anon"; };
const headers = (token?: string) => new Headers(token ? { authorization: `Bearer ${token}` } : {});

describe("who is asking", () => {
  it("no database here (development, tests): renders are not checked", async () => {
    expect(await renderUser(headers())).toEqual({ ok: true, userId: null, client: null });
  });
  it("no database on the live site: renders stay closed", async () => {
    process.env.VERCEL_ENV = "production";
    expect(await renderUser(headers())).toMatchObject({ ok: false, status: 503 });
  });
  it("signed out: asks to sign in, without asking Supabase", async () => {
    withDb();
    expect(await renderUser(headers())).toMatchObject({ ok: false, status: 401, signin: true });
    expect(getUser).not.toHaveBeenCalled();
  });
  it("a token Supabase does not accept, or a guest session: asks to sign in", async () => {
    withDb();
    getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: "invalid JWT" } });
    expect(await renderUser(headers("bad"))).toMatchObject({ ok: false, status: 401, signin: true });
    getUser.mockResolvedValueOnce({ data: { user: { id: "g", is_anonymous: true } }, error: null });
    expect(await renderUser(headers("guest"))).toMatchObject({ ok: false, status: 401, signin: true });
  });
  it("a signed-in customer", async () => {
    withDb();
    getUser.mockResolvedValueOnce({ data: { user: { id: "u1", is_anonymous: false } }, error: null });
    expect(await renderUser(headers("good"))).toMatchObject({ ok: true, userId: "u1" });
    expect(getUser).toHaveBeenCalledWith("good");
  });
});

describe("the daily limit per account", () => {
  const client = (answer: { data: unknown; error: unknown }) => {
    const rpc = vi.fn().mockResolvedValue(answer);
    return { rpc, user: { userId: "u1", client: { rpc } as unknown as SupabaseClient } };
  };
  it("counted by the database with the server's limit", async () => {
    process.env.RENDER_LIMIT_PER_USER_DAY = "5";
    const c = client({ data: 4, error: null });
    expect(await takeAccountRender(c.user)).toEqual({ ok: true, left: 4 });
    expect(c.rpc).toHaveBeenCalledWith("take_render", { p_daily_limit: 5 });
  });
  it("limit reached, or not an account", async () => {
    expect(await takeAccountRender(client({ data: -2, error: null }).user)).toEqual({ ok: false, status: 429, error: LIMIT_REACHED(20), limited: true });
    expect(await takeAccountRender(client({ data: -1, error: null }).user)).toMatchObject({ ok: false, status: 401, signin: true });
  });
  it("the SQL not run yet: counted in memory, so the limit still holds", async () => {
    process.env.RENDER_LIMIT_PER_USER_DAY = "2";
    const c = client({ data: null, error: { message: "Could not find the function public.take_render" } });
    expect(await takeAccountRender(c.user)).toEqual({ ok: true, left: 1 });
    expect(await takeAccountRender(c.user)).toEqual({ ok: true, left: 0 });
    expect(await takeAccountRender(c.user)).toMatchObject({ ok: false, status: 429, limited: true });
  });
  it("no database here: nothing to count", async () => {
    expect(await takeAccountRender({ userId: null, client: null })).toEqual({ ok: true, left: 20 });
  });
});
