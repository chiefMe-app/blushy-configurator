// The whole party in one photograph, on the Venue step (2026-11-04): the backdrop and the kids' table stood together,
// indoors or outdoors as she marks it.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import sharp from "sharp";
import { defaultConfig, themeById, type BuilderConfig } from "@/lib/config";
import { defaultTableSetup } from "@/lib/studio/tableSetup";
import { backdropWords, partyPieces, partyPrompt, partyReferences, partyRenderKey, seatsWords } from "@/lib/studio/partyRender";
import { itemWords } from "@/lib/studio/tableRender";
import { resetRenderGuard } from "@/lib/renderGuard";
import { readNdjson } from "@/lib/ndjson";

const subscribe = vi.fn();
vi.mock("@fal-ai/client", () => ({ fal: { config: vi.fn(), subscribe: (...a: unknown[]) => subscribe(...a) } }));
const JPEG = Buffer.from("jpeg-bytes"), PICTURE = `data:image/jpeg;base64,${JPEG.toString("base64")}`;
vi.mock("@/lib/renderStore", () => ({ renderJpeg: async () => JPEG, storeRenderJpeg: async () => null }));
vi.mock("@/lib/photoGrade", () => ({ gradePhoto: async (b: Buffer) => b }));
import { POST } from "@/app/api/party-render/route";

const theme = themeById("unicorn")!;
const party = (over: Partial<BuilderConfig> = {}): BuilderConfig => {
  const c = defaultConfig();
  return { ...c, theme: "unicorn", decor: { ...c.decor, backdropChoice: "yes", backdropItems: c.decor.backdropItems.length ? c.decor.backdropItems : [{ id: "single_round" } as never] },
    table: { ...defaultTableSetup(theme), kids: 12 }, ...over };
};

