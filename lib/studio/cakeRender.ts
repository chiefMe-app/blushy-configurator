// The words for the cake's render (app/api/cake-render/route.ts, 2026-11-03): keep the scene of the live preview
// exactly — the cake on its white stand, close up — and make it one real photograph. Since 2026-11-03 also of one
// part of it (the owner: "cake'e basacağız sadece cake, sonra cookies'e basacağız yakından cookies … bide uzaktan
// cartın üstündeyken genel"): the whole table or cart, the cake close up, or a sweet close up.
import { CAKE_FIGURES, CAKE_SPRINKLES, TOPPER_CARDS, cakeWords, holderOf, rainbowOf, tierColours, topperColour, topperShows, type Cake, type CakeView, type FigureKind } from "./cake";
import { CAKE_SWEETS, colourWords, linerWords } from "./cakeSweets";
import { fontWords, tableFont } from "./tableFonts";

const TIER_NAMES: Record<number, string[]> = { 1: ["the cake"], 2: ["the bottom tier", "the top tier"], 3: ["the bottom tier", "the middle tier", "the top tier"] };
// Every piece made a real thing (2026-11-04, the owner of a Seedream render: "bu sefer de gerçek gibi durmadı" — it
// kept the preview's flat tiers and pasted-looking cupcakes).
/** Every piece there made a real thing, named only when it is there (so none is asked for that is not). */
function realWords(k: Cake): string {
  // Smooth stays smooth (a "hand-made" test render combed ridges into a smooth cake).
  const parts = [k.style === "smooth"
    ? "real smooth buttercream, its surface smooth and even all round with only the faintest soft texture — no ridges, comb lines or spatula marks — and the light falling softly round each tier's curve"
    : "real buttercream with its soft texture and the light falling round each tier's curve"];
  // Hand-made, not modelled (2026-11-04, the owner of a rendered sugar rainbow: "daha gerçekçi nasıl olabilir"): too
  // even, too clean, drawn onto the buttercream.
  if (k.figures.some((f) => CAKE_FIGURES.find((x) => x.id === f.id)?.kind === "sugar")) parts.push("real handmade sugar-paste figures, hand-rolled and hand-cut — soft rounded edges a little uneven, fine seams where one piece or band meets the next, a faint matte sugar texture, each colour lighter where the light catches its curve and a little deeper underneath, a few millimetres thick so each stands off the buttercream with a thin soft shadow along its lower edge, any clouds plump and soft");
  if (k.sweets?.some((x) => x.id === "cupcakes")) parts.push("real freshly baked cupcakes with piped frosting in real paper liners");
  if ((k.sweets ?? []).some((x) => x.id !== "cupcakes")) parts.push("the other sweets real and freshly made");
  return `Rebuild every part as a real object photographed by a real camera — nothing flat, drawn, pasted on or cut out of a picture: ${parts.join(", ")}, real contact shadows wherever things touch, and the gentle grain and depth of a real photograph.`;
}

// 2026-11-03 (the owner: "kötü bir render ışığı var, çok sarı, kaliteli durmuyor hiç … örnekteki ışık kalitesi iyi"):
// a bakery's product photograph — bright, clean, white, sharp.
// 2026-11-04 (the owner: "render'da ışık aşırı var, tasarım anlaşılmıyor"): still bright, but a balanced exposure that
// keeps every colour and every piece of the decoration as clear as the preview (a "soft window light" test went grey
// and dim, the white tier cream).
// 2026-11-04 (the owner, of a styled unicorn-cake photo: "şu örnekteki gibi içim açılsın … sadece arka plan değil, ışık
// ve renkler hoşuma gidiyor"): a party photo shoot's light — airy, cool-neutral, candy-bright pastels, soft shadows
// giving the cake its depth, the background softly blurred; the stand photo a pastel party wall behind (stand.webp).
// Later the same day (her render: "gene karanlık ve kasvet çıktı"): "window light to one side" gave a dark side and a
// dim wall — now high-key, even and from the front; and no hard sunlit shadow (one fell across the table).
// Then (her render: "rainbow iyi ama aşırı aydınlık ortam"): high-key went too far — wall, cloth and cake one flat
// white — so a well-exposed photo, the wall a soft pastel tone a step below the white cake so the cake stands out.
const LIGHT = "Light and colour it like a bright, cheerful, well-exposed kids' birthday party photo: soft, even daylight from the front, never overexposed — the wall behind a soft light pastel tone a step darker than the white of the cake so the cake stands out against it, the cloth and the stand with their gentle soft shading, every white keeping its soft modelling and detail; no dark corners and no dark side on the cake; a fresh, clean white balance — whites pure bright white, never yellow, cream, ivory, beige or grey; candy-bright pastel colours, clear, fresh and saturated, every colour at least as rich and as light as image 1 shows it, never darker, never washed out, greyed or muted; only very soft, light shadows; the cake crisp and sharp against a softly blurred background, a shallow depth of field. No direct sunlight and no hard shadows anywhere — on the table too, every shadow soft and faint as under a big soft light; no glare, no haze, no blown-out highlights, no sunbeams, no dim, moody, dramatic or low-key light.";

