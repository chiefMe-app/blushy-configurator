// The words for the giveaways' render (app/api/giveaway-render/route.ts, 2026-11-03): keep the scene of the live
// preview exactly — the boxes at the places on the kids' table, or on the shelves of the arch board — and make it
// one real photograph.
import { BOARD_SHOWS, type Giveaways } from "./giveaways";

const SHELF = ["top", "second", "third", "bottom"];
const NUM = ["no", "one", "two", "three"];

/** The boxes on the board, shelf by shelf (three to a shelf, as GiveawayBoardArt draws them). */
export function boardShelves(count: number): string {
  const shown = Math.min(count, BOARD_SHOWS);
  const rows = SHELF.map((name, i) => ({ name, n: Math.max(0, Math.min(3, shown - i * 3)) }));
  return rows.map((r) => `${NUM[r.n]} on the ${r.name} shelf`).join(", ");
}

/** The words for the photograph: keep the scene, make it real. */
export function giveawayPrompt(g: Pick<Giveaways, "place" | "name" | "age" | "boardLine" | "count">, { boxesAfter = false } = {}): string {
  const plate = [g.name.trim(), g.age].filter(Boolean).map((w) => `"${w}"`).join(" and ");
  const board = g.place === "board";
  const boardWords = [g.name.trim(), g.boardLine.trim()].filter(Boolean).map((w) => `"${w}"`).join(", ");
  const shown = Math.min(g.count, BOARD_SHOWS);
  // 2026-11-03: given the boxes, the engine drew two more and put characters on their stickers; so the scene goes
  // to it without them, and the preview's own boxes are laid on its picture afterwards.
  if (boxesAfter) return [
    board
      ? "Image 1 is a preview of an empty giveaway board for a children's birthday party: a tall arch board with shelves, standing in a room."
      : "Image 1 is a preview of one place at a children's birthday party table, seen from straight above: the placemat, plates, cup and cutlery.",
    "Make it one real, natural photograph of exactly this scene, from the same camera position, with the same framing and every part the same size and in the same place.",
    board
      ? "Keep the board exactly: its arch shape, its colour, and its words" + (boardWords ? ` (${boardWords})` : "") + " letter for letter as flat cut vinyl on the board — never puffy or raised. Its shelves stay exactly where they are, and EMPTY: nothing on them — gift boxes are set on them afterwards."
      : "Keep the table exactly as it is: every piece in its place, colour and size, the printed placemat flat on the table. The top of the place stays clear — a gift box is set there afterwards.",
    "Make the light real: soft, even, neutral daylight, gentle natural shadows — never yellow or orange light, no sunbeams or patches of sunlight.",
    "Nothing added: no boxes, no people, no faces, no characters, no toys or sweets, no extra words or letters.",
  ].join(" ");
  return [
    board
      ? "Image 1 is a preview of a giveaway board for a children's birthday party: a tall arch board with shelves, standing in a room, white gable gift boxes on its shelves."
      : "Image 1 is a preview of one place at a children's birthday party table, seen from straight above: the placemat, plates, cup, cutlery and a white gable gift box lying at the top of the place.",
    "Make it one real, natural photograph of exactly this scene, from the same camera position and with the same framing.",
    "Keep every gift box exactly: a white card gable box with a handle, its front printed with the same pattern, the same round sticker with the same picture, the same name plate" + (plate ? ` with ${plate}` : "") + " letter for letter, in the same lettering, colour and place, as real print on card.",
    board
      ? `Exactly ${shown} gift box${shown > 1 ? "es" : ""}, each where image 1 has it and the same size: ${boardShelves(g.count)}. Keep the board exactly: its arch shape, its colour, its shelves, and its words` + (boardWords ? ` (${boardWords})` : "") + " letter for letter as flat cut vinyl on the board — never puffy or raised."
      : "Exactly one gift box, where image 1 has it and the same size. Keep the table exactly as it is: every piece in its place, colour and size, the printed placemat flat on the table.",
    "Make the light real: soft, even, neutral daylight, gentle natural shadows — never yellow or orange.",
    "Nothing added and nothing taken away: no people, no extra boxes, toys or sweets, no extra words or letters.",
  ].join(" ");
}
