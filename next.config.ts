import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Runtime data is created on the mounted volume or external stores.
  // Never package local users, magic links, charts, or shares into an image.
  outputFileTracingExcludes: {
    "/*": ["data/**/*"],
  },
};

export default nextConfig;
