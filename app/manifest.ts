import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "iKare — show up for the people you love",
    short_name: "iKare",
    description: "Never miss the moments that matter to the people you love.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f3f1e7",
    theme_color: "#f3f1e7",
    categories: ["lifestyle", "social", "productivity"],
    icons: [
      { src: "/icons/icon-any-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-any-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Today", url: "/", icons: [{ src: "/icons/icon-any-192.png", sizes: "192x192" }] },
      { name: "Add a moment", url: "/add", icons: [{ src: "/icons/icon-any-192.png", sizes: "192x192" }] },
    ],
  };
}
