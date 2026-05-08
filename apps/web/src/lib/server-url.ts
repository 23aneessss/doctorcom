const LOCAL_FALLBACK_SERVER_URL = "http://localhost:3000";

function normalizeBaseUrl(url: string) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function getRuntimeConfigServerUrl() {
  if (typeof window === "undefined") {
    return null;
  }

  const configUrl = window.__APP_CONFIG__?.serverUrl;
  return typeof configUrl === "string" && configUrl.trim().length > 0 ? configUrl : null;
}

export function getServerBaseUrl() {
  const runtimeConfigUrl = getRuntimeConfigServerUrl();
  if (runtimeConfigUrl) {
    try {
      return normalizeBaseUrl(new URL(runtimeConfigUrl).toString());
    } catch {
      // Ignore invalid runtime config values and keep falling back.
    }
  }

  if (import.meta.env.PROD && typeof window !== "undefined" && window.location?.origin) {
    return normalizeBaseUrl(window.location.origin);
  }

  const envUrl = import.meta.env.VITE_SERVER_URL;

  if (typeof envUrl === "string" && envUrl.trim().length > 0) {
    try {
      return normalizeBaseUrl(new URL(envUrl).toString());
    } catch {
      // Ignore invalid env values and fallback to a safe runtime default.
    }
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return normalizeBaseUrl(window.location.origin);
  }

  return LOCAL_FALLBACK_SERVER_URL;
}
