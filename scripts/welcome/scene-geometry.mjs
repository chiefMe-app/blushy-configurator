// Where things are in the welcome board's scene renders, in centimetres, as the
// builder draws them (components/studio/WelcomeBoardArt.tsx): a medium board
// 70 cm wide from x 0, its top at y 6; a round board 70 × 70. Shared by
// scene-render.mjs (its guides) and scene-prepare.ts (finding the board).
export const W = 70, TOP = 6;
export const sceneFace = (shape) => ({ w: W, h: shape === "round" ? 70 : 100 });
/** The frame each scene is drawn in: 180 cm square, room for a garland on the right. */
export function sceneFrame(shape, stand) {
  const { h } = sceneFace(shape);
  const floor = TOP + h + (stand === "easel" ? 40 : 30);
  return { x: -50, y: floor + 24 - 180, size: 180, floor };
}
