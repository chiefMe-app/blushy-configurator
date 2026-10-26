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
    // it finds its .wasm next to itself, which bundling would break. Only the
    // typography API route uses it.
    serverComponentsExternalPackages: ["harfbuzzjs"],
    outputFileTracingIncludes: {
      "/api/typography/layout": ["./assets/fonts/**/*", "./node_modules/harfbuzzjs/dist/*.wasm"],
    },
  },
};

module.exports = nextConfig;
