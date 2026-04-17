import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  // Hide the Next.js dev indicator (the "N" badge in the bottom-left).
  devIndicators: false,
};

export default nextConfig;
