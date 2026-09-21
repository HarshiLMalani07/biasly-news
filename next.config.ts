import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Demo article photography only. Keep this scoped to explicit hosts - the
    // scraping pipeline will decide its own image host policy separately.
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
