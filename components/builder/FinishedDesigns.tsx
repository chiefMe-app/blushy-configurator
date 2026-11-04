"use client";
// The party's finished designs, one by one, as JPEGs (2026-11-02, the owner: "biyerde finalize olmuş table
// setup dizaynı, backdrop vs tek tek çıkmalı. Jpeg şeklinde"): on Package and Review, a card per piece —
// the backdrop's render (or its live sketch), the kids' table, the grown-ups' table, the welcome board —
// each drawn off-screen, made into a JPEG in the browser and shown as that picture, with a Download.
// If a picture can't be made, the live drawing shows instead.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { nodeJpeg } from "@/components/builder/nodeJpeg";
import { THEMES, formatAED, priceBreakdown, themeById, type BuilderConfig, type PriceLine } from "@/lib/config";
import { EXPERIENCES } from "@/lib/studio/experiences";
import { JPEG_WIDTH, finishedPieces, type FinishedPiece } from "@/lib/finishedDesigns";
import LiveSketch from "@/components/design/LiveSketch";
import TablePlace from "@/components/studio/table/TablePlace";
import AdultTableSketch from "@/components/studio/table/AdultTableSketch";
import { GiveawayBoardArt } from "@/components/builder/giveaways/GiveawaysPreview";
import { PinataArt } from "@/components/builder/pinata/PinataPreview";
import { HeliumArt } from "@/components/builder/helium/HeliumPreview";
import { CakeArt } from "@/components/builder/cake/CakePreview";
import WelcomeBoardArt from "@/components/studio/WelcomeBoardArt";

/** A JPEG of a picture at `url` (the render): through a canvas, so it can be saved under our name. */
async function jpegOfImage(url: string): Promise<string> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();
  const k = Math.min(1, JPEG_WIDTH / img.naturalWidth);
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  const g = c.getContext("2d")!;
  g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.92);
}

/** Each piece's lines in the price breakdown. */
const SECTION: Record<FinishedPiece["id"], PriceLine["section"]> = {
  backdrop: "design", kids: "table", adults: "adults", welcome: "welcome", giveaways: "giveaways", pinata: "pinata", cake: "cake", helium: "helium",
};

function DesignCard({ piece, drawing, imageUrl, redraw, price, onEdit }: { piece: FinishedPiece; drawing?: ReactNode; imageUrl?: string | null; redraw: string; price: number; onEdit?: () => void }) {
  const stage = useRef<HTMLDivElement>(null);
  const [jpeg, setJpeg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    setFailed(false);
    // A moment for the drawing's photos (and a sketch's recoloured balloons) to come in, and for a run of
    // changes to settle.
    const t = window.setTimeout(async () => {
      try {
        let out: string;
        if (imageUrl) out = await jpegOfImage(imageUrl);
        else {
          const node = stage.current?.firstElementChild as HTMLElement | null;
          if (!node || !node.offsetWidth) throw new Error("nothing drawn");
          out = await nodeJpeg(node, JPEG_WIDTH);
        }
        if (live) setJpeg(out);
      } catch {
        if (live) { setJpeg(null); setFailed(true); }
      }
    }, 1500);
    return () => { live = false; window.clearTimeout(t); };
  }, [redraw, imageUrl]);

  return (
    <figure className="bz-finished-card" data-testid={`finished-${piece.id}`}>
      <div className={`pic ${failed && !imageUrl ? "live" : ""}`}>
        {jpeg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={jpeg} alt={`Your ${piece.title.toLowerCase()}`} data-testid={`finished-${piece.id}-jpeg`} />
        ) : failed && imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={`Your ${piece.title.toLowerCase()}`} />
        ) : failed ? null : (
          <div className="making"><span className="bz-spinner" aria-hidden="true" /> Making your picture…</div>
        )}
        {/* The drawing: off-screen while its JPEG is made; shown itself if the JPEG can't be. */}
        {drawing && <div ref={stage} className={`stage ${failed ? "shown" : ""}`} aria-hidden={!failed}>{drawing}</div>}
        <span className={`state ${piece.finished ? "done" : ""}`}>{piece.finished ? "✓ Finished" : "In progress"}</span>
      </div>
      <figcaption>
        <span className="title">{piece.title}</span>
        <span className="price">AED {formatAED(price)}</span>
      </figcaption>
      <div className="acts">
        {onEdit && <button type="button" className="bz-finished-edit" onClick={onEdit} data-testid={`finished-${piece.id}-edit`}>Edit</button>}
        {jpeg ? <a className="bz-finished-save" href={jpeg} download={piece.file} data-testid={`finished-${piece.id}-download`}>JPEG ↓</a>
          : failed && imageUrl ? <a className="bz-finished-save" href={imageUrl} target="_blank" rel="noreferrer">Open ↗</a> : null}
      </div>
    </figure>
  );
}

/**
 * 2026-11-03 (the owner: "o renderı en son görelim yan yana"): each piece's render, where it has one — the
 * backdrop's, the kids' table's top view, the welcome board's — side by side; its drawing otherwise.
 */
