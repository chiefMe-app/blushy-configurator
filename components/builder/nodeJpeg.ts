// A drawing on the page as a JPEG, made in the browser (2026-11-02, the finished designs; 2026-11-03, the
// welcome board's preview sent to be rendered).
import { toJpeg, toPng } from "html-to-image";

/**
 * The @font-face rules of the fonts a drawing uses, their files inlined: html-to-image's own embedding left
 * the board's name in Georgia (2026-11-02), so it is handed these instead.
 */
async function fontCssFor(node: HTMLElement): Promise<string> {
  const families = new Set<string>();
  for (const el of [node, ...Array.from(node.querySelectorAll("*"))]) {
    for (const f of getComputedStyle(el).fontFamily.split(",")) families.add(f.trim().replace(/^["']|["']$/g, "").toLowerCase());
  }
  const rules: CSSFontFaceRule[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let list: CSSRuleList;
    try { list = sheet.cssRules; } catch { continue; } // another site's sheet
    for (const r of Array.from(list)) {
      if (r instanceof CSSFontFaceRule && families.has(r.style.getPropertyValue("font-family").trim().replace(/^["']|["']$/g, "").toLowerCase())) rules.push(r);
    }
  }
  const asData = async (url: string) => {
    const blob = await (await fetch(url)).blob();
    return await new Promise<string>((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = no; r.readAsDataURL(blob); });
  };
  // A page's stylesheets can hold the same rule more than once (next/font's, once per use).
  const seen = new Set<string>();
  const out = await Promise.all(rules.filter((r) => !seen.has(r.cssText) && !!seen.add(r.cssText)).map(async (r) => {
    // Without `font-display: swap`: in the picture, a swap draws the fallback and never swaps back.
    let css = r.cssText.replace(/font-display:\s*\w+;?/g, "");
    const base = r.parentStyleSheet?.href ?? location.href;
    for (const m of Array.from(css.matchAll(/url\((["']?)([^"')]+)\1\)/g))) {
      if (m[2].startsWith("data:")) continue;
      try { css = css.replace(m[0], `url("${await asData(new URL(m[2], base).href)}")`); } catch { /* left as it was */ }
    }
    return css;
  }));
  return out.join("\n");
}

/**
 * The node drawn as a JPEG data URI, `width` px wide, its lettering in its own fonts. An SVG too (2026-11-03,
 * the kids' table's one place), which has no offset size; square-cornered, as a photo to be rendered is.
 */
export async function nodeJpeg(node: HTMLElement | SVGSVGElement, width: number, { square = false } = {}): Promise<string> {
  await document.fonts.ready;
  const rect = node.getBoundingClientRect();
  // A square drawing (the backdrop's sketch, its viewBox square) drawn at its own square, without the bands its box adds.
  const side = Math.min(rect.width, rect.height);
  const box = square ? { width: side, height: side } : rect;
  const options = { quality: 0.92, backgroundColor: "#FFFFFF", width: box.width, height: box.height, pixelRatio: width / box.width,
    style: { borderRadius: "0" }, fontEmbedCSS: await fontCssFor(node as HTMLElement),
    // What is only there to edit the drawing (the cake's chosen figure, its frame) stays out of the picture.
    filter: (n: Node) => !(n instanceof Element && n.hasAttribute("data-no-capture")) };
  // Twice: some browsers (Safari) draw the first picture before its fonts are in.
  await toJpeg(node as HTMLElement, options);
  return toJpeg(node as HTMLElement, options);
}

/** A part of the live sketch that is its boards' words (LiveSketch's `data-sketch-words` groups). */
export const isSketchWords = (n: Node) => n instanceof Element && n.hasAttribute("data-sketch-words");

/**
 * Only the live sketch's words, on a clear ground, `size` px square — its viewBox square, as nodeJpeg's square
 * picture of it (2026-11-03: laid flat on the backdrop's render afterwards, as flat cut vinyl). Without the sketch's
 * soft shadow. Null when it has none.
 */
export async function sketchWordsPng(svg: SVGSVGElement, size: number): Promise<string | null> {
  const words = Array.from(svg.children).filter(isSketchWords);
  if (!words.length) return null;
  const out = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  out.setAttribute("viewBox", svg.getAttribute("viewBox") ?? `0 0 ${size} ${size}`);
  out.setAttribute("width", String(size));
  out.setAttribute("height", String(size));
  for (const w of words) {
    const c = w.cloneNode(true) as Element;
    c.removeAttribute("filter");
    out.appendChild(c);
  }
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(out)], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    canvas.getContext("2d")!.drawImage(img, 0, 0, size, size);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * The live sketch as nodeJpeg's square picture, without its words (html-to-image copies an SVG whole, so they are
 * taken out of a copy of it, drawn off screen at the sketch's size).
 */
export async function sketchJpegWithoutWords(svg: SVGSVGElement, width: number): Promise<string> {
  const bare = svg.cloneNode(true) as SVGSVGElement;
  bare.querySelectorAll("[data-sketch-words]").forEach((e) => e.remove());
  const r = svg.getBoundingClientRect();
  // Off screen by its holder, at the sketch's size (the sketch fills its frame): html-to-image draws the copy with
  // its own computed position.
  const holder = document.createElement("div");
  Object.assign(holder.style, { position: "fixed", left: "-10000px", top: "0", width: `${r.width}px`, height: `${r.height}px`, pointerEvents: "none" });
  holder.setAttribute("aria-hidden", "true");
  holder.appendChild(bare);
  (svg.parentElement ?? document.body).appendChild(holder);
  try {
    return await nodeJpeg(bare, width, { square: true });
  } finally {
    holder.remove();
  }
}

/**
 * A drawing in two layers, both at its own size (2026-11-03, the giveaways: the test render redrew the boxes —
 * two more of them, and characters on their stickers): the picture without the parts `selector` picks, as a JPEG
 * for the engine, and only those parts on a clear ground, as a PNG laid on the render afterwards.
 */
export async function svgLayers(svg: SVGSVGElement, width: number, selector: string): Promise<{ without: string; only: string | null }> {
  const r = svg.getBoundingClientRect();
  const bare = svg.cloneNode(true) as SVGSVGElement;
  const parts = bare.querySelectorAll(selector);
  parts.forEach((e) => e.remove());
  const solo = svg.cloneNode(true) as SVGSVGElement;
  // Everything else hidden in place, so the parts keep their frames (a box sits inside a place's transform).
  solo.style.visibility = "hidden";
  solo.querySelectorAll<SVGElement>(selector).forEach((e) => { e.style.visibility = "visible"; });
  // Both copies at the drawing's own size on the page (its CSS would size them to the holder otherwise), so the
  // parts land where the picture has them.
  for (const c of [bare, solo]) {
    c.style.setProperty("width", `${r.width}px`, "important");
    c.style.setProperty("height", `${r.height}px`, "important");
    c.style.setProperty("max-height", "none", "important");
  }
  const holder = document.createElement("div");
  Object.assign(holder.style, { position: "fixed", left: "-10000px", top: "0", width: `${r.width}px`, height: `${r.height}px`, pointerEvents: "none" });
  holder.setAttribute("aria-hidden", "true");
  (svg.parentElement ?? document.body).appendChild(holder);
  try {
    holder.appendChild(bare);
    const without = await nodeJpeg(bare, width);
    bare.remove();
    if (!parts.length) return { without, only: null };
    holder.appendChild(solo);
    await document.fonts.ready;
    const options = { width: r.width, height: r.height, pixelRatio: width / r.width, fontEmbedCSS: await fontCssFor(solo as unknown as HTMLElement) };
    await toPng(solo as unknown as HTMLElement, options);
    return { without, only: await toPng(solo as unknown as HTMLElement, options) };
  } finally {
    holder.remove();
  }
}
