// next/font/google mock for the e2e test server (NEXT_FONT_GOOGLE_MOCKED_RESPONSES).
// Maps each Google Fonts stylesheet URL to the captured CSS, with font URLs
// pointing at the captured files on disk. Next.js reads a font URL from disk
// when it starts with "/", so on Windows the drive letter is dropped (paths
// then resolve on the current drive). Re-capture with
// scripts/golden/capture-google-fonts.mjs.
const path = require("path");
const responses = require("./responses.json");

const dir = path.join(__dirname, "files").replace(/\\/g, "/").replace(/^[A-Za-z]:/, "");
module.exports = Object.fromEntries(Object.entries(responses).map(([url, css]) => [url, css.split("{{DIR}}").join(dir)]));
