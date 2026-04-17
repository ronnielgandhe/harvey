import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `turbopack.root` was triggering a Vercel build warning because it
  // pointed to a local path that conflicted with the platform's
  // `outputFileTracingRoot`. Vercel auto-detects the root correctly
  // without it, and the setting is dev-only anyway.
  devIndicators: false,
};

export default nextConfig;
