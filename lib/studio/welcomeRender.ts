// The words for the welcome board's render (app/api/welcome-render/route.ts, 2026-11-03): keep the scene of
// the live preview exactly, and make it one real photograph.

/** The words for the photograph: keep the scene, make it real. */
export function welcomePrompt(words: string[], stand: string): string {
  const said = words.filter(Boolean).map((w) => `"${w}"`).join(", ");
  return [
    "Image 1 is a preview of a printed welcome board for a children's birthday party: the board on its " + stand + ", a balloon garland beside it, in a room.",
    "Make it one real, natural photograph of exactly this scene, from the same camera position and with the same framing.",
    "Keep the board exactly: its shape, size, colours and printed artwork, and every word on it" + (said ? ` (${said})` : "") + " letter for letter, in the same lettering, size, colour and place, as real print on the board.",
    "Keep the stand, and keep the balloon garland as it is — every balloon in its place and colour, matte latex balloons, the same size — standing on the floor and hugging the board.",
    "Make the light real: soft, even daylight on the board and the balloons, gentle natural shadows on the wall and the floor, the board and the stand standing on the floor.",
    "Nothing added and nothing taken away: no people, no other furniture, no extra words or letters.",
  ].join(" ");
}
