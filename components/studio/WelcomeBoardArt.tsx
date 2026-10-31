// The welcome board drawn as it will stand (2026-10-31): to scale in
// centimetres, its face the theme's art (turned upright) or a plain colour,
// the customer's words in their lettering, on its easel. Free and live.
import { tableFont, fontCss, asPrinted } from "@/lib/studio/tableFonts";
import { boardArt, boardSize, boardWordsColour, type WelcomeBoard } from "@/lib/studio/welcomeBoard";

const isLight = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255)) / 255 > 0.75;
};

export default function WelcomeBoardArt({ board, theme, className, placeholders = true }: {
  board: WelcomeBoard;
  theme: { id: string; accent: string };
  className?: string;
  /** Show example words where the customer has none yet (the builder), or leave them out (a saved design). */
  placeholders?: boolean;
}) {
  const { w, h } = boardSize(board);
  const easel = board.stand === "easel";
  const top = 6, cx = w / 2, cy = top + h / 2;
  const art = boardArt(board, theme.id);
  const ink = boardWordsColour(board, theme);
  const halo = isLight(ink) ? { stroke: "rgba(60,40,50,0.35)", strokeWidth: 0.25, paintOrder: "stroke" as const } : {};
  const font = tableFont(board.font);
  const name = board.name.trim() || (placeholders ? "Arya's" : "");
  const line = board.line.trim() || (placeholders ? "Birthday party" : "");
  const faded = (real: string) => (real.trim() ? 1 : 0.4);
  // The name as big as fits the board's width.
  const nameSize = Math.min(w * 0.2 * font.scale, (w * 0.86 * (font.hand ? 1.6 : 1)) / Math.max(4, name.length * 0.62));
  const shape = board.shape === "arch"
    ? `M0,${top + h}L0,${top + w / 2}A${w / 2},${w / 2} 0 0 1 ${w},${top + w / 2}L${w},${top + h}Z`
    : `M0,${top}H${w}V${top + h}H0Z`;
  const id = `wb-${board.shape}-${board.size}`;
  return (
    <svg className={className} viewBox={`-22 0 ${w + 44} ${h + top + (easel ? 46 : 8)}`} role="img" aria-label="Your welcome board">
      <defs><clipPath id={id}><path d={shape} /></clipPath></defs>
      {easel && <g stroke="#C9B9A6" strokeWidth={2.2} strokeLinecap="round" fill="none">
        <path d={`M${cx},${top + 4}L${cx - w * 0.42},${top + h + 42}M${cx},${top + 4}L${cx + w * 0.42},${top + h + 42}M${cx},${top + 4}L${cx},${top + h + 36}`} />
      </g>}
      <g clipPath={`url(#${id})`}>
        <rect x={0} y={top} width={w} height={h} fill={art ? "#FFFFFF" : board.colour} />
        {art && (
          // eslint-disable-next-line jsx-a11y/alt-text
          <image href={art} x={cx - h / 2} y={cy - w / 2} width={h} height={w} preserveAspectRatio="xMidYMid slice" transform={`rotate(90 ${cx} ${cy})`} />
        )}
      </g>
      <path d={shape} fill="none" stroke={board.material === "acrylic" ? "#B9C3CD" : "#5a4950"} strokeWidth={board.material === "acrylic" ? 1.2 : 0.6} />
      {board.material === "acrylic" && <path d={`M${w * 0.1},${top + h * 0.25}L${w * 0.3},${top + h * 0.12}`} stroke="#FFFFFF" strokeWidth={1.4} opacity={0.7} strokeLinecap="round" />}
      <g fill={ink} textAnchor="middle" {...halo}>
        {board.heading.trim() && <text x={cx} y={top + h * 0.34} fontSize={w * 0.075} letterSpacing={w * 0.012} style={{ fontFamily: "var(--bz-sans), 'DM Sans', sans-serif", fontWeight: 700 }}>{board.heading.trim().toUpperCase()}</text>}
        {name && <text x={cx} y={top + h * 0.34 + nameSize * 1.05} fontSize={nameSize} opacity={faded(board.name)} style={{ fontFamily: `${fontCss(font)}, Georgia, serif`, fontWeight: font.weight }}>{asPrinted(name, font)}</text>}
        {line && <text x={cx} y={top + h * 0.34 + nameSize * 1.05 + w * 0.13} fontSize={w * 0.07} letterSpacing={w * 0.008} opacity={faded(board.line)} style={{ fontFamily: "var(--bz-sans), 'DM Sans', sans-serif", fontWeight: 600 }}>{line.toUpperCase()}</text>}
      </g>
      {easel && <rect x={-4} y={top + h - 1} width={w + 8} height={3.5} rx={1} fill="#C9B9A6" />}
    </svg>
  );
}
