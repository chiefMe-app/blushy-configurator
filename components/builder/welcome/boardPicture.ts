// The welcome board's drawing as a JPEG for its render (2026-10-31): the
// builder's own SVG, drawn onto a canvas in the customer's browser. The words
// are drawn by the canvas itself in the page's fonts — an SVG made into a
// picture cannot reach the page's web fonts, and the server has none (see
// lib/guideFonts.ts) — so the render model sees the customer's exact lettering.
// Example words shown faded (nothing typed yet) are left out.

const dataUrl = (blob: Blob) => new Promise<string>((ok, fail) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result));
  r.onerror = () => fail(r.error);
  r.readAsDataURL(blob);
});

interface Words { text: string; x: number; y: number; size: number; spacing: number; font: string; fill: string; halo?: { colour: string; width: number } }

/**
 * The board's drawing as a JPEG data URI, its longer side `long` pixels.
 * The balloons and flowers are left out: drawn, the render model kept them
 * flat (2026-10-31 tests); the prompt asks for them in words.
 */
export async function boardPicture(svg: SVGSVGElement, long = 1400): Promise<string> {
  await document.fonts?.ready;
  const vb = svg.viewBox.baseVal;
  const scale = long / Math.max(vb.width, vb.height);
  const W = Math.round(vb.width * scale), H = Math.round(vb.height * scale);

  // The words, as the page draws them (its fonts, its colours), the real ones only.
  const words: Words[] = Array.from(svg.querySelectorAll("text")).flatMap((t) => {
    if (Number(t.getAttribute("opacity") ?? "1") < 1 || !t.textContent?.trim()) return [];
    const css = getComputedStyle(t);
    const g = t.parentElement;
    const haloWidth = Number(g?.getAttribute("stroke-width") ?? g?.getAttribute("strokeWidth") ?? 0);
    return [{
      text: t.textContent, x: Number(t.getAttribute("x")), y: Number(t.getAttribute("y")),
      size: Number(t.getAttribute("font-size")), spacing: Number(t.getAttribute("letter-spacing") ?? 0),
      font: `${css.fontWeight} SIZEpx ${css.fontFamily}`, fill: css.fill,
      ...(haloWidth && g?.getAttribute("stroke") ? { halo: { colour: g.getAttribute("stroke")!, width: haloWidth } } : {}),
    }];
  });

  // Everything else: the drawing without its words, its pictures carried inside it.
  const copy = svg.cloneNode(true) as SVGSVGElement;
  copy.querySelectorAll("text, [data-part=balloons], [data-part=flowers]").forEach((t) => t.remove());
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copy.setAttribute("width", String(W));
  copy.setAttribute("height", String(H));
  copy.removeAttribute("class");
  await Promise.all(Array.from(copy.querySelectorAll("image")).map(async (img) => {
    const href = img.getAttribute("href");
    if (!href || href.startsWith("data:")) return;
    const res = await fetch(href);
    if (res.ok) img.setAttribute("href", await dataUrl(await res.blob()));
  }));
  const picture = new Image();
  picture.decoding = "sync";
  await new Promise<void>((ok, fail) => {
    picture.onload = () => ok();
    picture.onerror = () => fail(new Error("the drawing could not be made into a picture"));
    picture.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(copy))}`;
  });

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(picture, 0, 0, W, H);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  for (const w of words) {
    ctx.font = w.font.replace("SIZE", (w.size * scale).toFixed(2));
    if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${(w.spacing * scale).toFixed(2)}px`;
    const x = (w.x - vb.x) * scale, y = (w.y - vb.y) * scale;
    if (w.halo) { ctx.strokeStyle = w.halo.colour; ctx.lineWidth = w.halo.width * scale * 2; ctx.lineJoin = "round"; ctx.strokeText(w.text, x, y); }
    ctx.fillStyle = w.fill;
    ctx.fillText(w.text, x, y);
  }
  return canvas.toDataURL("image/jpeg", 0.9);
}
