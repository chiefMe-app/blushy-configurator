// Vendors the lettering fonts from the official google/fonts repository at a
// pinned commit: each family's upright font files (no italics), OFL.txt and
// METADATA.pb, into assets/fonts/<dir>/, with a SHA-256 for every file in
// assets/fonts/fonts.lock.json.
//
//   node scripts/typography/fetch-fonts.mjs            download (refuses non-OFL)
//   node scripts/typography/fetch-fonts.mjs --verify   check files against the lock
//
// Adding a font = one line in FAMILIES, run this, then the qualify script.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const COMMIT = "e7db6ca603fd4862010383ff17ffd6cc4ffac1c0"; // google/fonts main, 2026-10-23
const FAMILIES = [
  "italianno", "whisper", "windsong", "allison", "hurricane", "qwitchergrypen", "sacramento", "montecarlo",
  "bellefair", "cormorantgaramond", "gildadisplay", "ebgaramond",
  "bodonimoda", "dmserifdisplay", "gloock", "instrumentserif", "playfairdisplay",
  "librecaslontext", "librecaslondisplay", "librebaskerville", "marcellus",
  "fraunces", "youngserif", "birthstonebounce",
  "archivoblack",
];
const ROOT = path.resolve(import.meta.dirname, "../../assets/fonts");
const LOCK = path.join(ROOT, "fonts.lock.json");
const raw = (p) => `https://raw.githubusercontent.com/google/fonts/${COMMIT}/ofl/${p}`;
const sha = (b) => createHash("sha256").update(b).digest("hex");

async function get(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

if (process.argv.includes("--verify")) {
  const lock = JSON.parse(fs.readFileSync(LOCK, "utf8"));
  let bad = 0;
  for (const [file, hash] of Object.entries(lock.files)) {
    const p = path.join(ROOT, file);
    if (!fs.existsSync(p) || sha(fs.readFileSync(p)) !== hash) { console.error("MISMATCH", file); bad++; }
  }
  console.log(`${Object.keys(lock.files).length} files checked, ${bad} mismatches`);
  process.exit(bad ? 1 : 0);
}

const lock = { source: "https://github.com/google/fonts", commit: COMMIT, files: {} };
let bytes = 0;
for (const dir of FAMILIES) {
  const meta = (await get(raw(`${dir}/METADATA.pb`))).toString("utf8");
  const licence = (meta.match(/license: "(\w+)"/) ?? [])[1];
  if (licence !== "OFL") throw new Error(`${dir}: licence ${licence}, not OFL — refusing`);
  const files = [...meta.matchAll(/fonts \{([\s\S]*?)\n\}/g)]
    .map((m) => ({ file: (m[1].match(/filename: "([^"]+)"/) ?? [])[1], style: (m[1].match(/style: "(\w+)"/) ?? [])[1] }))
    .filter((f) => f.file && f.style !== "italic")
    .map((f) => f.file);
  const unique = [...new Set(files)];
  fs.mkdirSync(path.join(ROOT, dir), { recursive: true });
  const save = (name, buf) => { fs.writeFileSync(path.join(ROOT, dir, name), buf); lock.files[`${dir}/${name}`] = sha(buf); bytes += buf.length; };
  save("METADATA.pb", Buffer.from(meta));
  save("OFL.txt", await get(raw(`${dir}/OFL.txt`)));
  for (const f of unique) save(f, await get(raw(`${dir}/${encodeURIComponent(f).replace(/%2C/g, ",")}`)));
  console.log(dir.padEnd(20), unique.join(", "));
}
fs.writeFileSync(LOCK, JSON.stringify(lock, null, 2) + "\n");
console.log(`\n${Object.keys(lock.files).length} files, ${(bytes / 1048576).toFixed(1)} MB -> assets/fonts/`);
