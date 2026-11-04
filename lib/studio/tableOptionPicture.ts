// An option picture of the kids' table (/design/table/…) as a small JPEG data URI, for a render: the kids' table's
// (app/api/table-render) and the party's (app/api/party-render). Server only.
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/**
 * An option picture (/design/table/…) as a small JPEG data URI: from the
 * site's own files, or — where those are not bundled with the function — from
 * the site itself.
 */
export async function optionPicture(photo: string, origin: string, size = 768): Promise<string> {
  if (!/^\/design\/table\/(?:[\w-]+\/){0,2}[\w-]+\.(webp|png|jpe?g)$/.test(photo)) throw new Error(`not an option picture: ${photo}`);
  const bytes = await readFile(path.join(process.cwd(), "public", photo)).catch(async () => {
    const res = await fetch(new URL(photo, origin), { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`option picture ${photo}: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  });
  const jpeg = await sharp(bytes).resize({ width: size, height: size, fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 88 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

