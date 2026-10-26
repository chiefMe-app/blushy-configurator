// Shared by the isolated typography demo page and its API route.

/** The Single Round's clear lettering area (0.36 x 2000 mm board, 0.96 fill). */
export const DEMO_BOX = { widthMm: 691, heightMm: 420 };

/**
 * Where that area sits on the Single Round photo (public/design/sketch, a
 * 1000-unit square): the board is 0.6472 of the image across = 2000 mm, and the
 * lettering is centred where the guide and the live sketch put it — right of
 * centre, clear of the garland, above the middle.
 */
export const DEMO_PHOTO = {
  room: "/design/sketch/round-room.webp",
  balloons: "/design/sketch/round-balloons.webp",
  plinth: "/design/sketch/plinth.webp",
  plinthBox: { x: 452.1, y: 560.5, w: 114.3, h: 333 },
  unitsPerMm: (0.3236 * 2 * 1000) / 2000,
  centre: { x: 0.5004 * 1000 + 0.3236 * 1000 * 0.12, y: 0.5154 * 1000 - 0.3236 * 1000 * 0.18 },
};

export const MAX_TEXT = 60;
