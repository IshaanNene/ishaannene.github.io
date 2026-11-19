import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export for GitHub Pages (username.github.io → served from the domain root).
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  transpilePackages: ["three"],
};

export default nextConfig;
