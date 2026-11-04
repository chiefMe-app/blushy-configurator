// The Package step's pictures (2026-11-04): hand-painted illustrations made once with fal-ai/flux-2 (768×768) in the
// style of references the owner sent — never her references themselves — as webp:
//   we-do-it: the delivery bicycle ("delivery yapıyoruz vibe'ı"), diy: crafting (cropped above the glue stick's
//   made-up label), helium-bouquet and cake: the DIY "from us" rows and the helium and cake intros.
// The paper white is made transparent.
//   npx tsx scripts/packages/build.mts
import sharp from "sharp";
const SRC = "scripts/packages/sources";
const OUT = "public/design/packages";
const jobs: { name: string; crop?: { left: number; top: number; width: number; height: number } }[] = [
  { name: "we-do-it" }, { name: "diy", crop: { left: 20, top: 0, width: 728, height: 450 } },
  { name: "helium-bouquet" }, { name: "cake" },
  // The Venue and Review headings: a bear skating to the party with the gifts and the cake, a zebra in party glasses.
  { name: "venue-bear" }, { name: "review-zebra" },
];
for (const j of jobs) {
  let img = sharp(`${SRC}/${j.name}.jpg`);
  if (j.crop) img = img.extract(j.crop);
  // The paper white made see-through (fading in from near-white), so the pictures sit on any background.
  const { data, info } = await img.resize({ width: 420 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const lo = Math.min(data[i], data[i + 1], data[i + 2]);
    if (lo > 222) data[i + 3] = Math.round(255 * Math.max(0, Math.min(1, (247 - lo) / 25)));
  }
  await sharp(data, { raw: info }).webp({ quality: 84, alphaQuality: 90 }).toFile(`${OUT}/${j.name}.webp`);
  console.log("ok", j.name);
}
