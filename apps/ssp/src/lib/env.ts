/** Public Vite env only — never read service-role or other server secrets here. */

export function apiBaseUrl(): string {
  return (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
}

export function platformHomeUrl(): string {
  return (import.meta.env.VITE_PLATFORM_HOME_URL || "http://localhost:5173/platform").replace(/\/$/, "");
}

/** Origin that still hosts public tablet routes (`/ssp/:token`) until B4.3. */
export function webOrigin(): string {
  return (import.meta.env.VITE_WEB_ORIGIN || "http://localhost:5173").replace(/\/$/, "");
}

export function hasPublicSupabaseConfig(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

export function hasApiConfig(): boolean {
  return Boolean(apiBaseUrl()) || import.meta.env.DEV;
}

export function publicAssignmentUrl(publicPath: string): string {
  const path = publicPath.startsWith("/") ? publicPath : `/${publicPath}`;
  return `${webOrigin()}${path}`;
}
