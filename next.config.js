/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "fal.media" },
      { protocol: "https", hostname: "**.fal.media" },
      { protocol: "https", hostname: "v3.fal.media" },
    ],
  },
  experimental: {
    // The lettering engine (lib/typography) runs HarfBuzz from node_modules:
    // it finds its .wasm next to itself, which bundling would break. The
    // typography API and (since 2026-10-26, for board lettering) the render
    // routes use it, with the vendored fonts.
    serverComponentsExternalPackages: ["harfbuzzjs"],
    outputFileTracingIncludes: {
      "/api/typography/layout": ["./assets/fonts/**/*", "./node_modules/harfbuzzjs/dist/*.wasm"],
      "/api/generate-controlled-render": ["./assets/fonts/**/*", "./node_modules/harfbuzzjs/dist/*.wasm"],
      "/api/generate-structure-render-test": ["./assets/fonts/**/*", "./node_modules/harfbuzzjs/dist/*.wasm"],
    },
  },
};

module.exports = nextConfig;
