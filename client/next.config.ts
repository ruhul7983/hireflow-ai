import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Same-origin backend calls keep the session cookies first-party
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL ?? "http://localhost:5000";
    return [{ source: "/api/:path*", destination: `${backendUrl}/:path*` }];
  },
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