describe("the party's picture", () => {
  it("stands what she designed: the backdrop unless skipped, the kids' table if she made one", () => {
    expect(partyPieces(party())).toEqual({ backdrop: true, table: true });
    const c = party();
    expect(partyPieces({ ...c, decor: { ...c.decor, backdropChoice: "skip" }, table: undefined })).toEqual({ backdrop: false, table: false });
  });

  it("changes its key with the setting, the backdrop or the table, and only with them", () => {
    const c = party();
    const k = partyRenderKey(c, "outdoor");
    expect(partyRenderKey(c, "indoor")).not.toBe(k);
    expect(partyRenderKey({ ...c, table: { ...c.table!, kids: 14 } }, "outdoor")).not.toBe(k);
    expect(partyRenderKey({ ...c, decor: { ...c.decor, balloonColors: ["#FFFFFF"] } }, "outdoor")).not.toBe(k);
    expect(partyRenderKey({ ...c, venue: { ...c.venue, area: "Jumeirah" } } as BuilderConfig, "outdoor")).toBe(k);
    expect(k).toMatch(/^[0-9a-z]{1,16}$/);
  });

  it("is told both pictures and her setting: the backdrop kept as designed, the table laid for her children, no characters", () => {
    const c = party();
    const out = partyPrompt(c, "outdoor", { backdrop: true, table: true });
    expect(out).toMatch(/Image 1 is the balloon backdrop/);
    expect(out).toMatch(/Image 2 shows the kids' party table/);
    expect(out).toMatch(/with 12 small child-sized chairs/);
    // Never the top view's six places as the count.
    expect(out).toMatch(/only a sample cut of a few places, never the count: the real table has 12 places/);
    // Photographed straight on, the table centred, its long side to the camera.
    expect(out).toMatch(/straight on from the front/);
    expect(out).toMatch(/its long side facing the camera/);
    expect(out).toMatch(/garden/);
    expect(out).toMatch(/never yellow/);
    expect(out).toMatch(/no cartoon or licensed characters/);
    const inside = partyPrompt(c, "indoor", { backdrop: true, table: true });
    expect(inside).toMatch(/indoors/);
    expect(inside).not.toMatch(/garden/);
    // Her own pieces (2026-11-04, the owner: "Birebir benim seçimlerim olmalı masa sandalye backdrop vs"): the table and
    // the chair in words, each with its own option photo after the two pictures.
    const own = partyPrompt(c, "outdoor", { backdrop: true, table: true, refs: ["table", "chairs"] });
    expect(own).toContain(itemWords(c.table!, "unicorn", "table"));
    expect(own).toContain(itemWords(c.table!, "unicorn", "chairs"));
    expect(own).toMatch(/Image 3 is the table she chose — copy only the table itself.*; image 4 is the chair she chose — every child's chair is this one/);
    // 12 children: two tables of 10 seats, 6 and 6 — one at each end, two along each side.
    expect(own).toMatch(/2 identical low kids' tables.*with 12 small child-sized chairs.* — exactly 2 along each long side of each table and one at each end, 2 \+ 2 \+ 1 \+ 1 = 6 chairs and 6 places set at each table/);
    expect(own).toMatch(/exactly the one in image 4/);
    expect(own).toMatch(/never other chairs/);
    // Only the table: it is image 1.
    const table = partyPrompt(c, "indoor", { backdrop: false, table: true });
    expect(table).toMatch(/Image 1 shows the kids' party table/);
    expect(table).not.toMatch(/balloon backdrop/);
  });
});

describe("the party's chairs", () => {
  // 2026-11-05, the owner: "4 er tane bir tarafa bide yanlara 2 olabilir".
  const seats = (kids: number, table = "standard") => seatsWords({ kids, choices: { ...defaultTableSetup(theme).choices, table } as never });
  it("puts one at each end of a long table and shares the rest along its sides, counted out", () => {
    expect(seats(10)).toMatch(/^ — exactly 4 along each long side and one at each end, 4 \+ 4 \+ 1 \+ 1 = 10 chairs and 10 places set, the table long and narrow \(about 1\.8 m long/);
    expect(seats(5)).toMatch(/exactly 2 along each long side and one at one end, 2 \+ 2 \+ 1 = 5/);
    expect(seats(4)).toMatch(/exactly 2 along each long side, 2 \+ 2 = 4/);
    expect(seats(7)).toMatch(/exactly 3 along the far long side and 2 along the near one and one at each end, 3 \+ 2 \+ 1 \+ 1 = 7/);
    expect(seats(10, "round")).toBe(" all round it");
  });
});

describe("the party's backdrop in words", () => {
  it("names each board with its size and colour, and the plinths", () => {
    const w = backdropWords({ backdropColor: "#FFFFFF", plinths: 2, backdropItems: [
      { type: "arch", widthCm: 100, heightCm: 200, color: "" } as never, { type: "round", widthCm: 150, heightCm: 150, color: "#F8BBD0" } as never] });
    expect(w).toMatch(/arch board \(100 × 200 cm\)/);
    expect(w).toMatch(/round board \(150 × 150 cm\)/);
    expect(w).toMatch(/2 white cylinder plinths in front of the boards/);
  });
});

describe("the party's render", () => {
  const post = (body: unknown) => POST(new NextRequest("http://localhost/api/party-render", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));
  const lines = async (res: Response) => { const out: Record<string, unknown>[] = []; await readNdjson(res.body!, (l) => out.push(l as Record<string, unknown>)); return out; };
  beforeEach(() => {
    vi.stubEnv("FAL_KEY", "test-key");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_URL", "");
    subscribe.mockReset();
    resetRenderGuard();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("sends both pictures to FLUX.2 [pro] edit, landscape, with a steady seed and her setting's words", async () => {
    subscribe.mockImplementation(async () => ({ data: { images: [{ url: "https://fal.example/x.jpg" }] } }));
    const pic = async (bg: string) => `data:image/jpeg;base64,${(await sharp({ create: { width: 1600, height: 1200, channels: 3, background: bg } }).jpeg().toBuffer()).toString("base64")}`;
    const c = party();
    const got = await lines(await post({ theme: "unicorn", setting: "indoor", key: "abc123", table: c.table, backdrop: await pic("#f3c6cc"), tablePicture: await pic("#c6e0f3") }));
    expect(got[0]).toEqual({ url: PICTURE });
    expect(got.at(-1)).toMatchObject({ done: true });
    const [model, { input }] = subscribe.mock.calls[0] as [string, { input: { prompt: string; image_urls: string[]; image_size: { width: number; height: number }; seed?: number } }];
    expect(model).toBe("fal-ai/flux-2-pro/edit");
    // The backdrop, the table's top view, then her table's and chair's own photos.
    const refs = partyReferences(c.table!, "unicorn");
    expect(refs.length).toBeGreaterThan(0);
    // The table's photo without the shop's chairs, where there is one (2026-11-05).
    const tableRef = refs.find((r) => r.key === "table");
    if (tableRef && ["standard", "half_wave", "flower"].includes(c.table!.choices.table)) expect(tableRef.photo).toMatch(/-bare\.webp$/);
    expect(input.image_urls).toHaveLength(2 + refs.length);
    expect(input.image_size).toEqual({ width: 1344, height: 896 });
    expect(input).toMatchObject({ seed: 777 });
    expect(input.prompt).toContain("Image 1 is the balloon backdrop");
    expect(input.prompt).toContain(`Image 3 is the ${refs[0].key === "table" ? "table" : "chair"} she chose`);
    expect(input.prompt).toMatch(/indoors/);
  }, 30_000);

  it("everything: the other parts' photos after the table's top view, at most eight pictures, the chair kept first", async () => {
    subscribe.mockImplementation(async () => ({ data: { images: [{ url: "https://fal.example/x.jpg" }] } }));
    const pic = async (bg: string) => `data:image/jpeg;base64,${(await sharp({ create: { width: 900, height: 900, channels: 3, background: bg } }).jpeg().toBuffer()).toString("base64")}`;
    const c = party();
    const extras = await Promise.all(["cake", "welcome", "giveaways", "helium", "pinata", "nope"].map(async (part) => ({ part, picture: await pic("#e0d0f0") })));
    await lines(await post({ theme: "unicorn", setting: "outdoor", key: "abc123", table: c.table, backdrop: await pic("#f3c6cc"), tablePicture: await pic("#c6e0f3"), extras }));
    const [, { input }] = subscribe.mock.calls[0] as [string, { input: { prompt: string; image_urls: string[] } }];
    expect(input.image_urls).toHaveLength(8);
    expect(input.prompt).toContain("the cake and sweets of image 3");
    expect(input.prompt).toContain("the piñata of image 7");
    expect(input.prompt).toContain("Image 8 is the chair she chose");
    expect(input.prompt).not.toMatch(/is the table she chose/);
  }, 30_000);

  it("keys the picture by what goes in it", () => {
    const c = party();
    expect(partyRenderKey(c, "indoor")).not.toBe(partyRenderKey(c, "indoor", [{ part: "cake", key: "k1" }]));
    expect(partyRenderKey(c, "indoor", [{ part: "cake", key: "k1" }])).not.toBe(partyRenderKey(c, "indoor", [{ part: "cake", key: "k2" }]));
  });

  it("refuses no setting, or nothing to stand there, without calling fal", async () => {
    const c = party();
    expect((await post({ theme: "unicorn", backdrop: PICTURE })).status).toBe(400);
    expect((await post({ theme: "unicorn", setting: "space", backdrop: PICTURE })).status).toBe(400);
    expect((await post({ theme: "unicorn", setting: "outdoor" })).status).toBe(400);
    // A table without its picture is nothing to show.
    expect((await post({ theme: "unicorn", setting: "outdoor", table: c.table })).status).toBe(400);
    expect(subscribe).not.toHaveBeenCalled();
  });
});
