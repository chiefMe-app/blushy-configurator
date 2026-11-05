// Venue & party details (2026-11-04, the owner): DIY asks for her home address — the party is at home, and what she
// asked us to bring comes there; We do it asks for the venue, when we set up and when we collect.
import { servicePackageById, type BuilderConfig, type VenueDetails } from "@/lib/config";

export type SetupLead = "evening" | "3h" | "2h";
export type Collection = "after" | "next_morning";

export const SETUP_LEADS: { id: SetupLead; name: string; note: string; hours: number | null }[] = [
  { id: "3h", name: "3 hours before", note: "Recommended: time for every piece", hours: 3 },
  { id: "2h", name: "2 hours before", note: "For a smaller setup", hours: 2 },
  { id: "evening", name: "The evening before", note: "For a morning party", hours: null },
];
export const COLLECTIONS: { id: Collection; name: string; note: string }[] = [
  { id: "after", name: "Right after the party", note: "We take it down when the last guest leaves" },
  { id: "next_morning", name: "The next morning", note: "Enjoy the evening, we come back tomorrow" },
];

/** "14:30" less some hours, as "11:30"; "" when the party's time is not set yet. */
export function clockBefore(time: string, hours: number): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) return "";
  const mins = ((Number(m[1]) * 60 + Number(m[2]) - hours * 60) % 1440 + 1440) % 1440;
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

/** When we set up, in words: "11:30 on the day (3 hours before)", "The evening before". */
export function setupWhen(v: Pick<VenueDetails, "time" | "setupLead">): string {
  const lead = SETUP_LEADS.find((l) => l.id === (v.setupLead ?? "3h"))!;
  if (lead.hours === null) return lead.name;
  const at = clockBefore(v.time, lead.hours);
  return at ? `${at} on the day (${lead.name})` : lead.name;
}

/** The Review's rows for where and when, by package. */
export function venueRows(config: BuilderConfig): { k: string; v: string }[] {
  const v = config.venue;
  const diy = servicePackageById(config.servicePackageId)?.id === "diy";
  const or = (s?: string) => (s && s.trim()) || "—";
  const address = [v.unit, v.street, v.area].map((s) => (s ?? "").trim()).filter(Boolean).join(", ");
  const when = [{ k: "Date", v: or(v.date) }, { k: "Party time", v: v.time ? (v.endTime ? `${v.time} – ${v.endTime}` : v.time) : "—" }];
  const grownUps = v.adultsCount ?? Math.max(0, v.guestCount - v.childrenCount);
  const guests = [
    { k: "Children", v: v.childrenCount ? String(v.childrenCount) : "—" },
    { k: "Grown-ups", v: grownUps ? String(grownUps) : "—" },
  ];
  const setting = { k: "Setting", v: v.isOutdoor === undefined ? "—" : v.isOutdoor ? "Outdoor" : "Indoor" };
  if (diy) return [...when, { k: "Delivery address", v: or(address) }, setting, ...(v.notes?.trim() ? [{ k: "Notes", v: v.notes.trim() }] : []), ...guests];
  return [
    ...when,
    { k: "Venue", v: [v.venueType, v.venueName?.trim()].filter(Boolean).join(" · ") || "—" },
    { k: "Address", v: or(address) },
    setting,
    { k: "We set up", v: setupWhen(v) },
    { k: "We collect", v: COLLECTIONS.find((c) => c.id === (v.collection ?? "after"))!.name },
    ...(v.notes?.trim() ? [{ k: "Access notes", v: v.notes.trim() }] : []),
    ...guests,
  ];
}
