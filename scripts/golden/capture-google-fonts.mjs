// Captures the Google Fonts responses next/font/google needs, so the e2e test
// server runs without internet (NEXT_FONT_GOOGLE_MOCKED_RESPONSES, a hook
// Next.js provides for exactly this). Downloads each stylesheet with the user
// agent Next uses and every font file it references into
// tests/fixtures/google-fonts/; tests/fixtures/google-fonts/mock.cjs serves
// them from disk. The app itself is unchanged and still fetches from Google.
//
//   node scripts/golden/capture-google-fonts.mjs [extra css2 URL ...]
//
// If the app adds a Google font, the test server stops with "Missing mocked
// response for URL: …" — add that URL here (or pass it) and re-run.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36";
const URLS = [
  "https://fonts.googleapis.com/css2?family=Kalam:wght@300;400;700&display=swap",
  "https://fonts.googleapis.com/css2?family=Caveat:wght@500;600;700&display=swap",
  "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap",
  "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400&display=swap",
  "https://fonts.googleapis.com/css2?family=Archivo+Black:wght@400&display=swap",
  ...process.argv.slice(2),
];
const OUT = path.resolve(import.meta.dirname, "../../tests/fixtures/google-fonts");
fs.mkdirSync(path.join(OUT, "files"), { recursive: true });

const responses = {};
let files = 0, bytes = 0;
for (const url of URLS) {
  const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  let css = await res.text();
  for (const fontUrl of [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]))]) {
    const buf = Buffer.from(await (await fetch(fontUrl, { signal: AbortSignal.timeout(30_000) })).arrayBuffer());
    const name = `${createHash("sha256").update(buf).digest("hex").slice(0, 16)}${path.extname(new URL(fontUrl).pathname) || ".woff2"}`;
    fs.writeFileSync(path.join(OUT, "files", name), buf);
    css = css.split(fontUrl).join(`{{DIR}}/${name}`);
    files++; bytes += buf.length;
  }
  responses[url] = css;
}
fs.writeFileSync(path.join(OUT, "responses.json"), JSON.stringify(responses, null, 2) + "\n");
console.log(`${URLS.length} stylesheets, ${files} font files, ${(bytes / 1024).toFixed(0)} KB -> tests/fixtures/google-fonts/`);
