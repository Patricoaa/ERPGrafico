/**
 * ERPGrafico Version Utility
 * Handles display and comparison of frontend/backend versions.
 */

export const getFrontendVersion = () => {
  return process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0";
};

export const getGitHash = () => {
  return process.env.NEXT_PUBLIC_GIT_HASH || "unknown";
};

export const getBuildDate = () => {
  return process.env.NEXT_PUBLIC_BUILD_DATE || new Date().toISOString();
};

export const formatFullVersion = () => {
  const version = getFrontendVersion();
  const hash = getGitHash();
  return `v${version} (${hash})`;
};

export const isProduction = () => {
  return process.env.NODE_ENV === "production";
};
