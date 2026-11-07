// The whole party in one photograph, on the Venue step (2026-11-04): the backdrop and the kids' table stood together,
// indoors or outdoors as she marks it.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import sharp from "sharp";
import { defaultConfig, themeById, type BuilderConfig } from "@/lib/config";
import { defaultTableSetup } from "@/lib/studio/tableSetup";
import { backdropWords, partyAddPrompt, partyExperiences, partyMainExtras, partyPicked, partyPieces, partyPrompt, partyReferences, partyRenderKey, partySides, seatsWords } from "@/lib/studio/partyRender";
import { stitchSides, wideCanvas } from "@/lib/studio/partySheet";
import { itemWords } from "@/lib/studio/tableRender";
import { resetRenderGuard } from "@/lib/renderGuard";
import { readNdjson } from "@/lib/ndjson";

const subscribe = vi.fn();
vi.mock("@fal-ai/client", () => ({ fal: { config: vi.fn(), subscribe: (...a: unknown[]) => subscribe(...a) } }));
// A real (tiny) JPEG: the second photograph puts the first in a wider canvas.
const JPEG = Buffer.from("/9j/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAAQABgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAP/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCjgCoAD//Z", "base64"), PICTURE = `data:image/jpeg;base64,${JPEG.toString("base64")}`;
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
    if (tableRef && ["standard", "half_wave", "flower", "round", "cloud"].includes(c.table!.choices.table)) expect(tableRef.photo).toMatch(/-bare\.webp$/);
    expect(input.image_urls).toHaveLength(2 + refs.length);
    expect(input.image_size).toEqual({ width: 1344, height: 896 });
    expect(input).toMatchObject({ seed: 777 });
    expect(input.prompt).toContain("Image 1 is the balloon backdrop");
    expect(input.prompt).toContain(`Image 3 is the ${refs[0].key === "table" ? "table" : "chair"} she chose`);
    expect(input.prompt).toMatch(/indoors/);
  }, 30_000);

  // Everything in two photographs (2026-11-06, the owner: "saçmaladı render backdropta özellikle"): the backdrop and the
  // table first, room left around them; then that photo kept, the other pieces added.
  type Call = [string, { input: { prompt: string; image_urls: string[] } }];
  it("everything: the backdrop and the table first, kept exact; then that photo in a wider canvas, five parts added in two photographs, a side each", async () => {
    subscribe.mockImplementation(async () => ({ data: { images: [{ url: "https://fal.example/x.jpg" }] } }));
    const pic = async (bg: string) => `data:image/jpeg;base64,${(await sharp({ create: { width: 900, height: 900, channels: 3, background: bg } }).jpeg().toBuffer()).toString("base64")}`;
    const c = party();
    const extras = await Promise.all(["cake", "welcome", "giveaways", "helium", "pinata", "nope"].map(async (part) => ({ part, picture: await pic("#e0d0f0") })));
    const got = await lines(await post({ theme: "unicorn", setting: "outdoor", key: "abc123", table: c.table, backdrop: await pic("#f3c6cc"), tablePicture: await pic("#c6e0f3"), extras, experiences: ["popcorn"], mainKey: "main01" }));
    expect(got.at(-1)).toMatchObject({ done: true });
    expect(subscribe).toHaveBeenCalledTimes(3);
    const [[, first], [, second], [, third]] = subscribe.mock.calls as Call[];
    // The first: her backdrop, the top view, the cake (partyMainExtras: the two boards are picked too), the table's and
    // the chair's photos.
    expect(first.input.image_urls).toHaveLength(5);
    expect(first.input.prompt).toContain("the cake and sweets of image 3");
    expect(first.input.prompt).toContain("Image 4 is the table she chose");
    expect(first.input).toMatchObject({ image_size: { width: 1344, height: 896 } });
    // Then two at once (partySides): the welcome board and the helium on the left, the giveaways and the piñata on the
    // right (the giveaways' shelves never with the cake or the welcome board, the helium's foil never with the piñata) —
    // each from the first photo at full height at one end of a wider white canvas, all the white on its side, the cake
    // kept in it; the popcorn cart stays out.
    for (const [add, side] of [[second, "left"], [third, "right"]] as const) {
      expect(add.input).toMatchObject({ image_size: { width: 2016, height: 896 } });
      const canvas = sharp(Buffer.from(add.input.image_urls[0].split(",")[1], "base64"));
      expect(await canvas.metadata()).toMatchObject({ width: 2016, height: 896 });
      // The white at that side: the far column there is white, the far column of the other side is the photo's.
      const col = async (x: number) => { const b = await canvas.clone().extract({ left: x, top: 0, width: 1, height: 896 }).raw().toBuffer(); return b.reduce((s, v) => s + v, 0) / b.length; };
      expect(await col(side === "left" ? 0 : 2015)).toBeGreaterThan(250);
      expect(add.input.prompt).toContain(`its balloon backdrop, its kids' table and the cake — set at the ${side === "left" ? "right" : "left"} end of a wider white canvas, white on the ${side}`);
      expect(add.input.prompt).toContain(`fill the white on the ${side} by carrying`);
      expect(add.input.prompt).toContain("Keep the photograph exactly as image 1 shows it");
      expect(add.input.prompt).toContain("the only cake in the photograph: no second cake anywhere");
      expect(add.input.prompt).toContain("the cake just as it stands there, on its own");
      // 2026-11-07, the owner: "table setup neden yok?"
      expect(add.input.prompt).toContain("The kids' table and its chairs stay in the photograph");
      expect(add.input.prompt).not.toContain("popcorn");
    }
    expect(second.input.image_urls).toHaveLength(3);
    expect(second.input.prompt).toContain("the welcome board of image 2, standing alone on its own easel at the front, just left of the kids' table");
    expect(second.input.prompt).toContain("the helium balloon bouquets of image 3");
    expect(second.input.prompt).not.toContain("giveaway");
    expect(second.input.prompt).not.toContain("piñata");
    expect(second.input.prompt).not.toContain("the cake and sweets of image");
    expect(second.input.prompt).toContain("the right side of the photograph stays open garden");
    expect(second.input.prompt).toContain("From left to right across the photograph, with open ground between each and the next: the welcome board, the helium balloons, the backdrop with the kids' table.");
    expect(second.input.prompt).toContain("All 2 are added, each once and none left out");
    expect(third.input.image_urls).toHaveLength(3);
    expect(third.input.prompt).toContain("the giveaway boxes of image 2 at the front on the right, beyond the cake, further out, on exactly the board");
    expect(third.input.prompt).toContain("The cake of image 1 is part of the photograph to keep, exactly where image 1 has it, never replaced, moved or covered: every piece added on the right stands further out than it");
    expect(second.input.prompt).not.toContain("part of the photograph to keep");
    expect(third.input.prompt).toContain("the piñata of image 3 on the far right, the outermost thing on that side");
    expect(third.input.prompt).toContain("The piñata's pole stands on the grass or floor well beyond the giveaways' board");
    expect(third.input.prompt).toContain("nothing of it on the giveaways' board or its shelves");
    expect(third.input.prompt).toContain("the left side of the photograph stays open garden");
    // The first photo goes back to the builder under its own key, for next time.
    expect(got.find((l) => (l as { also?: unknown }).also)).toMatchObject({ also: { key: "main01" } });
  }, 30_000);

  // 2026-11-06, the owner: "hızlandırıp renderı" — the backdrop-and-table photo she already has is not made again.
  it("everything with the first photo already made: only the second photograph", async () => {
    subscribe.mockImplementation(async () => ({ data: { images: [{ url: "https://fal.example/x.jpg" }] } }));
    const pic = async (bg: string) => `data:image/jpeg;base64,${(await sharp({ create: { width: 900, height: 900, channels: 3, background: bg } }).jpeg().toBuffer()).toString("base64")}`;
    const c = party();
    const main = await sharp({ create: { width: 1344, height: 896, channels: 3, background: "#f3c6cc" } }).jpeg().toBuffer();
    const got = await lines(await post({ theme: "unicorn", setting: "outdoor", key: "abc123", table: c.table, backdrop: await pic("#f3c6cc"), tablePicture: await pic("#c6e0f3"),
      extras: [{ part: "cake", picture: await pic("#e0d0f0") }], mainKey: "main01", mainPhoto: `data:image/jpeg;base64,${main.toString("base64")}` }));
    expect(got.at(-1)).toMatchObject({ done: true });
    expect(subscribe).toHaveBeenCalledTimes(1);
    const [, { input }] = subscribe.mock.calls[0] as Call;
    expect(input.prompt).toContain("set in the middle of a wider white canvas");
    expect(input.image_urls).toHaveLength(2);
    expect(got.some((l) => (l as { also?: unknown }).also)).toBe(false);
  }, 30_000);

  it("only the backdrop and the table: one photograph", async () => {
    subscribe.mockImplementation(async () => ({ data: { images: [{ url: "https://fal.example/x.jpg" }] } }));
    const pic = async (bg: string) => `data:image/jpeg;base64,${(await sharp({ create: { width: 900, height: 900, channels: 3, background: bg } }).jpeg().toBuffer()).toString("base64")}`;
    const c = party();
    await lines(await post({ theme: "unicorn", setting: "outdoor", key: "abc123", table: c.table, backdrop: await pic("#f3c6cc"), tablePicture: await pic("#c6e0f3") }));
    expect(subscribe).toHaveBeenCalledTimes(1);
  }, 30_000);

  it("the experiences fill what the parts leave: a cart by its photo, a station by words, no people", async () => {
    subscribe.mockImplementation(async () => ({ data: { images: [{ url: "https://fal.example/x.jpg" }] } }));
    const pic = async (bg: string) => `data:image/jpeg;base64,${(await sharp({ create: { width: 900, height: 600, channels: 3, background: bg } }).jpeg().toBuffer()).toString("base64")}`;
    const c = party();
    const extras = [{ part: "adults", picture: await pic("#e0d0f0") }];
    await lines(await post({ theme: "unicorn", setting: "outdoor", key: "abc123", table: c.table, backdrop: await pic("#f3c6cc"), tablePicture: await pic("#c6e0f3"), extras,
      experiences: ["magician", "popcorn", "face_painting", "bouncy_castle", "nope"] }));
    // Four pieces: two photographs — the grown-ups' table and the popcorn cart on the left, the bouncy castle and the
    // face painting (by words) on the right.
    expect(subscribe).toHaveBeenCalledTimes(3);
    const [, { input: left }] = subscribe.mock.calls[1] as Call;
    const [, { input: right }] = subscribe.mock.calls[2] as Call;
    expect(left.image_urls).toHaveLength(3);
    expect(left.prompt).toContain("the grown-ups' table of image 2");
    expect(left.prompt).toContain("on the far left and a little further back, the white popcorn cart with its little boxes of popcorn exactly as image 3 shows it");
    expect(left.prompt).not.toContain("face-painting");
    expect(right.image_urls).toHaveLength(2);
    expect(right.prompt).toContain("on the far right and further back, the pastel bouncy castle with its turrets, on the lawn or floor exactly as image 2 shows it");
    expect(right.prompt).toContain("further out on the right, a little face-painting table");
    expect(right.prompt).toContain("All 2 are added");
    expect(right.prompt).not.toMatch(/magic/i);
  }, 30_000);

  it("four or five pieces go in two photographs, a side each; three in one", () => {
    expect(partySides(["cake", "welcome", "giveaways"])).toBeNull();
    // The giveaways' shelves never with the cake or the welcome board; all three picked, the cake goes into the first photo.
    expect(partyMainExtras(["cake", "welcome", "giveaways", "helium", "pinata"])).toEqual(["cake"]);
    expect(partyMainExtras(["cake", "welcome", "helium", "pinata"])).toEqual([]);
    expect(partySides(["welcome", "helium", "pinata", "giveaways"])).toEqual({ left: ["welcome", "helium"], right: ["pinata", "giveaways"] });
    // The cake in the middle takes one of the right's places; the helium's foil and the piñata never together.
    expect(partySides(["welcome", "giveaways", "helium", "pinata"], ["cake"])).toEqual({ left: ["welcome", "helium"], right: ["giveaways", "pinata"] });
    expect(partySides(["giveaways", "pinata", "bouncy_castle"], ["cake"])).toEqual({ left: ["bouncy_castle"], right: ["giveaways", "pinata"] });
    expect(partySides(["helium", "giveaways", "pinata", "bouncy_castle"], ["cake"])).toEqual({ left: ["helium", "bouncy_castle"], right: ["giveaways", "pinata"] });
    expect(partySides(["welcome", "giveaways"], ["cake"])).toBeNull();
    expect(partySides(["cake", "welcome", "giveaways", "helium", "pinata"])).toEqual({ left: ["cake", "welcome", "helium"], right: ["giveaways", "pinata"] });
    expect(partySides(["cake", "giveaways", "helium", "pinata"])).toEqual({ left: ["cake", "helium"], right: ["giveaways", "pinata"] });
    expect(partySides(["adults", "cake", "welcome", "giveaways", "helium"])).toEqual({ left: ["adults", "cake", "welcome"], right: ["giveaways", "helium"] });
    // Too many on one side: the last of them cross over.
    expect(partySides(["adults", "welcome", "giveaways", "helium", "popcorn"])).toEqual({ left: ["adults", "welcome", "helium"], right: ["giveaways", "popcorn"] });
    expect(partySides(["cake", "pinata", "bouncy_castle", "face_painting"])).toEqual({ left: ["face_painting"], right: ["cake", "pinata", "bouncy_castle"] });
    // Sent to the other side, a piece's words follow it.
    expect(partyAddPrompt("outdoor", { extras: ["cake"], experiences: ["popcorn"] }, "right")).toContain("on the far right and a little further back, the white popcorn cart");
  });

  it("puts the first photo at one end of the canvas, all the white on the side the pieces go", async () => {
    const photo = await sharp({ create: { width: 1344, height: 896, channels: 3, background: "#808080" } }).jpeg().toBuffer();
    const col = async (b: Buffer, x: number) => { const c = await sharp(b).extract({ left: x, top: 0, width: 1, height: 896 }).raw().toBuffer(); return c.reduce((s, v) => s + v, 0) / c.length; };
    const l = await wideCanvas(photo, "left"), r = await wideCanvas(photo, "right"), m = await wideCanvas(photo);
    expect([await col(l, 10), await col(l, 2000)].map(Math.round)).toEqual([255, 128]);
    expect([await col(r, 10), await col(r, 2000)].map(Math.round)).toEqual([128, 255]);
    expect([await col(m, 10), await col(m, 1008), await col(m, 2000)].map(Math.round)).toEqual([255, 128, 255]);
  });

  it("joins two one-sided photographs: their middles 672 apart by the canvases, lined up, 2688 wide", async () => {
    const one = (bg: string, blockLeft: number, greyLeft: number) => sharp({ create: { width: 2016, height: 896, channels: 3, background: "#ffffff" } })
      .composite([{ input: { create: { width: 200, height: 896, channels: 3, background: "#808080" } }, left: greyLeft, top: 0 }, { input: { create: { width: 300, height: 896, channels: 3, background: bg } }, left: blockLeft, top: 0 }]).jpeg().toBuffer();
    // The first: white on the left, its middle's mark at 1244..1444; the second: white on the right, the mark at 572..772.
    const joined = sharp(await stitchSides(await one("#ff0000", 0, 1244), await one("#0000ff", 1716, 572), 672));
    expect(await joined.metadata()).toMatchObject({ width: 2688, height: 896 });
    const px = async (x: number) => Array.from(await joined.clone().extract({ left: x, top: 448, width: 1, height: 1 }).raw().toBuffer());
    expect(await px(100)).toEqual([255, 0, 0].map((v) => expect.closeTo(v, -1)));
    expect(await px(1344)).toEqual([128, 128, 128].map((v) => expect.closeTo(v, -1)));
    expect(await px(2600)).toEqual([0, 0, 255].map((v) => expect.closeTo(v, -1)));
  });

  it("joins two photographs down the middle: the left of one, the right of the other", async () => {
    const half = (bg: string, side: "left" | "right") => sharp({ create: { width: 2016, height: 896, channels: 3, background: "#ffffff" } })
      .composite([{ input: { create: { width: 500, height: 896, channels: 3, background: bg } }, left: side === "left" ? 0 : 1516, top: 0 }]).jpeg().toBuffer();
    const joined = sharp(await stitchSides(await half("#ff0000", "left"), await half("#0000ff", "right")));
    expect(await joined.metadata()).toMatchObject({ width: 2016, height: 896 });
    const px = async (x: number) => Array.from(await joined.clone().extract({ left: x, top: 448, width: 1, height: 1 }).raw().toBuffer());
    expect(await px(100)).toEqual([255, 0, 0].map((v) => expect.closeTo(v, -1)));
    expect(await px(1900)).toEqual([0, 0, 255].map((v) => expect.closeTo(v, -1)));
    expect(await px(1008)).toEqual([255, 255, 255].map((v) => expect.closeTo(v, -1)));
    // The second slid 40 px to the right: lined up on the grey of the middle, narrower by that much, its far right kept.
    const mark = (bg: string, left: number) => sharp({ create: { width: 2016, height: 896, channels: 3, background: "#ffffff" } })
      .composite([{ input: { create: { width: 200, height: 896, channels: 3, background: "#808080" } }, left: 908, top: 0 }, { input: { create: { width: 300, height: 896, channels: 3, background: bg } }, left, top: 0 }]).jpeg().toBuffer();
    const slid = sharp(await stitchSides(await mark("#ff0000", 0), await sharp(await mark("#0000ff", 1716)).extract({ left: 0, top: 0, width: 1976, height: 896 }).extend({ left: 40, background: "#ffffff" }).toBuffer()));
    expect(await slid.metadata()).toMatchObject({ width: 1976, height: 896 });
    expect(Array.from(await slid.clone().extract({ left: 1960, top: 448, width: 1, height: 1 }).raw().toBuffer())).toEqual([0, 0, 255].map((v) => expect.closeTo(v, -1)));
    expect(Array.from(await slid.clone().extract({ left: 1000, top: 448, width: 1, height: 1 }).raw().toBuffer())).toEqual([128, 128, 128].map((v) => expect.closeTo(v, -1)));
  });

  it("picks the pieces she chose, else the first ones, five at most", () => {
    const all = ["cake", "welcome", "giveaways", "pinata", "popcorn", "helium"];
    expect(partyPicked(all)).toEqual(["cake", "welcome", "giveaways", "pinata", "popcorn"]);
    expect(partyPicked(all, ["popcorn", "pinata"])).toEqual(["popcorn", "pinata"]);
    expect(partyPicked(all, ["adults", "helium", "pinata", "cake", "welcome", "giveaways"])).toEqual(["helium", "pinata", "cake", "welcome", "giveaways"]);
    expect(partyPicked(all, [])).toEqual([]);
  });

  it("tells the board's words and their colour", () => {
    expect(backdropWords({ backdropColor: "#FFFFFF", plinths: 0, backdropItems: [{ type: "arch", widthCm: 100, heightCm: 200, color: "#F8BBD0", text: { enabled: true, value: "Happy  Birthday", color: "white" } } as never] }))
      .toContain('with the words "Happy Birthday" on it in exactly the lettering and colour image 1 shows');
  });

  it("the experiences change the key; a person can't be in the picture", () => {
    const c = party();
    expect(partyRenderKey(c, "indoor", [], ["popcorn"])).not.toBe(partyRenderKey(c, "indoor"));
    expect(partyExperiences(["magician", "photographer", "popcorn", "dj", "x"])).toEqual({ photos: ["popcorn"], stations: ["dj"] });
  });

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

describe("the party's pieces stand apart", () => {
  it("keeps the welcome board, the giveaways, the cake's cart and the popcorn cart apart; the grown-ups' table in view", () => {
    const c = defaultConfig();
    const p = partyPrompt(c, "outdoor", { backdrop: true, table: false, extras: ["adults", "cake", "welcome", "giveaways", "pinata"], experiences: ["popcorn"] });
    expect(p).toContain("never two pieces made into one");
    expect(p).toContain("The welcome board and the giveaways' board or table are two separate things");
    expect(p).toContain("the popcorn cart is a cart of its own, standing apart from it");
    expect(p).toContain("The piñata hangs alone from its own pole.");
    expect(p).toContain("The photograph shows all 7 of them, each once and none left out: the balloon backdrop, the grown-ups' table, the cake, the welcome board, the giveaway boxes, the piñata, popcorn cart.");
    expect(p).toContain("clearly in the picture: the whole of it, or at least its near half");
    // One piece alone: nothing to keep apart.
    expect(partyPrompt(c, "outdoor", { backdrop: true, table: false, extras: ["cake"] })).not.toContain("never two pieces");
  });
});
