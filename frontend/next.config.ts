import type { NextConfig } from "next";
import { execSync } from "child_process";
import packageJson from "./package.json";

// Get current git hash
let gitHash = "unknown";
try {
  gitHash = execSync("git rev-parse --short HEAD").toString().trim();
} catch (e) {
  console.warn("Could not get git hash", e);
}

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["erp.servidor.click"],
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
    NEXT_PUBLIC_GIT_HASH: gitHash,
    NEXT_PUBLIC_BUILD_DATE: new Date().toISOString(),
  },
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

