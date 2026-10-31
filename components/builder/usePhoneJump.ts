// On a phone, every change brings a part's preview into sight (typing: once the
// field is left), and "Back to your choices" returns to where the change was
// made. Shared by the kids' table (2026-10-29) and the welcome board (2026-10-31:
// "welcome board'da değişiklik olunca mobilde preview'a kaydırsın").
import { useEffect, useRef, useState } from "react";

export const PHONE = "(max-width: 860px)";

/**
 * changeKey: what the customer chose ("" while there is nothing to show);
 * cardId: the preview's element id; onJump: called as it jumps, with the
 * time of the change (performance.now()).
 */
export function usePhoneJump(changeKey: string, cardId: string, onJump?: (changedAt: number) => void) {
  const [backTo, setBackTo] = useState<number | null>(null);
  const lastKey = useRef(changeKey);
  const jumped = useRef(onJump);
  jumped.current = onJump;
  useEffect(() => {
    // Not when the part is first added (the customer is about to choose), only on a change to it.
    const before = lastKey.current;
    lastKey.current = changeKey;
    if (!changeKey || !before || changeKey === before || typeof window === "undefined" || !window.matchMedia?.(PHONE).matches) return;
    const changedAt = performance.now();
    const jump = () => {
      const card = document.getElementById(cardId);
      if (!card) return;
      jumped.current?.(changedAt);
      setBackTo((b) => b ?? window.scrollY);
      card.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    const field = document.activeElement;
    if (field instanceof HTMLInputElement && field.type === "text") {
      // Words: once the customer leaves the field (or presses Enter), not on every letter.
      const left = (e: Event) => { if (e.type === "focusout" || (e as KeyboardEvent).key === "Enter") { stop(); jump(); } };
      const stop = () => { document.removeEventListener("focusout", left, true); document.removeEventListener("keydown", left, true); };
      document.addEventListener("focusout", left, true);
      document.addEventListener("keydown", left, true);
      return stop;
    }
    const t = setTimeout(jump, 350);
    return () => clearTimeout(t);
  }, [changeKey, cardId]);
  const back = () => {
    if (backTo !== null) window.scrollTo({ top: backTo, behavior: "smooth" });
    setBackTo(null);
  };
  return { backTo, back };
}
