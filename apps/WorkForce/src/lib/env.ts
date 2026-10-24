/** Public Vite env only — never read service-role or other server secrets here. */

import { resolveForgotPasswordUrl, resolvePlatformHomeUrl } from "./public-urls";

export function apiBaseUrl(): string {
  return (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
}

export function platformHomeUrl(): string {
  return resolvePlatformHomeUrl(import.meta.env.VITE_PLATFORM_HOME_URL, import.meta.env.DEV);
}

export function forgotPasswordUrl(): string {
  return resolveForgotPasswordUrl(platformHomeUrl());
}

export function hasPublicSupabaseConfig(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

export function hasApiConfig(): boolean {
  return Boolean(apiBaseUrl()) || import.meta.env.DEV;
}

export function openConfiguredUrl(url: string): void {
  if (!url) return;
  window.location.assign(url);
}
