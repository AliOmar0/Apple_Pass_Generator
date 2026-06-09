const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, "");
const isStaticHost = import.meta.env.VITE_STATIC_HOST === "true";

export const hasConfiguredApi = Boolean(configuredBaseUrl) || !isStaticHost;

export function apiUrl(pathname) {
  if (configuredBaseUrl) return `${configuredBaseUrl}${pathname}`;
  return isStaticHost ? null : pathname;
}
