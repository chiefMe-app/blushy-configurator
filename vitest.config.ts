import { defineConfig } from "vitest/config";
import path from "path";

// Tests never reach a real service: no Supabase (orders log instead of
// writing), and a FAL_KEY that is only a placeholder — the render route needs
// a non-empty key to run at all, but tests only use its no-fal debug path, and
// a stray real call would be rejected by fal rather than billed.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  // JSX as Next.js compiles it (automatic runtime), for tests that render a page.
  esbuild: { jsx: "automatic" },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/golden/**/*.test.ts"],
    environment: "node",
    testTimeout: 60_000,
    env: {
      TZ: "UTC",
      FAL_KEY: "test-placeholder-not-a-key",
      REPLICATE_API_TOKEN: "",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    },
  },
});
