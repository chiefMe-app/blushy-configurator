import { NextRequest, NextResponse } from "next/server";
import { readGiveaways } from "@/lib/studio/giveaways";
import { readPinata } from "@/lib/studio/pinata";
import { readHelium } from "@/lib/studio/helium";
import { readExperiences } from "@/lib/studio/experiences";
import { readCake } from "@/lib/studio/cake";
import { randomUUID } from "node:crypto";
import { getSupabase } from "@/lib/supabase";
import { partySuppliers, setupAvailability } from "@/lib/availability";
import {
  themeById,
  packageById,
  readServicePackageId,
  readDiy,
  computeTotal,
  cleanNotes,
  type BuilderConfig,
} from "@/lib/config";

export const runtime = "nodejs";

// The payload mirrors BuilderConfig (the venue photos were dropped on 2026-11-04: the party's picture is made instead).
type OrderPayload = BuilderConfig;

export async function POST(req: NextRequest) {
  let body: OrderPayload;
  try {
    body = (await req.json()) as OrderPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // --- validation ----------------------------------------------------------
  if (!body.customer?.name?.trim() || !body.customer?.whatsapp?.trim()) {
    return NextResponse.json(
      { error: "Name and WhatsApp number are required." },
      { status: 400 }
    );
  }
  if (!themeById(body.theme) || !packageById(body.package)) {
    return NextResponse.json({ error: "Invalid theme or package." }, { status: 400 });
  }
  // servicePackageId is what the client's Package step (step 3) actually sets.
  // Without this check a missing/invalid value would silently fall back to the
  // cheapest service package inside computeTotal() below instead of failing loudly.
  const servicePackageId = readServicePackageId(body.servicePackageId);
  if (!servicePackageId) {
    return NextResponse.json({ error: "Invalid service package." }, { status: 400 });
  }

  // Recompute total server-side — never trust the client value.
  // 2026-10-25: the theme surcharge was missing from every saved total (AED
  // 30-60 below the Review total). The builder did not send themeSelected, and
  // priceBreakdown() only charges the theme when it is set. An order can only
  // be submitted after the Theme step, which cannot be passed without picking
  // a theme, so a valid theme is a selected one. Set here rather than read from
  // the body, so a client cannot drop the surcharge by omitting it.
  const pricingConfig = {
    ...body,
    themeSelected: true,
    // Read over the defaults, so a malformed one cannot break the sum.
    giveaways: readGiveaways(body.giveaways),
    pinata: readPinata(body.pinata),
    cake: readCake(body.cake),
    helium: readHelium(body.helium),
    experiences: readExperiences(body.experiences),
    servicePackageId,
    diy: readDiy(body.diy),
  } as unknown as BuilderConfig;
  const total = computeTotal(pricingConfig);
  // We do it: only on a date the setup team is free (2026-11-05, lib/availability.ts) — the same check as the builder's.
  if (servicePackageId !== "diy") {
    const free = setupAvailability(body.venue?.date);
    if (!free.ok) return NextResponse.json({ error: free.message }, { status: 400 });
  }
  // The DEMO payment until release: nothing asked for or charged; held, to be charged once every supplier confirms.
  const payment = {
    mode: "demo" as const,
    status: "authorized" as const,
    amount: total,
    chargedWhen: "every supplier has confirmed",
    suppliers: partySuppliers({ servicePackageId, experiences: pricingConfig.experiences, diy: pricingConfig.diy }).map((s) => ({ ...s, status: "waiting" as const })),
  };

  const id = randomUUID();
  const createdAt = new Date().toISOString();

  // Full config snapshot stored as jsonb for the team to action.
  const extras = {
    eventType: body.eventType,
    package: body.package,
    servicePackageId,
    decor: body.decor,
    // The tables and the welcome board are priced in the total: the team needs their choices too (2026-10-31).
    table: body.table,
    adultTable: body.adultTable,
    welcomeBoard: body.welcomeBoard,
    giveaways: pricingConfig.giveaways,
    pinata: pricingConfig.pinata,
    cake: pricingConfig.cake,
    helium: pricingConfig.helium,
    experiences: pricingConfig.experiences,
    diy: pricingConfig.diy,
    addOns: body.addOns,
    // Her notes for the design team (2026-11-05), as she wrote them.
    notes: cleanNotes(body.notes),
    venue: body.venue,
    payment,
  };

  // If Supabase isn't configured, log the payload and return a design id.
  let supabase;
  try {
    supabase = getSupabase();
  } catch {
    // eslint-disable-next-line no-console
    console.log("[orders] Supabase not configured — payload:", {
      id,
      total,
      ...body,
    });
    return NextResponse.json({ designId: id, total, payment, persisted: false });
  }

  // 2026-10-26: the live site pointed at a Supabase project that no longer
  // exists, and every request failed without a trace. A request that cannot
  // be saved is now written to the server log (Vercel → Logs) in full, so
  // the team can still contact the customer.
  const keepForFollowUp = (reason: string) => {
    // eslint-disable-next-line no-console
    console.error("[orders] NOT SAVED — follow up from this log:", JSON.stringify({ reason, id, createdAt, total, theme: body.theme, customer: body.customer, venue: body.venue, decor: body.decor, experiences: pricingConfig.experiences, addOns: body.addOns, servicePackageId: body.servicePackageId }));
  };

  try {
    const { error } = await supabase.from("orders").insert({
      id,
      created_at: createdAt,
      theme: body.theme,
      shape: body.decor.backdropItems.map((i: { type: string; sizeId?: string }) => i.sizeId ?? i.type).join(","),
      garland: body.decor.balloonStyle,
      extras,
      custom_text: body.customer.name,
      total_price: total,
      status: "pending",
      customer_name: body.customer.name.trim(),
      customer_phone: body.customer.whatsapp.trim(),
    });

    if (error) {
      keepForFollowUp(error.message);
      return NextResponse.json(
        { error: "Failed to save request", detail: error.message },
        { status: 502 }
      );
    }

    return NextResponse.json({
      order: { id, created_at: createdAt, total_price: total, status: "pending" },
      designId: id,
      total,
      payment,
      persisted: true,
    });
  } catch (err) {
    keepForFollowUp(String(err));
    return NextResponse.json(
      { error: "Order service unavailable", detail: String(err) },
      { status: 500 }
    );
  }
}
