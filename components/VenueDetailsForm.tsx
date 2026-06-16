"use client";

import { useEffect, useState } from "react";
import {
  VENUE_TYPES,
  type VenueDetails,
  type CustomerDetails,
} from "@/lib/config";

export default function VenueDetailsForm({
  venue,
  customer,
  onVenue,
  onCustomer,
}: {
  venue: VenueDetails;
  customer: CustomerDetails;
  onVenue: (patch: Partial<VenueDetails>) => void;
  onCustomer: (patch: Partial<CustomerDetails>) => void;
}) {
  // Local object URLs for thumbnail previews (revoked on change/unmount).
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    const urls = venue.photos.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [venue.photos]);

  function addPhotos(files: FileList | null) {
    if (!files) return;
    const incoming = Array.from(files).filter((f) => f.type.startsWith("image/"));
    onVenue({ photos: [...venue.photos, ...incoming].slice(0, 8) });
  }

  function removePhoto(idx: number) {
    onVenue({ photos: venue.photos.filter((_, i) => i !== idx) });
  }

  const field =
    "w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";
  const labelCls = "mb-1 block text-xs font-medium text-black/55";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Your name</label>
          <input
            className={field}
            value={customer.name}
            onChange={(e) => onCustomer({ name: e.target.value })}
            placeholder="Full name"
          />
        </div>
        <div>
          <label className={labelCls}>WhatsApp number</label>
          <input
            type="tel"
            className={field}
            value={customer.whatsapp}
            onChange={(e) => onCustomer({ whatsapp: e.target.value })}
            placeholder="+971 5x xxx xxxx"
          />
        </div>
        <div>
          <label className={labelCls}>Event date</label>
          <input
            type="date"
            className={field}
            value={venue.date}
            onChange={(e) => onVenue({ date: e.target.value })}
          />
        </div>
        <div>
          <label className={labelCls}>Event time</label>
          <input
            type="time"
            className={field}
            value={venue.time}
            onChange={(e) => onVenue({ time: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Area / location (Dubai / UAE)</label>
          <input
            className={field}
            value={venue.area}
            onChange={(e) => onVenue({ area: e.target.value })}
            placeholder="e.g. Jumeirah, Dubai"
          />
        </div>
        <div>
          <label className={labelCls}>Venue type</label>
          <select
            className={field}
            value={venue.venueType}
            onChange={(e) => onVenue({ venueType: e.target.value })}
          >
            <option value="">Select…</option>
            {VENUE_TYPES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Indoor or outdoor</label>
          <div className="flex gap-2">
            {[
              { v: false, l: "Indoor" },
              { v: true, l: "Outdoor" },
            ].map((o) => (
              <button
                key={o.l}
                type="button"
                onClick={() => onVenue({ isOutdoor: o.v })}
                className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  venue.isOutdoor === o.v
                    ? "bg-accent text-white"
                    : "bg-white text-black/60 border border-black/15"
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls}>Approx. guest count</label>
          <input
            type="number"
            min={0}
            className={field}
            value={venue.guestCount || ""}
            onChange={(e) => onVenue({ guestCount: Number(e.target.value) || 0 })}
            placeholder="0"
          />
        </div>
        <div>
          <label className={labelCls}>Approx. children count</label>
          <input
            type="number"
            min={0}
            className={field}
            value={venue.childrenCount || ""}
            onChange={(e) => onVenue({ childrenCount: Number(e.target.value) || 0 })}
            placeholder="0"
          />
        </div>
      </div>

      {/* Photo upload */}
      <div className="rounded-2xl border border-dashed border-accent/40 bg-accent-soft/30 p-4">
        <label className="mb-1 block text-sm font-medium">Upload 3–5 photos of your space</label>
        <p className="mb-3 text-[11px] text-black/50">
          Final layout is confirmed after venue review.
        </p>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => addPhotos(e.target.files)}
          className="block w-full text-xs text-black/60 file:mr-3 file:rounded-full file:border-0 file:bg-accent file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white"
        />
        {previews.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {previews.map((src, i) => (
              <div key={i} className="group relative aspect-square overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Venue ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[11px] text-white"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
