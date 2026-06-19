import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSupabase } from "@/lib/supabase";
import {
  themeById,
  packageById,
  computeTotal,
  type BuilderConfig,
} from "@/lib/config";

export const runtime = "nodejs";

// The payload mirrors BuilderConfig but venue.photos arrives as lightweight
// metadata (name/size) since Files can't be JSON-serialized.
interface OrderPayload extends Omit<BuilderConfig, "venue"> {
  venue: Omit<BuilderConfig["venue"], "photos"> & {
    photos?: { name: string; size: number }[];
  };
}

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

  // Recompute total server-side — never trust the client value.
  const pricingConfig = {
    ...body,
    venue: { ...body.venue, photos: [] },
  } as unknown as BuilderConfig;
  const total = computeTotal(pricingConfig);

  const id = randomUUID();
  const createdAt = new Date().toISOString();

  // Full config snapshot stored as jsonb for the team to action.
  const extras = {
    eventType: body.eventType,
    package: body.package,
    decor: body.decor,
    addOns: body.addOns,
    venue: body.venue,
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
    return NextResponse.json({ designId: id, total, persisted: false });
  }

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
      return NextResponse.json(
        { error: "Failed to save request", detail: error.message },
        { status: 502 }
      );
    }

    return NextResponse.json({
      order: { id, created_at: createdAt, total_price: total, status: "pending" },
      designId: id,
      total,
      persisted: true,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Order service unavailable", detail: String(err) },
      { status: 500 }
    );
  }
}
