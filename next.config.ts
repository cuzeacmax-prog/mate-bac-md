import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* CSP headers intentionally omitted at v0.1 — add after all CDN integrations are confirmed working */
  async headers() {
    return [
      {
        // Allow tikzjax assets (JS, fonts) to load from sandboxed iframes with opaque origin
        source: "/tikzjax/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
