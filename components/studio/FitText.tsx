// SVG words that never run wider than their room (2026-11-03, the owner, of the giveaway board's render: "yazı büyük
// kaldı board'dan"): drawn at their size, measured once their font is in, and made smaller if they run over —
// a size guessed from the letters' count let a wide face (Bold) run off the board.
import { useEffect, useLayoutEffect, useRef, useState, type SVGProps } from "react";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export default function FitText({ maxWidth, fontSize, children, ...props }: Omit<SVGProps<SVGTextElement>, "fontSize" | "children"> & { maxWidth: number; fontSize: number; children: string }) {
  const ref = useRef<SVGTextElement>(null);
  const [k, setK] = useState(1);
  const family = (props.style as React.CSSProperties | undefined)?.fontFamily;
  useIsoLayoutEffect(() => {
    let alive = true;
    const fit = () => {
      const el = ref.current;
      if (!alive || !el) return;
      const now = Number(el.getAttribute("font-size")) || fontSize;
      const len = el.getComputedTextLength();
      if (!len) return; // not shown yet
      const natural = (len * fontSize) / now;
      const next = Math.min(1, maxWidth / natural);
      setK((prev) => (Math.abs(prev - next) > 0.01 ? next : prev));
    };
    fit();
    document.fonts?.ready.then(fit);
    return () => { alive = false; };
  }, [children, fontSize, maxWidth, family]);
  return <text ref={ref} fontSize={fontSize * k} {...props}>{children}</text>;
}
