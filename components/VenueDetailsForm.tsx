"use client";

// The party's details (2026-11-04, by package): who she is and when the party is, then — DIY — her home address,
// where what she asked us to bring comes; — We do it — the venue, when we set up and when we collect. No photos of
// the space (2026-11-04, the owner: "Photo upload etmesine gerek yok"): indoors or outdoors is marked on the party's
// picture instead (components/builder/venue/PartyPreview.tsx).
import { VENUE_TYPES, type VenueDetails, type CustomerDetails } from "@/lib/config";
import { COLLECTIONS, SETUP_LEADS, clockBefore } from "@/lib/venue";

export default function VenueDetailsForm({
  venue,
  customer,
  onVenue,
  onCustomer,
  diy = false,
  fromUs = [],
}: {
  venue: VenueDetails;
  customer: CustomerDetails;
  onVenue: (patch: Partial<VenueDetails>) => void;
  onCustomer: (patch: Partial<CustomerDetails>) => void;
  /** The DIY package: her home, nothing to set up. */
  diy?: boolean;
  /** DIY: what she asked us to bring, by name, to say when it comes. */
  fromUs?: string[];
}) {
  const field =
    "w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";
  const labelCls = "mb-1 block text-xs font-medium text-black/55";
  const adults = venue.adultsCount ?? Math.max(0, venue.guestCount - venue.childrenCount);
  const setCounts = (children: number, grownUps: number) =>
    onVenue({ childrenCount: children, adultsCount: grownUps, guestCount: children + grownUps });
  const text = (label: string, key: "area" | "street" | "unit" | "venueName", placeholder: string, wide = false) => (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label className={labelCls}>{label}</label>
      <input className={field} value={venue[key] ?? ""} onChange={(e) => onVenue({ [key]: e.target.value })} placeholder={placeholder} aria-label={label} />
    </div>
  );
  const option = (on: boolean, pick: () => void, name: string, note: string, key: string) => (
    <button key={key} type="button" role="radio" aria-checked={on} className={`bz-tb-option ${on ? "on" : ""}`} onClick={pick}>
      {on && <span className="tick">✓</span>}
      <b>{name}</b>{note && <small>{note}</small>}
    </button>
  );

  return (
    <div className="space-y-5">
      <section className="bz-vn-section" aria-label="About you">
        <h3>About you</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Your name</label>
            <input className={field} value={customer.name} onChange={(e) => onCustomer({ name: e.target.value })} placeholder="Full name" />
          </div>
          <div>
            <label className={labelCls}>WhatsApp number</label>
            <input type="tel" className={field} value={customer.whatsapp} onChange={(e) => onCustomer({ whatsapp: e.target.value })} placeholder="+971 5x xxx xxxx" />
          </div>
        </div>
      </section>

      <section className="bz-vn-section" aria-label="When">
        <h3>When</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Party date</label>
            <input type="date" className={field} value={venue.date} onChange={(e) => onVenue({ date: e.target.value })} aria-label="Party date" />
          </div>
          <div>
            <label className={labelCls}>Starts at</label>
            <input type="time" className={field} value={venue.time} onChange={(e) => onVenue({ time: e.target.value })} aria-label="Starts at" />
          </div>
          <div>
            <label className={labelCls}>Ends at</label>
            <input type="time" className={field} value={venue.endTime ?? ""} onChange={(e) => onVenue({ endTime: e.target.value })} aria-label="Ends at" />
          </div>
          <div>
            <label className={labelCls}>Children</label>
            <input type="number" min={0} className={field} value={venue.childrenCount || ""} placeholder="0" aria-label="Children"
              onChange={(e) => setCounts(Math.max(0, Number(e.target.value) || 0), adults)} />
          </div>
          <div>
            <label className={labelCls}>Grown-ups</label>
            <input type="number" min={0} className={field} value={adults || ""} placeholder="0" aria-label="Grown-ups"
              onChange={(e) => setCounts(venue.childrenCount, Math.max(0, Number(e.target.value) || 0))} />
          </div>
        </div>
      </section>

      {diy ? (
        <section className="bz-vn-section" aria-label="Your home address" data-testid="venue-home">
          <h3>Your home address</h3>
          <p className="sub">{fromUs.length
            ? `Your party is at home: we bring ${fromUs.length > 1 ? `${fromUs.slice(0, -1).join(", ")} and ${fromUs[fromUs.length - 1]}` : fromUs[0]} here.`
            : "Your party is at home — so we know where it is, and where to send anything you add later."}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {text("Area / community", "area", "e.g. Jumeirah, Dubai", true)}
            {text("Street & building or villa", "street", "e.g. Al Wasl Road, Villa 12")}
            {text("Apartment or villa number", "unit", "e.g. 1204")}
            <div className="sm:col-span-2">
              <label className={labelCls}>Notes for our team (optional)</label>
              <input className={field} value={venue.notes ?? ""} onChange={(e) => onVenue({ notes: e.target.value })} placeholder="Gate code, parking, which entrance" aria-label="Notes for our team" />
            </div>
          </div>
          {fromUs.length > 0 && <p className="bz-vn-when">What we bring arrives an hour before the party{venue.time && clockBefore(venue.time, 1) ? ` — at ${clockBefore(venue.time, 1)}` : ""}; your experiences at the party&apos;s start.</p>}
        </section>
      ) : <>
        <section className="bz-vn-section" aria-label="Your venue" data-testid="venue-place">
          <h3>Your venue</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Venue type</label>
              <select className={field} value={venue.venueType} onChange={(e) => onVenue({ venueType: e.target.value })} aria-label="Venue type">
                <option value="">Select…</option>
                {VENUE_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            {text("Venue name (if it has one)", "venueName", "e.g. a restaurant or a hall")}
            {text("Area / community", "area", "e.g. Jumeirah, Dubai", true)}
            {text("Street & building", "street", "e.g. Al Wasl Road, Villa 12")}
            {text("Room, floor or villa number", "unit", "e.g. Ballroom 2")}
            <div className="sm:col-span-2">
              <label className={labelCls}>Access notes (optional)</label>
              <input className={field} value={venue.notes ?? ""} onChange={(e) => onVenue({ notes: e.target.value })} placeholder="Lift, parking, the venue's setup rules" aria-label="Access notes" />
            </div>
          </div>
        </section>

        <section className="bz-vn-section" aria-label="Setup and collection" data-testid="venue-setup">
          <h3>When we set up</h3>
          <div className="bz-tb-options compact" role="radiogroup" aria-label="When we set up" data-testid="venue-setup-lead">
            {SETUP_LEADS.map((l) => {
              const at = l.hours !== null ? clockBefore(venue.time, l.hours) : "";
              return option((venue.setupLead ?? "3h") === l.id, () => onVenue({ setupLead: l.id }), at ? `${l.name} · ${at}` : l.name, l.note, l.id);
            })}
          </div>
          <h3 style={{ marginTop: 14 }}>When we collect</h3>
          <div className="bz-tb-options compact" role="radiogroup" aria-label="When we collect" data-testid="venue-collection">
            {COLLECTIONS.map((c) => option((venue.collection ?? "after") === c.id, () => onVenue({ collection: c.id }), c.name, c.note, c.id))}
          </div>
        </section>

      </>}
    </div>
  );
}
