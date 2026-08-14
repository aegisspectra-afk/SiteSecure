/** Production web must call a public FastAPI origin. Vercel must never bake localhost. */

export function requireProductionApiUrl(raw: string | undefined, hosted = false): string {
  const url = (raw ?? "").trim().replace(/\/$/, "");
  if (hosted && /localhost|127\.0\.0\.1/i.test(url)) {
    throw new Error("VITE_API_URL must not point at localhost in a hosted production build");
  }
  if (!url) {
    if (hosted) return "";
    throw new Error(
      "VITE_API_URL is required for production web builds (public FastAPI origin, not localhost)",
    );
  }
  return url;
}

export function isHostedBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host !== "localhost" && host !== "127.0.0.1";
}
