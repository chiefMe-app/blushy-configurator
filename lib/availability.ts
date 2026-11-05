// Availability and the demo payment (2026-11-05, the owner: "ikinci paket icin tarih girdikten sonra event firmasninda
// musaitliginin yaninda tik olduktan sonra odeme alincak"). We do it: once she gives the date, the setup team's
// availability is shown with a tick, and only then can she pay. Every supplier of the party (the setup team, each
// experience) confirms after; the card is charged only when all of them have (2026-11-03 roadmap).
//
// DEMO until release (RELEASE_CHECKLIST.md): availability is not read from a calendar, and no card is asked for or
// taken — the payment only says it was authorized. Shared by the builder and app/api/orders.
import type { BuilderConfig } from "@/lib/config";
import { EXPERIENCES } from "@/lib/studio/experiences";

/** Placeholder until the owner sets it: how many days ahead the setup team needs to prepare. */
export const MIN_LEAD_DAYS = 3;

export type Availability =
  | { ok: true; date: string }
  | { ok: false; reason: "no_date" | "bad_date" | "past" | "too_soon"; message: string };

/** Today's date in Dubai, YYYY-MM-DD. */
export function dubaiToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

const dayNumber = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);

/** Whether the setup team is free on the party's date (demo: free on any date far enough ahead). */
export function setupAvailability(date: string | undefined, now = new Date()): Availability {
  const d = (date ?? "").trim();
  if (!d) return { ok: false, reason: "no_date", message: "Add your party date to check we're free." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(`${d}T00:00:00Z`))) return { ok: false, reason: "bad_date", message: "That date doesn't look right." };
  const ahead = dayNumber(d) - dayNumber(dubaiToday(now));
  if (ahead < 0) return { ok: false, reason: "past", message: "That date has passed — pick a day ahead." };
  if (ahead < MIN_LEAD_DAYS) return { ok: false, reason: "too_soon", message: `Too soon for us — we need at least ${MIN_LEAD_DAYS} days to make your party.` };
  return { ok: true, date: d };
}

/** The date as she reads it: "Sat, 12 Dec 2026". */
export function niceDate(iso: string): string {
  const t = Date.parse(`${iso}T12:00:00Z`);
  return Number.isNaN(t) ? iso : new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(t);
}

export interface Supplier { id: string; name: string }

/** Who has to confirm the party before the card is charged: the setup team (We do it), and each experience booked. */
export function partySuppliers(config: Pick<BuilderConfig, "servicePackageId" | "experiences" | "diy">): Supplier[] {
  const diy = config.servicePackageId === "diy";
  const skip = new Set(diy ? config.diy?.skipExperiences ?? [] : []);
  const experiences = (config.experiences?.picked ?? []).filter((id) => !skip.has(id))
    .map((id) => EXPERIENCES.find((e) => e.id === id)).filter((e): e is (typeof EXPERIENCES)[number] => !!e)
    .map((e) => ({ id: e.id, name: e.name }));
  return [...(diy ? [] : [{ id: "setup", name: "PartyMuse setup team" }]), ...experiences];
}

/** What still stands before she can pay: her name and WhatsApp, and — We do it — a date the setup team is free on. */
export function paymentBlockers(config: Pick<BuilderConfig, "servicePackageId" | "venue" | "customer">, now = new Date()): string[] {
  const out: string[] = [];
  if (config.customer.name.trim().length < 2 || config.customer.whatsapp.trim().length < 7) out.push("Add your name and WhatsApp number in the Venue step.");
  if (config.servicePackageId !== "diy") {
    const a = setupAvailability(config.venue.date, now);
    if (!a.ok) out.push(a.message);
  }
  return out;
}
