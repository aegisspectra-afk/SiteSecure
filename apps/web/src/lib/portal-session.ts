const STORAGE_KEY = "ss_portal_bearer";

export function getPortalToken(): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw?.trim() || null;
}

export function setPortalToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (!token) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, token.trim());
}

export function clearPortalToken(): void {
  setPortalToken(null);
}