export default function FinishedDesigns({ config, renderUrl, tableRenderUrl, welcomeRenderUrl, giveawaysRenderUrl, pinataRenderUrl, cakeRenderUrl, heliumRenderUrl, onEdit, onEditExperiences }: { config: BuilderConfig; renderUrl?: string | null; tableRenderUrl?: string | null; welcomeRenderUrl?: string | null; giveawaysRenderUrl?: string | null; pinataRenderUrl?: string | null; cakeRenderUrl?: string | null; heliumRenderUrl?: string | null; onEdit?: (id: FinishedPiece["id"]) => void; onEditExperiences?: () => void }) {
  const pieces = finishedPieces(config);
  const experiences = (config.experiences?.picked ?? []).map((id) => EXPERIENCES.find((e) => e.id === id)!).filter(Boolean);
  if (!pieces.length && !experiences.length) return null;
  const lines = priceBreakdown(config).lines;
  const sum = (section: PriceLine["section"]) => lines.filter((l) => l.section === section).reduce((t, l) => t + l.amount, 0);
  const all = pieces.reduce((t, p) => t + sum(SECTION[p.id]), 0) + sum("experiences");
  const theme = themeById(config.theme) ?? THEMES[0];
  const drawingOf = (p: FinishedPiece): { drawing?: ReactNode; imageUrl?: string | null; redraw: string } => {
    switch (p.id) {
      case "backdrop": return renderUrl ? { imageUrl: renderUrl, redraw: renderUrl }
        : { drawing: <div className="art"><LiveSketch config={config} activeId={null} /></div>, redraw: JSON.stringify([config.theme, config.decor]) };
      case "kids": if (tableRenderUrl) return { imageUrl: tableRenderUrl, redraw: tableRenderUrl };
        return { drawing: <div className="art"><TablePlace table={config.table!} theme={theme} mode="one" /></div>, redraw: JSON.stringify([config.theme, config.table]) };
      case "adults": return { drawing: <div className="art"><AdultTableSketch a={config.adultTable!} theme={theme} /></div>, redraw: JSON.stringify([config.theme, config.adultTable]) };
      case "welcome": if (welcomeRenderUrl) return { imageUrl: welcomeRenderUrl, redraw: welcomeRenderUrl };
        return { drawing: <div className="art"><WelcomeBoardArt board={config.welcomeBoard!} theme={theme} balloons={config.decor.balloonColors} placeholders={false} /></div>,
        redraw: JSON.stringify([config.theme, config.welcomeBoard, config.decor.balloonColors]) };
      case "giveaways": if (giveawaysRenderUrl) return { imageUrl: giveawaysRenderUrl, redraw: giveawaysRenderUrl };
        return { drawing: <div className="art"><GiveawayBoardArt g={config.giveaways!} theme={theme} balloons={config.decor.balloonColors} /></div>, redraw: JSON.stringify([config.theme, config.giveaways, config.decor.balloonColors]) };
      case "pinata": if (pinataRenderUrl) return { imageUrl: pinataRenderUrl, redraw: pinataRenderUrl };
        return { drawing: <div className="art"><PinataArt p={config.pinata!} theme={theme} /></div>, redraw: JSON.stringify([config.theme, config.pinata]) };
      case "cake": if (cakeRenderUrl) return { imageUrl: cakeRenderUrl, redraw: cakeRenderUrl };
        return { drawing: <div className="art"><CakeArt k={config.cake!} themeId={config.theme} /></div>, redraw: JSON.stringify([config.theme, config.cake]) };
      case "helium": if (heliumRenderUrl) return { imageUrl: heliumRenderUrl, redraw: heliumRenderUrl };
        return { drawing: <div className="art"><HeliumArt h={config.helium!} /></div>, redraw: JSON.stringify([config.theme, config.helium]) };
    }
  };
  // 2026-11-04 (the owner: the finished designs looked messy): one tidy gallery beside the packages — every piece
  // the same frame, its price, Edit back to it and its JPEG; the experiences in one card at the end.
  return (
    <section className="bz-finished" aria-label="Your finished designs" data-testid="finished-designs">
      {/* The lettering fonts (the board's name, the placemats' words). */}
      <link rel="stylesheet" href="/fonts/typography/fonts.css" />
      <div className="head">
        <h2>Your finished designs</h2>
        <p>{pieces.length} piece{pieces.length === 1 ? "" : "s"}{experiences.length ? ` and ${experiences.length} experience${experiences.length > 1 ? "s" : ""}` : ""} · <b>AED {formatAED(all)}</b></p>
      </div>
      <div className="grid">
        {pieces.map((p) => <DesignCard key={p.id} piece={p} {...drawingOf(p)} price={sum(SECTION[p.id])} onEdit={onEdit ? () => onEdit(p.id) : undefined} />)}
        {experiences.length > 0 && (
          <figure className="bz-finished-card exp" data-testid="finished-experiences">
            <div className="pic mosaic">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {experiences.slice(0, 4).map((e) => <img key={e.id} src={`/design/experiences/${e.pic}.webp`} alt="" />)}
            </div>
            <figcaption>
              <span className="title">Experiences</span>
              <span className="price">AED {formatAED(sum("experiences"))}</span>
            </figcaption>
            <p className="list">{experiences.map((e) => e.name).join(" · ")}</p>
            {onEditExperiences && <div className="acts"><button type="button" className="bz-finished-edit" onClick={onEditExperiences}>Edit</button></div>}
          </figure>
        )}
      </div>
    </section>
  );
}
