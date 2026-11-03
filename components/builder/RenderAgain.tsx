// Once a part is rendered, a new render of the same design (2026-11-03, the owner: "regenerate render çıkmıyor
// sanırım giveaways'de 1 render aldıktan sonra"): before, the button showed again only after a change.
import type { PieceRender } from "@/components/builder/usePieceRender";

export default function RenderAgain({ render, onGenerate, testId }: { render: PieceRender; onGenerate: () => void; testId: string }) {
  if (!render.ready || render.loading) return null;
  return (
    <div className="bz-tb-render again" data-testid={testId}>
      <button type="button" className="bz-back" onClick={onGenerate}>Regenerate render ✨</button>
      <p className="hint">Not quite right? A new render of this same design.</p>
      {render.error && <p className="error" role="alert">{render.error}</p>}
    </div>
  );
}
