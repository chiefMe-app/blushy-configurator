import path from "path";
import { defineConfig } from "@playwright/test";

// The tests start their own dev server on port 3100 with every external key
// set to empty. Next.js does not let .env.local override a variable that is
// already set (even to ""), so this server cannot reach fal, Replicate or
// Supabase: orders are only logged and renders fail fast. tests/e2e/00-safety
// proves it before anything else runs.
//
// Never run this while another `next dev` or `next build` uses this folder —
// they share .next and corrupt each other.
const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results/e2e",
  snapshotPathTemplate: "tests/e2e/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 15_000, toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: "disabled", caret: "hide" } },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: "chromium",
    // The installed Microsoft Edge (Chromium). Playwright's own Chromium
    // download stalls on this machine; Edge needs no download. An Edge update
    // can shift screenshots slightly — re-baseline only after checking the diff.
    channel: "msedge",
    timezoneId: "UTC",
    locale: "en-US",
    contextOptions: { reducedMotion: "reduce" },
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1905, height: 880 } } },
    { name: "mobile", use: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/builder`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      FAL_KEY: "",
      REPLICATE_API_TOKEN: "",
      // The server has no database (orders are only logged; 00-safety). The
      // browser gets a stand-in Supabase at supabase.test, answered inside the
      // test browser by guard.ts — nothing leaves the machine.
      SUPABASE_URL: "",
      SUPABASE_ANON_KEY: "",
      NEXT_PUBLIC_SUPABASE_URL: "http://supabase.test",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "",
      NEXT_TELEMETRY_DISABLED: "1",
      // No internet needed for screenshots: next/font/google reads the captured
      // stylesheets and font files (tests/fixtures/google-fonts) instead of
      // fetching them, and any fetch it still tried would hit a dead proxy
      // and fail loudly rather than fall back to other fonts.
      NEXT_FONT_GOOGLE_MOCKED_RESPONSES: path.resolve(__dirname, "tests/fixtures/google-fonts/mock.cjs"),
      HTTPS_PROXY: "http://127.0.0.1:9",
      HTTP_PROXY: "http://127.0.0.1:9",
      NO_PROXY: "localhost,127.0.0.1",
    },
  },
});
