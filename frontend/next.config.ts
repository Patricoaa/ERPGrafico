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
  // standalone solo para Docker/self-hosted — Vercel gestiona el output por su cuenta
  output: process.env.VERCEL ? undefined : "standalone",
  allowedDevOrigins: ["192.168.1.93", "192.168.1.195", "localhost", "127.0.0.1"],
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
  },
  transpilePackages: ["react-day-picker", "@nivo/core", "@nivo/bar", "@nivo/pie", "@nivo/line"],
  devIndicators: {
  },
};

// Sentry: solo se aplica si SENTRY_DSN + SENTRY_ORG + SENTRY_PROJECT están definidos.
// Sin esas vars (caso por defecto) el wrap es no-op y no requiere la dependencia.
async function applySentry(config: NextConfig): Promise<NextConfig> {
  if (
    process.env.NODE_ENV === "development" ||
    !process.env.SENTRY_DSN ||
    !process.env.SENTRY_ORG ||
    !process.env.SENTRY_PROJECT
  ) {
    return config;
  }
  try {
    const { withSentryConfig } = await import("@sentry/nextjs");
    return withSentryConfig(config, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: true,
      widenClientFileUpload: true,
      disableLogger: true,
    });
  } catch {
    return config;
  }
}

export default applySentry(nextConfig);

