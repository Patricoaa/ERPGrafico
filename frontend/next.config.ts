import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["react-day-picker"],
  devIndicators: {
    position: 'bottom-left',
  },
};

export default nextConfig;

