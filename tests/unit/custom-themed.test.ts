// The Customized Themed set (2026-11-01, the owner: "customized themed diye bir
// seçenek eklensin … birebir aynısını frozen'a yapalım"): the theme's whole set
// as photographed, the name laid on live, never rendered.
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/generate-controlled-render/route";
import { backdropItemPrice, defaultConfig, priceBreakdown, PER_BACKDROP, THEMED_SET_PRICE } from "@/lib/config";
import { getSetupLayoutTemplate, inferSetupLayoutTemplateIdFromBackdropItems, SETUP_LAYOUT_TEMPLATES } from "@/lib/setupLayoutCatalog";
import { SETUP_ICON } from "@/components/builder/constants";
import { withSetup, withTheme } from "../fixtures/builder";

const inPublic = (url: string) => existsSync(path.join(process.cwd(), "public", url));

describe("Customized Themed set", () => {
  it("is offered on Frozen only, as one set on its own stage", () => {
    const tpl = getSetupLayoutTemplate("custom_themed")!;
    expect(tpl.themes).toEqual(["frozen"]);
    expect(tpl.backdropTypes).toEqual(["themed_set"]);
    // Every other setup is offered on every theme.
    expect(SETUP_LAYOUT_TEMPLATES.filter((t) => t.themes).map((t) => t.id)).toEqual(["custom_themed"]);
    const c = withSetup(withTheme(defaultConfig(), "frozen"), "custom_themed");
    expect(inferSetupLayoutTemplateIdFromBackdropItems(c.decor.backdropItems)).toBe("custom_themed");
    expect(c.decor.backdropItems[0]).toMatchObject({ type: "themed_set", widthCm: 400, heightCm: 250 });
    expect(c.decor.plinthSizes).toEqual([]);
    // The name goes on it.
    expect(c.decor.backdropItems[0].text.enabled).toBe(true);
  });

  it("has its own price (a placeholder until the owner prices it)", () => {
    expect(backdropItemPrice("themed_set")).toBe(THEMED_SET_PRICE);
    expect(backdropItemPrice("shimmer_wall")).toBe(PER_BACKDROP + 80);
    expect(backdropItemPrice("wavy")).toBe(PER_BACKDROP);
    const c = withSetup(withTheme(defaultConfig(), "frozen"), "custom_themed");
    expect(priceBreakdown(c).lines.find((l) => l.label === "Customized Themed Set")?.amount).toBe(THEMED_SET_PRICE);
  });

  it("shows its photo in the card and the sketch", () => {
    expect(inPublic(SETUP_ICON.custom_themed!)).toBe(true);
    expect(inPublic("/design/sketch/themed_set-room.webp")).toBe(true);
  });

  it("is never rendered: the route refuses before any paid call", async () => {
    const res = await POST(new NextRequest("http://localhost/api/generate-controlled-render", {
      method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.77" },
      body: JSON.stringify({ renderMode: "first_generate", sceneModel: { panels: [{ type: "themed_set" }] } }),
    }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/shown as its photo/);
  });
});
