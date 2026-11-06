// A part's own render (2026-11-03, the owner: "generate render yapmadan finalize render butonuna basılamasın …
// top view render alsın sadece … burda da rendera zorlasın"): the kids' table's top view (/api/table-render)
// and the welcome board (/api/welcome-render). Like the backdrop's, a render needs an account and is kept in
// the customer's folder when there is a database; it is current while the part is unchanged (`key`), and
// finalizing the part waits for a current one. Both routes stream their answer (lib/ndjson.ts): the picture's
// line, then a line saying it is done.
import { useEffect, useRef, useState } from "react";
import { accountToken, loadClient } from "@/components/account/useAccount";
import { RENDER_BUCKET } from "@/lib/renderKey";
import { readNdjson } from "@/lib/ndjson";

/** A render kept in the customer's folder of the renders bucket, and the part (its key) it shows. */
export interface KeptRender { key: string; path: string }

export interface PieceRender {
  /** The picture of the part as it is now, if one has been made. */
  url: string | null;
  ready: boolean;
  /** A render of an earlier version of the part. */
  stale: boolean;
  loading: boolean;
  error: string | null;
  make: () => Promise<void>;
  /** The keys of the pictures made or kept here (2026-11-03: the cake's close-ups are pictures of their own). */
  keys: string[];
  /** The picture made for a key, if any. */
  urlOf: (key: string) => string | null;
}

const FAILED = "The render didn't come out — please try again.";

export function usePieceRender({ endpoint, partKey, kept, body, onKept, onSignInNeeded }: {
  endpoint: string;
  /** What the part looks like now ("" while there is no part). */
  partKey: string;
  kept?: KeptRender;
  /** The request's body, read as the render starts. */
  body: () => unknown;
  /** The render was kept with the customer's account. */
  onKept?: (k: KeptRender) => void;
  onSignInNeeded: () => void;
}): PieceRender {
  // Every picture made or kept, by its key: a part with several (the cake's close-ups) keeps each.
  const [shown, setShown] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const latest = useRef({ body, onKept, onSignInNeeded, partKey });
  latest.current = { body, onKept, onSignInNeeded, partKey };

  // A kept render (back on the page, or the design reopened): a new signed link.
  useEffect(() => {
    if (!kept || shown[kept.key]) return;
    let cancelled = false;
    void (async () => {
      const sb = await loadClient();
      const { data } = (await sb?.storage.from(RENDER_BUCKET).createSignedUrls([kept.path], 3600).catch(() => null)) ?? { data: null };
      const url = data?.[0]?.signedUrl;
      if (!cancelled && url) setShown((m) => ({ ...m, [kept.key]: url }));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kept?.key, kept?.path]);

  async function make() {
    if (busy.current || !latest.current.partKey) return;
    busy.current = true;
    try {
      const token = await accountToken();
      if (token === null) { latest.current.onSignInNeeded(); return; }
      const key = latest.current.partKey;
      setError(null);
      // The body first: the welcome board's is a picture of its preview, taken before the wait covers it.
      const payload = await latest.current.body();
      setLoading(true);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      if (!res.ok || !res.body || !(res.headers.get("content-type") ?? "").includes("ndjson")) {
        const data = await res.json().catch(() => null);
        if (data?.signin) { latest.current.onSignInNeeded(); return; }
        throw new Error(data?.error ?? FAILED);
      }
      let end: { done?: boolean; error?: string; render?: KeptRender } | null = null;
      await readNdjson(res.body, (line) => {
        const l = line as { url?: string; done?: boolean; error?: string; render?: KeptRender };
        if (typeof l.url === "string") setShown((m) => ({ ...m, [key]: l.url! }));
        // A picture made on the way, for another key (the party's first photo, 2026-11-06): kept too, for next time.
        const also = (line as { also?: { key?: unknown; url?: unknown } }).also;
        if (also && typeof also.key === "string" && typeof also.url === "string") setShown((m) => ({ ...m, [also.key as string]: also.url as string }));
        else if (l.done || l.error) end = l;
      });
      const result = end as { done?: boolean; error?: string; render?: KeptRender } | null; // set inside the callback
      if (!result?.done) throw new Error(result?.error ?? FAILED);
      if (result.render) latest.current.onKept?.(result.render);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  const ready = !!partKey && !!shown[partKey];
  const keys = Object.keys(shown);
  return { url: ready ? shown[partKey] : null, ready, stale: keys.length > 0 && !ready, loading, error, make, keys, urlOf: (k: string) => shown[k] ?? null };
}
