// The theme art of scripts/themes/theme-art.mjs, cut out of its green and put
// where the builder looks for it (2026-11-01, Unicorn first):
//   standee-<name>  → public/cutouts/<theme>/<theme>-0N.png (in STANDEES order)
//   print           → public/design/sketch/banner-print-<theme>.webp, and
//                     lib/bannerThemePrints/<theme>.ts for the render's guide
//   table-cutouts   → public/design/table/top/centrepiece-cutouts-<theme>.webp and
//                     public/design/table/centrepiece/<theme>/cutouts.webp (its card)
//   graphic-0N      → public/design/graphics/<theme>-0N.webp (a theme graphic, its preset's assetId; 2026-11-03)
// Run: npx tsx scripts/themes/theme-art-prepare.ts <dir of the green renders> <theme>
import sharp from "sharp";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { cutOut, type Raw } from "../table/cutout";

const [RAW, theme] = process.argv.slice(2);
const STANDEES: Record<string, string[]> = { unicorn: ["rearing", "rainbow", "baby"] };
const raw = (r: Raw) => sharp(r.data, { raw: { width: r.width, height: r.height, channels: 4 } });
const src = (n: string) => path.join(RAW, `${theme}-${n}.png`);

(async () => {
  mkdirSync(`public/cutouts/${theme}`, { recursive: true });
  const names = STANDEES[theme] ?? [];
  for (let i = 0; i < names.length; i++) {
    const n = names[i];
    if (!existsSync(src(`standee-${n}`))) continue;
    const t = await raw(await cutOut(src(`standee-${n}`))).png().toBuffer();
    const out = `public/cutouts/${theme}/${theme}-0${i + 1}.png`;
    await sharp(t).trim({ threshold: 0 }).resize({ height: 1200, withoutEnlargement: true }).png({ compressionLevel: 9 }).toFile(out);
    console.log(out);
  }
  if (existsSync(src("print"))) {
    await sharp(src("print")).resize(1024, 1024).webp({ quality: 86 }).toFile(`public/design/sketch/banner-print-${theme}.webp`);
    // The guide carries the print as a data URI (it is drawn on the server, where Vercel has no public/ to read).
    const jpg = await sharp(src("print")).resize(800, 800).jpeg({ quality: 84 }).toBuffer();
    mkdirSync("lib/bannerThemePrints", { recursive: true });
    writeFileSync(`lib/bannerThemePrints/${theme}.ts`, `// The ${theme} banner print (scripts/themes/theme-art-prepare.ts). 800px square JPEG.\nexport default "data:image/jpeg;base64,${jpg.toString("base64")}";\n`);
    console.log("print", theme);
  }
  if (existsSync(src("table-cutouts"))) {
    const name = `centrepiece-cutouts-${theme}`;
    const t = await raw(await cutOut(src("table-cutouts"))).png().toBuffer();
    const buf = await sharp(await sharp(t).trim({ threshold: 0 }).png().toBuffer()).resize({ width: 720, height: 720, fit: "inside", withoutEnlargement: true }).webp({ quality: 88, alphaQuality: 100 }).toBuffer();
    writeFileSync(`public/design/table/top/${name}.webp`, buf);
    // …and the option card's picture (lib/studio/tableCatalog.ts tablePhoto: a themed option's art).
    mkdirSync(`public/design/table/centrepiece/${theme}`, { recursive: true });
    await sharp(buf).resize({ width: 480 }).webp({ quality: 88, alphaQuality: 100 }).toFile(`public/design/table/centrepiece/${theme}/cutouts.webp`);
    const MANIFEST = "lib/studio/tableTopPieces.json";
    const m = JSON.parse(readFileSync(MANIFEST, "utf8")), meta = await sharp(buf).metadata();
    m[name] = { ...m[name], w: meta.width!, h: meta.height! };
    writeFileSync(MANIFEST, JSON.stringify(m, null, 1) + "\n");
    console.log(name, meta.width, meta.height);
  }
  for (let n = 1; n <= 3; n++) {
    if (!existsSync(src(`graphic-0${n}`))) continue;
    mkdirSync("public/design/graphics", { recursive: true });
    const t = await raw(await cutOut(src(`graphic-0${n}`))).png().toBuffer();
    const out = `public/design/graphics/${theme}-0${n}.webp`;
    await sharp(await sharp(t).trim({ threshold: 0 }).png().toBuffer()).resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true }).webp({ quality: 88, alphaQuality: 100 }).toFile(out);
    console.log(out);
  }
})();
