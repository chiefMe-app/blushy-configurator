// A drawing on the page as a JPEG, made in the browser (2026-11-02, the finished designs; 2026-11-03, the
// welcome board's preview sent to be rendered).
import { toJpeg } from "html-to-image";

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
export async function nodeJpeg(node: HTMLElement | SVGSVGElement, width: number): Promise<string> {
  await document.fonts.ready;
  const box = node.getBoundingClientRect();
  const options = { quality: 0.92, backgroundColor: "#FFFFFF", width: box.width, height: box.height, pixelRatio: width / box.width,
    style: { borderRadius: "0" }, fontEmbedCSS: await fontCssFor(node as HTMLElement) };
  // Twice: some browsers (Safari) draw the first picture before its fonts are in.
  await toJpeg(node as HTMLElement, options);
  return toJpeg(node as HTMLElement, options);
}
