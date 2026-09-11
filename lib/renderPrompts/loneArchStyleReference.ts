// ---------------------------------------------------------------------------
// Lone Arch — balloon STYLE reference image.
//
// 2026-09-11. The customer asked for the single-arch garland to match a
// specific look, and describing that look in words kept producing something
// plausible but not it. The flux-2 edit models take an ARRAY of image_urls, so
// the reference photograph itself can be handed to the model alongside the
// layout guide. That is strictly better than any wording: the model can see the
// arrangement instead of reading an approximation of it.
//
// Image roles when this is set (see buildLayoutRefEditPrompt):
//   image 1 — the layout guide. Authoritative for GEOMETRY: board size and
//             position, plinth, camera, and where the garland sits.
//   image 2 — this reference. Authoritative for the balloon STYLING only:
//             arrangement, density, size mix, clustering, how it hangs.
//             Explicitly NOT for colour — the backdrop colour and the balloon
//             palette come from the customer's own selection, and the prompt
//             says so, because this reference has a blue board and a pink/blue
//             palette that would otherwise bleed into every render.
//
// Set this to either:
//   - a public https URL (a fal.media asset URL works directly, and is the
//     cheapest option — nothing is embedded in the bundle), or
//   - a data URI ("data:image/jpeg;base64,...."), which is what
//     scripts/embed-style-reference.mjs generates from a local file.
//
// Leave it null to disable the second input entirely; the pipeline then behaves
// exactly as it did before this existed.
// ---------------------------------------------------------------------------
export const LONE_ARCH_STYLE_REFERENCE: string | null = null;

/** True when a usable reference is configured. */
export function hasLoneArchStyleReference(): boolean {
  const v = LONE_ARCH_STYLE_REFERENCE;
  return typeof v === "string" && v.trim().length > 0;
}
