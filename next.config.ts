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
              // 'wasm-unsafe-eval' is required for TikZJax WebAssembly compilation.
              // 'unsafe-eval' kept for broader browser compat (older CSP Level 2).
              // script-src-elem removed — let script-src govern all script elements.
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://tikzjax.com https://www.geogebra.org",
              // GeoGebra iframe
              "frame-src https://www.geogebra.org",
              // TikZJax fetches WASM + TeX format files from its CDN
              "connect-src 'self' https://tikzjax.com https://*.tikzjax.com https://www.geogebra.org https://*.supabase.co wss://*.supabase.co",
              "img-src 'self' data: blob: https://www.geogebra.org",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' data:",
              // Three.js + TikZJax WASM workers
              "worker-src blob: 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
