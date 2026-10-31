import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // The app now lives under /app (the studio); old links keep working.
  async redirects() {
    return [
      { source: "/feed", destination: "/app/feed", permanent: true },
      { source: "/research", destination: "/app/research", permanent: true },
      { source: "/saved", destination: "/app/board", permanent: true },
      { source: "/search", destination: "/app/search", permanent: true },
      { source: "/idea/:slug", destination: "/app/idea/:slug", permanent: true },
    ];
  },
};

export default nextConfig;
