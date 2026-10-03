import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Loaded at runtime in Node, not bundled (uses puppeteer + native modules).
  serverExternalPackages: ["whatsapp-web.js", "puppeteer", "puppeteer-core"],
};

export default nextConfig;
