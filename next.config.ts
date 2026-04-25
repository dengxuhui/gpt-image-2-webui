import type { NextConfig } from "next";

const assetPrefix = process.env.NEXT_ASSET_PREFIX;

const nextConfig: NextConfig = {
  output: "standalone",
  assetPrefix: assetPrefix || undefined,
};

export default nextConfig;
