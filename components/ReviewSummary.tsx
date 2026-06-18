"use client";

import {
  eventTypeById,
  themeById,
  packageById,
  shapeById,
  balloonStyleById,
  plinthSizeById,
  cutoutSetBySize,
  backdropPrintById,
  resolveBackdropText,
  addOnById,
  type BuilderConfig,
} from "@/lib/config";
import PriceSummary from "./PriceSummary";

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <dt className="text-black/50">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/40">
        {title}
      </h4>
      <dl>{children}</dl>
    </div>
  );
}

export default function ReviewSummary({ config }: { config: BuilderConfig }) {
  const { decor, venue, customer } = config;

  return (
    <div className="space-y-4">
      <Section title="Event">
        <Row k="Type" v={eventTypeById(config.eventType)?.label ?? "—"} />
        <Row k="Theme" v={themeById(config.theme)?.name ?? "—"} />
        <Row k="Package" v={packageById(config.package)?.label ?? "—"} />
      </Section>

      <Section title="Decor">
        <Row k="Backdrop panels" v={String(decor.backdropShapes.length)} />
        <Row k="Shapes" v={decor.backdropShapes.map((s) => shapeById(s)?.label ?? s).join(", ")} />
        <Row k="Balloons" v={balloonStyleById(decor.balloonStyle)?.label ?? "—"} />
        <div className="flex items-center justify-between gap-4 py-1 text-sm">
          <dt className="text-black/50">Balloon colors</dt>
          <dd className="flex gap-1">
            {decor.balloonColors.map((c, i) => (
              <span
                key={i}
                className="h-4 w-4 rounded-full border border-black/10"
                style={{ backgroundColor: c }}
              />
            ))}
          </dd>
        </div>
        <Row
          k="Plinths"
          v={
            decor.plinthSizes.length
              ? decor.plinthSizes
                  .map((s) => plinthSizeById(s)?.label ?? s)
                  .join(", ")
              : "None"
          }
        />
        <Row
          k="Cutouts"
          v={
            decor.cutouts.size === "none"
              ? "None"
              : `${cutoutSetBySize(decor.cutouts.size)?.label} (${
                  decor.cutouts.position === "backdrop" ? "on backdrop" : "on floor"
                })`
          }
        />
        <Row
          k="Backdrop print"
          v={
            !decor.backdropPrint || decor.backdropPrint.type === "none"
              ? "None"
              : backdropPrintById(decor.backdropPrint.type)?.label ?? decor.backdropPrint.type
          }
        />
        <Row
          k="Backdrop text"
          v={decor.backdropText.enabled ? `"${resolveBackdropText(decor.backdropText)}"` : "None"}
        />
        <Row k="Cake / dessert table" v={decor.cakeTable ? "Yes" : "No"} />
      </Section>

      {config.addOns.length > 0 && (
        <Section title="Add-ons">
          {config.addOns.map((a) => {
            const addon = addOnById(a.id);
            const opts = a.options
              ? Object.values(a.options).filter(Boolean).join(", ")
              : "";
            return (
              <Row
                key={a.id}
                k={addon?.label ?? a.id}
                v={opts || "Selected"}
              />
            );
          })}
        </Section>
      )}

      <Section title="Venue &amp; contact">
        <Row k="Name" v={customer.name || "—"} />
        <Row k="WhatsApp" v={customer.whatsapp || "—"} />
        <Row k="Date" v={venue.date || "—"} />
        <Row k="Time" v={venue.time || "—"} />
        <Row k="Area" v={venue.area || "—"} />
        <Row k="Venue type" v={venue.venueType || "—"} />
        <Row k="Setting" v={venue.isOutdoor ? "Outdoor" : "Indoor"} />
        <Row k="Guests" v={venue.guestCount ? String(venue.guestCount) : "—"} />
        <Row k="Children" v={venue.childrenCount ? String(venue.childrenCount) : "—"} />
        <Row k="Photos" v={venue.photos.length ? `${venue.photos.length} uploaded` : "None"} />
      </Section>

      <PriceSummary config={config} />

      <p className="rounded-2xl bg-accent-soft/40 p-3 text-center text-[11px] leading-relaxed text-black/55">
        Final quote may vary after date, venue access, space, and availability confirmation.
      </p>
    </div>
  );
}
