import { ApiClientError } from "@site-secure/api-client";

/** Site Secure composite features — mirrors API platform_products.SITE_SECURE_FEATURES. */
const SITE_SECURE_FEATURES = new Set([
  "core",
  "crm",
  "sales",
  "catalog",
  "quotes",
  "projects",
  "service",
  "settings",
]);

export type PlatformProductId = "site_secure" | "ssp" | "fleet" | "workforce";

export function isFeatureNotIncludedError(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 403 && error.code === "FEATURE_NOT_INCLUDED";
}

/** Map current SPA path to a Platform product card, if any. */
export function productIdForPath(pathname: string): PlatformProductId | null {
  if (pathname === "/platform" || pathname.startsWith("/platform/")) return null;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;
  if (pathname.startsWith("/app/ssp")) return "ssp";
  if (pathname.startsWith("/app/fleet")) return "fleet";
  if (pathname.startsWith("/app/workforce")) return "workforce";
  if (pathname === "/app" || pathname.startsWith("/app/")) return "site_secure";
  return null;
}

export function isProductAvailable(productId: PlatformProductId, features: string[] | undefined): boolean {
  const set = new Set(features ?? []);
  if (productId === "ssp") return set.has("ssp");
  if (productId === "fleet") return set.has("fleet");
  if (productId === "workforce") return set.has("workforce");
  for (const key of SITE_SECURE_FEATURES) {
    if (set.has(key)) return true;
  }
  return false;
}

/**
 * Whether the user should leave the current product shell for Platform Home
 * after a FEATURE_NOT_INCLUDED response and a fresh session.
 */
export function shouldReturnToPlatformHome(pathname: string, features: string[] | undefined): boolean {
  const productId = productIdForPath(pathname);
  if (!productId) return false;
  return !isProductAvailable(productId, features);
}
