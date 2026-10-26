// Shared by the isolated typography demo page and its API route.

/**
 * The lettering area on the Single Round photo (public/design/sketch, a
 * 1000-unit square, board 0.6472 across = 2000 mm, so 0.3236 units per mm):
 * the board face clear of the garland (left balloons end at x ~ 390 from
 * y = 320 down) and above the plinth (top at y = 560) — x 395–770,
 * y 300–545. 375 x 245 units = 1159 x 757 mm. Lettering sized from this area
 * fills the board the way Blushy's own boards do (a 2026-10-26 request:
 * "lettering daha büyük olsun").
 */
export const DEMO_BOX = { widthMm: 1159, heightMm: 757 };

export const DEMO_PHOTO = {
  room: "/design/sketch/round-room.webp",
  balloons: "/design/sketch/round-balloons.webp",
  plinth: "/design/sketch/plinth.webp",
  plinthBox: { x: 452.1, y: 560.5, w: 114.3, h: 333 },
  unitsPerMm: (0.3236 * 2 * 1000) / 2000,
  centre: { x: 582.5, y: 422.5 },
};

/**
 * The name's cap height at Large on the 2 m Single Round (Medium is 0.8 of
 * it): a short name spans about a third of the board, as on Blushy's boards.
 * The heading follows at the preset's ratio and shrinks if it gets too wide.
 */
export const DEMO_NAME_CAP_MM = 240;

export const MAX_TEXT = 60;
