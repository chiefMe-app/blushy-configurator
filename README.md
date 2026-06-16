# Blushy — Backdrop Configurator

A mobile-first party-backdrop configurator. Users pick a theme, shape, balloon
garland, colors, and extras, watch a live preview, generate a photorealistic
render with fal.ai, and submit an order saved to Supabase.

## Stack

- **Next.js 14** (App Router, TypeScript)
- **Tailwind CSS** (runtime accent color driven by the selected theme)
- **Supabase** — `orders` table
- **fal.ai** — `flux-pro/v1.1` image generation
- **Vercel**-ready

## Project structure

```
app/
  page.tsx                  → redirects to /configure
  configure/page.tsx        → main configurator UI (6-step flow + summary)
  api/generate/route.ts     → fal.ai image generation (server-side, uses FAL_KEY)
  api/orders/route.ts       → Supabase order save (recomputes price server-side)
components/
  ThemeSelector, ShapeSelector, GarlandSelector,
  ExtrasSelector, PreviewCanvas, PriceBar
lib/
  config.ts                 → options, pricing, prompt fragments (single source of truth)
  supabase.ts               → Supabase client
supabase/schema.sql         → orders table + RLS policies
```

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy env vars and fill them in:

   ```bash
   cp .env.example .env.local
   ```

   | Variable | Where | Notes |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | client + server | public |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | public |
   | `FAL_KEY` | **server only** | never prefix with `NEXT_PUBLIC_` |

3. Create the database table — paste `supabase/schema.sql` into the Supabase
   SQL editor and run it.

4. Run locally:

   ```bash
   npm run dev
   ```

   Open http://localhost:3000 (redirects to `/configure`).

## How pricing works

All pricing lives in `lib/config.ts` and is **recomputed server-side** in
`/api/orders` — the client total is never trusted. Base price is per-theme
(AED 110–130); shape, garland, and extras add on top.

## fal.ai prompt

`/api/generate` assembles a detailed prompt from the selection, e.g.:

> professional event photography, blush pink and white single tall arch backdrop,
> organic balloon garland cascading down both sides, fresh floral clusters…,
> luxury Dubai villa interior, soft natural light, 4k, photorealistic

The `FAL_KEY` stays server-side; the browser only ever sees the returned image URL.

## Deploy to Vercel

1. Push to GitHub and import the repo in Vercel.
2. Add the three environment variables in **Project → Settings → Environment Variables**.
3. Deploy. `next.config.js` already allow-lists `fal.media` for remote images.
