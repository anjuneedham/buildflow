import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "50mb" },
  },
  // firebase-admin uses Node APIs; keep it out of the bundler.
  serverExternalPackages: ["firebase-admin", "sharp"],
  // V2 renamed routes (UX_ARCHITECTURE_V2.md §2.1); keep old links working.
  async redirects() {
    return [
      { source: "/app/projects", destination: "/app/jobs", permanent: true },
      { source: "/app/projects/:path*", destination: "/app/jobs/:path*", permanent: true },
      { source: "/app/notifications", destination: "/app/inbox", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
