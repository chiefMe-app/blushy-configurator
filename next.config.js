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
      // 2026-10-27 (Phase 1.3): the Design Pack — lettering, the PDF's DM Sans,
      // the label font, and the sample pack's example picture.
      "/api/packs/sample": ["./assets/fonts/**/*", "./node_modules/harfbuzzjs/dist/*.wasm", "./public/design/theme-previews/frozen/single-round.webp"],
    },
  },
};

module.exports = nextConfig;
