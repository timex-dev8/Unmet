import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // The app now lives under /app (the studio); old links keep working.
  async redirects() {
    return [
      { source: "/feed", destination: "/app/feed", permanent: false },
      { source: "/research", destination: "/app/research", permanent: false },
      { source: "/saved", destination: "/app/board", permanent: false },
      { source: "/search", destination: "/app/search", permanent: false },
      { source: "/idea/:slug", destination: "/app/idea/:slug", permanent: false },
    ];
  },
};

export default nextConfig;
