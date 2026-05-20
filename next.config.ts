import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // TikZJax CDN + WASM
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://tikzjax.com",
              // GeoGebra Apps deploy script
              "script-src-elem 'self' 'unsafe-inline' https://tikzjax.com https://www.geogebra.org",
              // GeoGebra iframe + assets
              "frame-src https://www.geogebra.org",
              "connect-src 'self' https://tikzjax.com https://www.geogebra.org https://*.supabase.co wss://*.supabase.co",
              "img-src 'self' data: blob: https://www.geogebra.org",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' data:",
              "worker-src blob:",
              // Three.js needs WebAssembly
              "wasm-src 'self' blob: https://tikzjax.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
