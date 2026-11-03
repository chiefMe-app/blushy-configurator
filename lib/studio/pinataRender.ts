// The words for the piñata's render (app/api/pinata-render/route.ts, 2026-11-03): keep the scene of the live
// preview exactly — the piñata on the stand's hook in the party room — and make it one real photograph.
import { pinataSize, pinataWords, type Pinata } from "./pinata";

/** The words for the photograph: keep the scene, make it real. */
export function pinataPrompt(p: Pinata): string {
  const opening = p.opening === "pull"
    ? "Under it hang its pull strings — thin satin ribbons in the same colours, each one where image 1 has it; make them real ribbons, hanging softly."
    : "Keep the piñata stick leaning on the stand's right leg, wrapped in crepe paper in the same colours, and the satin blindfold lying on the floor by it; make them real.";
  return [
    `Image 1 is a preview of a children's birthday party room: ${pinataWords(p)}, about ${pinataSize(p.size).cm} cm tall, hanging by a rope from the hook of a white piñata stand.`,
    "Make it one real, natural photograph of exactly this scene, from the same camera position, with the same framing and every part the same size and in the same place.",
    p.kind === "number"
      ? `Keep the piñata exactly: the number ${p.number}, the same shape, the same colours in the same bands, covered all over in real layered tissue-paper fringe.`
      : "Keep the piñata exactly: the same shape, the same colours and the same details, covered in real layered tissue-paper fringe.",
    opening,
    "Give it real light and a soft shadow on the wall behind it. Keep the room, the stand and the floor as they are.",
    "Make the light real: soft, even, neutral daylight, gentle natural shadows — never yellow or orange light, no sunbeams or patches of sunlight.",
    "Nothing added and nothing taken away: no people, no faces, no characters, no balloons, no sweets on the floor, no extra words or letters.",
  ].join(" ");
}
