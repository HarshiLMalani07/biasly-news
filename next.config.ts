import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,

  images: {
    remotePatterns: [
      // The design-system sheet's demo photography.
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      // Scraped article images come from whichever CDN the publisher uses
      // (i.guim.co.uk, ichef.bbci.co.uk, media.npr.org, ...), and the set
      // cannot be enumerated up front. The cost of the wildcard, stated
      // plainly: anyone can route an arbitrary HTTPS image through this app's
      // image optimizer. The alternative, unoptimized article images, loses
      // resizing on every card.
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
