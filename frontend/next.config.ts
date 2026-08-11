import type { NextConfig } from "next";

// GitHub Pages serves this project site under the repo name.
// Apply the prefix only for production builds so local `next dev`
// keeps working at the root ("/") instead of 404-ing.
const basePath =
  process.env.NODE_ENV === "production" ? "/inventory-management" : "";

const nextConfig: NextConfig = {
  output: "standalone",
  trailingSlash: true,
  allowedDevOrigins: ['192.168.128.217'],
  basePath,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

