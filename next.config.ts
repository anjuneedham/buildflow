import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "50mb" },
    // proxy.ts runs on every request and buffers the body, 10 MB by default; anything past that is cut off and a
    // photo upload dies with "Unexpected end of form". Match the server action limit above.
    proxyClientMaxBodySize: "50mb",
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
          // HTTPS only, for a year. Ignored over http (local development).
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
