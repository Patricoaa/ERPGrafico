import type { NextConfig } from "next";
import packageJson from "./package.json";

// Git hash: Vercel inyecta VERCEL_GIT_COMMIT_SHA; en Docker se puede pasar GIT_HASH como ARG/ENV
const gitHash =
  (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_HASH ?? "unknown").slice(0, 7);

// Hostname del backend para next/image — se configura por entorno
const backendHostname =
  process.env.NEXT_PUBLIC_API_URL
    ? new URL(process.env.NEXT_PUBLIC_API_URL).hostname
    : "erpgrafico-production.up.railway.app";

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
        hostname: backendHostname,
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

