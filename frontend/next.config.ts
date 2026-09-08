import type { NextConfig } from "next";

// Removed GitHub Pages basePath logic for Hetzner deployment
const basePath = "";

const nextConfig: NextConfig = {
  output: "standalone",
  trailingSlash: true,
  allowedDevOrigins: ['192.168.128.217'],
  basePath: undefined,
  assetPrefix: undefined,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

