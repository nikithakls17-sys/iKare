import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Loaded at runtime in Node, not bundled (uses puppeteer + native modules).
  serverExternalPackages: ["whatsapp-web.js", "puppeteer", "puppeteer-core"],
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