/** The words for the photograph: keep the scene, make it real. */
export function cakePrompt(k: Cake, view: CakeView = "whole"): string {
  // Each piece once, its copies counted: "gold star ×2".
  const named = (on: "top" | "side" | "any", kind: FigureKind) => CAKE_FIGURES.flatMap((f) => {
    const n = f.kind === kind ? k.figures.filter((i) => (on === "any" || i.on === on) && i.id === f.id).length : 0;
    return n ? [`${f.name.toLowerCase()}${n > 1 ? ` ×${n}` : ""}`] : [];
  });
  const figures = named("top", "sugar"), sides = named("side", "sugar");
  const cutTop = named("top", "cutout"), cutSide = named("side", "cutout");
  const decos = named("any", "deco");
  const t = k.topper;
  const tc = topperColour(t.colour);
  // What it stands on (2026-11-03, the owner: "3 katlı olunca alttaki cake holder'ın ayaksızı olsun").
  const onBoard = holderOf(k).board;
  const holder = onBoard ? "a wide round white cake board" : "a white cake stand";
  const words = [t.name.trim(), t.age].filter(Boolean).map((w) => `"${w}"`).join(" and ");
  const lettering = fontWords(tableFont(t.font)).replace(", all capitals", "");
  const card = t.card ? TOPPER_CARDS.find((c) => c.id === t.card)!.words.replace("white", t.cardColour ? colourWords(t.cardColour) : "white") : "";
  // Its border (2026-11-03): the letters' colour, hers, or none.
  const border = t.cardBorder === "none" ? " with no border" : ` with a thin ${t.cardBorder ? colourWords(t.cardBorder) : tc.name.toLowerCase()} border`;
  // On the front or the board the name is real cake lettering, as in the owner's examples (2026-11-03: "renderda
  // yapay çıkmasın, pastanın üstünde bu örneklerdeki gibi olsun"): letters cut from sugar paste, with a thickness and
  // a shadow — painted with a metal's shine, or in her colour. On top, on sticks, acrylic.
  const sugar = tc.shiny ? `${tc.name.toLowerCase()}-painted sugar-paste letters with a soft metallic shine` : `${tc.words} sugar-paste letters`;
  const real = "real hand-cut sugar-paste (fondant) letters a few millimetres thick with soft rounded edges, each with its own small soft shadow — never flat print, never pasted on";
  const topper = !topperShows(k) ? ""
    : t.at === "board"
      ? `On the ${onBoard ? "cake board" : "cake stand's plate"} at the foot of the cake, in front of it, keep the name exactly where image 1 has it: ${sugar} reading ${words}, ${lettering}, standing upright and leaning lightly against the bottom tier — ${real}; the same letters in the same colour as image 1.`
      : t.at === "front"
        ? `On the front of the cake keep the name exactly where image 1 has it: ${card ? `${card}${border} pressed flat onto the buttercream, with ${sugar} reading ${words}, ${lettering}, on it` : `${sugar} reading ${words}, ${lettering}, pressed onto the buttercream`} — ${real}; the same letters in the same colour as image 1.`
        : `Keep the cake topper exactly: ${card ? `${card}${border} on two thin white sticks pushed into the top, with ${tc.words} printed letters reading ${words}, ${lettering}, on it` : `${tc.words} acrylic letters reading ${words}, ${lettering}, on two thin sticks pushed into the top`}, the same letters in the same colour as image 1.`;
  const colours = tierColours(k);
  const plainTiers = colours.flatMap((c, i) => (rainbowOf(c) ? [] : [`${TIER_NAMES[k.tiers][i]} and its border in ${c.toUpperCase() === "#FFFFFF" ? "pure bright white (never ivory, cream or yellow)" : colourWords(c)} buttercream`]));
  const rainbow = colours.flatMap((c, i) => (rainbowOf(c) ? [`${TIER_NAMES[k.tiers][i]} in ${rainbowOf(c)!.words}`] : []));
  const sprinkles = CAKE_SPRINKLES.find((s) => s.id === k.sprinkles);
  // Each sweet as it shows.
  const said = (id: string) => CAKE_FIGURES.find((f) => f.id === id);
  const sweetWords = (id: string) => {
    const kind = CAKE_SWEETS.find((x) => x.id === id), sw = k.sweets?.find((x) => x.id === id);
    if (!kind || !sw) return "";
    const top = sw.topper ? `, each topped with a little ${said(sw.topper)!.kind === "cutout" ? "printed card" : "sugar-paste"} ${said(sw.topper)!.name.toLowerCase()}` : "";
    // A cookie's print as big as its iced face, inside its edge (2026-11-03, the owner: "o yuvarlak büyüklüğünde olsun, taşmasın").
    const print = sw.print ? `, each printed with ${sw.print === "age" ? `a big number "${t.age || "1"}"` : `a big ${said(sw.print)!.name.toLowerCase()}`} filling its iced face nearly to the edge but never over it, on plain smooth icing${sw.sprinkles ? "" : " with nothing else on it — no sprinkles, no stars, no dots, no flowers"}` : "";
    // The cupcakes' liners in hers (2026-11-03, the owner: "cupcake kağıdının rengini de seçebilsin").
    // Bare when she chose no sprinkles (2026-11-04, the owner: "cupcake'de sprinkle seçmedim"); a cookie's print says so
    // itself, and a macaron has none to leave off.
    return `${kind.words(colourWords(sw.colour)).replace("gold foil liners", linerWords(sw.liner))}${top}${print}${sw.sprinkles ? ", with rainbow sprinkles" : sw.print || sw.id === "macarons" ? "" : ", with no sprinkles on them at all"}`;
  };
  const sweets = CAKE_SWEETS.map((s) => sweetWords(s.id)).filter(Boolean);
  // On the sweet cart: the cake and the sweets on its counter, under its flat wooden roof (2026-11-03, the owner:
  // "stripe olmasın artık"), and her balloons up its side if she wants them.
  const roof = `a flat ${colourWords(k.cart?.roof ?? "#FFFFFF")} wooden roof with a scalloped trim`;
  const cart = k.cart ? `a white wooden sweet cart with ${roof}` : "";
  const balloons = k.cart?.balloons?.length
    ? `a full organic garland of real matte latex balloons in ${Array.from(new Set(k.cart.balloons.map(colourWords))).join(", ")}, of mixed sizes, rising from the floor up the cart's left side and over the left of its roof`
    : "";
  // On the plinths (2026-11-03): the cake on the tall middle one, each sweet on its own.
  const plinths = !k.cart && !!k.plinths;
  const where = cart ? `on the counter of ${cart}` : plinths ? "on top of a tall round white plinth, the middle one of a party dessert display of white round plinths before a plain wall" : "on a table";
  const characters = cutTop.length + cutSide.length > 0 || (k.sweets ?? []).some((x) => [x.topper, x.print].some((p) => p && p !== "age" && said(p)?.kind === "cutout"));

  // A sweet close up: only it, made real; the rest as it is, out of focus.
  const these = view !== "whole" && view !== "cake" ? sweetWords(view) : "";
  const others = CAKE_SWEETS.filter((x) => x.id !== view && k.sweets?.some((y) => y.id === x.id)).map((x) => x.name.toLowerCase());
  if (these) return [
    `Image 1 is a close-up preview of ${these}, ${cart ? `on the counter of ${cart}` : plinths ? "on a round white plinth" : "on a table"} at a birthday party, beside the birthday cake.`,
    "Make it one real, natural close-up photograph of exactly these, from the same camera position and with the same framing, every piece the same size and in the same place: real and freshly made, the same colours, toppers, prints and sprinkles as image 1 shows them — the icing, the liners and the stand exactly the colours of image 1 — appetising.",
    // The other sweets and the cloth stay (2026-11-04: a cupcakes test render dropped the cookies in front and changed the cloth).
    `Keep everything else as image 1 has it — the ${cart ? "cart" : plinths ? "plinths" : "table and its cloth, the same colour"}, ${others.length ? `the ${others.join(" and ")} beside them, every one of them kept, ` : ""}the cake, the wall and whatever else shows at the edges of the picture — in the same places and colours, softly out of focus.`,
    realWords(k),
    LIGHT,
    `Nothing added and nothing taken away: no candles, ${characters ? "no real people or hands, no characters beyond the printed pictures" : "no people, no hands, no characters"}, no fresh flowers, ${k.sweets?.find((x) => x.id === view)?.sprinkles ? "" : "no sprinkles, "}no extra words or letters.`,
  ].join(" ");
  const close = view === "cake";
  const wide = !close && (!!cart || plinths || sweets.length > 0);
  return [
    `Image 1 is a ${close ? "close-up " : ""}preview of a birthday cake standing on ${holder} ${where}: ${cakeWords(k)}.`,
    wide
      ? `Make it one real, natural photograph of exactly this scene, from the same camera position and with the same framing — the whole ${cart ? "sweet cart" : plinths ? "display" : "table"} in view, never zoomed in or cropped — every part the same size and in the same place.`
      : "Make it one real, natural close-up photograph of exactly this cake, from the same camera position, with the same framing and every part the same size and in the same place.",
    `Keep the cake exactly: ${k.tiers > 1 ? `exactly ${k.tiers === 2 ? "two" : "three"} tiers stacked, never more and never fewer, each in its own colour as image 1 shows it` : "one single tier, the same colour as image 1"}, the same decoration, each figure once and only where image 1 has it and in its own colours as image 1 shows them (a pink heart stays pink, never turned gold or glitter), made of real smooth buttercream with its fine texture.`,
    // Each tier's colour named (2026-11-04: a test render greyed a pastel mint tier to sage and its pink to mauve).
    plainTiers.length ? `${plainTiers.join(", ").replace(/^./, (l) => l.toUpperCase())} — bright, clean and fresh, exactly the colours image 1 shows, never greyed, dusty or muted; no border white unless its tier is.` : "",
    rainbow.length ? `${rainbow.join("; ")} — keep its colours and patches as image 1 shows them.` : "",
    sprinkles?.words ? `Keep the sprinkles as image 1 shows them: ${sprinkles.words}, real sugar sprinkles.` : "",
    figures.length ? `On top keep the handmade sugar-paste figures exactly: ${figures.join(", ")} — the same shapes, colours, sizes and places, made real and matte.` : "",
    sides.length ? `Keep the sugar-paste figures stuck flat on the sides of the tiers exactly where image 1 has them: ${sides.join(", ")} — real and matte, pressed onto the buttercream.` : "",
    cutTop.length ? `On top keep the printed card cutout toppers exactly: ${cutTop.join(", ")} — flat glossy printed card cut out exactly along the picture's own outline with a thin white edge — never a rectangle or any background round it — each on a thin white stick pushed into the cake, the same pictures, sizes and places as image 1.` : "",
    cutSide.length ? `Keep the printed card cutouts stuck flat on the sides of the tiers exactly where image 1 has them: ${cutSide.join(", ")} — flat glossy printed card cut out exactly along the picture's own outline with a thin white edge, never a rectangle or any background round it.` : "",
    decos.length ? `Keep the small round decorations exactly where image 1 has them: ${decos.join(", ")} — real and shiny, each once, the same size.` : "",
    topper,
    // The sweets at its edge named (2026-11-04: a close-up test render left the cupcakes out).
    close ? `Keep ${cart ? "the cart" : plinths ? "the plinth" : "the table and its cloth, the same colour"}, ${sweets.length ? `the ${(k.sweets ?? []).flatMap((y) => { const x = CAKE_SWEETS.find((z) => z.id === y.id); return x ? [`${x.name.toLowerCase()} with their ${colourWords(y.colour)} icing`] : []; }).join(" and ")} beside the cake, every one of them kept in its colours, ` : ""}the wall with its decorations and whatever else shows at the edges of the picture as image 1 has them, softly out of focus.`
      : sweets.length ? `${plinths ? "On the other plinths, each on its own," : `On the ${cart ? "cart's counter" : "table"} beside the cake`} keep the sweets exactly where image 1 has them: ${sweets.join("; ")} — the same places, sizes and colours, made real.` : "",
    cart ? `Keep the ${onBoard ? "cake board" : "white cake stand"} and the sweet cart exactly as image 1 has them — its white wooden counter, its turned posts, its wheel and ${roof}, the same colour —${balloons ? ` ${balloons} exactly as image 1 has it, the same balloons in the same places and colours, —` : ""} and the floor and the wall behind it; a soft shadow under the cake.`
      : plinths ? `Keep the ${onBoard ? "cake board" : "white cake stand"} and the five white round plinths exactly as image 1 has them — their sizes, heights and places — and the floor and the wall behind them; a soft shadow under the cake.`
      : `Keep the ${onBoard ? "cake board" : "white cake stand"}, the table and the wall as they are; a soft shadow under the cake.`,
    realWords(k),
    LIGHT,
    `Nothing added and nothing taken away: no candles, ${characters ? "no real people or hands, no characters beyond the printed cutouts" : "no people, no hands, no characters"}, no fresh flowers, ${sprinkles?.words || k.sweets?.some((x) => x.sprinkles) ? "" : "no sprinkles, "}${sweets.length && !close ? "no other sweets or plates" : "no plates"}, no extra words or letters.`,
  ].filter(Boolean).join(" ");
}
