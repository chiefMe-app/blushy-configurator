"use client";
// The party's finished designs, one by one, as JPEGs (2026-11-02, the owner: "biyerde finalize olmuş table
// setup dizaynı, backdrop vs tek tek çıkmalı. Jpeg şeklinde"): on Package and Review, a card per piece —
// the backdrop's render (or its live sketch), the kids' table, the grown-ups' table, the welcome board —
// each drawn off-screen, made into a JPEG in the browser and shown as that picture, with a Download.
// If a picture can't be made, the live drawing shows instead.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { nodeJpeg } from "@/components/builder/nodeJpeg";
import { THEMES, themeById, type BuilderConfig } from "@/lib/config";
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

function DesignCard({ piece, drawing, imageUrl, redraw }: { piece: FinishedPiece; drawing?: ReactNode; imageUrl?: string | null; redraw: string }) {
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
      <figcaption>
        <span className="title">✦ {piece.title}</span>
        <span className={`state ${piece.finished ? "done" : ""}`}>{piece.finished ? "✓ Finished" : "In progress"}</span>
      </figcaption>
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
      </div>
      {jpeg ? <a className="bz-finished-save" href={jpeg} download={piece.file} data-testid={`finished-${piece.id}-download`}>Download JPEG ↓</a>
        : failed && imageUrl ? <a className="bz-finished-save" href={imageUrl} target="_blank" rel="noreferrer">Open the picture ↗</a> : null}
    </figure>
  );
}

/**
 * 2026-11-03 (the owner: "o renderı en son görelim yan yana"): each piece's render, where it has one — the
 * backdrop's, the kids' table's top view, the welcome board's — side by side; its drawing otherwise.
 */
export default function FinishedDesigns({ config, renderUrl, tableRenderUrl, welcomeRenderUrl, giveawaysRenderUrl, pinataRenderUrl, cakeRenderUrl, heliumRenderUrl }: { config: BuilderConfig; renderUrl?: string | null; tableRenderUrl?: string | null; welcomeRenderUrl?: string | null; giveawaysRenderUrl?: string | null; pinataRenderUrl?: string | null; cakeRenderUrl?: string | null; heliumRenderUrl?: string | null }) {
  const pieces = finishedPieces(config);
  if (!pieces.length) return null;
  const theme = themeById(config.theme) ?? THEMES[0];
  const drawingOf = (p: FinishedPiece): { drawing?: ReactNode; imageUrl?: string | null; redraw: string } => {
    switch (p.id) {
      case "backdrop": return renderUrl ? { imageUrl: renderUrl, redraw: renderUrl }
        : { drawing: <div className="art"><LiveSketch config={config} activeId={null} /></div>, redraw: JSON.stringify([config.theme, config.decor]) };
      case "kids": if (tableRenderUrl) return { imageUrl: tableRenderUrl, redraw: tableRenderUrl };
        return { drawing: <div className="art"><TablePlace table={config.table!} theme={theme} mode="six" /></div>, redraw: JSON.stringify([config.theme, config.table]) };
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
  return (
    <section className="bz-finished" aria-label="Your finished designs" data-testid="finished-designs">
      {/* The lettering fonts (the board's name, the placemats' words). */}
      <link rel="stylesheet" href="/fonts/typography/fonts.css" />
      <div className="head">
        <h2>Your finished designs</h2>
        <p>Each piece of your party as a picture — save any of them as a JPEG.</p>
      </div>
      <div className="grid">
        {pieces.map((p) => <DesignCard key={p.id} piece={p} {...drawingOf(p)} />)}
      </div>
    </section>
  );
}
