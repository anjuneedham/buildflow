import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BuildFlow",
    short_name: "BuildFlow",
    description: "Run your construction business. Showcase your work. Win more jobs.",
    start_url: "/app",
    display: "standalone",
    background_color: "#f7f6f3",
    theme_color: "#1c2127",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
