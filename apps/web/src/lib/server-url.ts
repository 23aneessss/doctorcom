const LOCAL_FALLBACK_SERVER_URL = "http://localhost:3000";

function normalizeBaseUrl(url: string) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export function getServerBaseUrl() {
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
