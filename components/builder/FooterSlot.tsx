"use client";
// The fixed footer's place for a part's own Next (2026-11-05, the owner: "next ve back tuşlarını save designın
// ordaki sabit bölgeye taşıyalım"): a part's Finalize / Next button is drawn there, beside Back, while its logic
// stays with the part (FinishBar, DecorStep). Without a footer (a test, a thumbnail) it stays where it is.
import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

export const FooterSlot = createContext<HTMLElement | null>(null);

export function InFooter({ children }: { children: ReactNode }) {
  const slot = useContext(FooterSlot);
  return slot ? createPortal(children, slot) : <>{children}</>;
}
