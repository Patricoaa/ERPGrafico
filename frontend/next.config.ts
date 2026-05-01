import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "erpgrafico-production.up.railway.app",
      },
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "http",
        hostname: "backend",
      },
    ],
  },
  experimental: {
    // Importa solo los módulos utilizados de estas librerías pesadas
    // → evita que el compilador procese toda la librería en cada build
    optimizePackageImports: ["lucide-react", "date-fns", "recharts", "framer-motion"],
  },
  transpilePackages: ["react-day-picker"],
  devIndicators: {
  },
};

export default nextConfig;

