const KEY = "ssp_unit_session_v1";

export type StoredUnitSession = {
  token: string;
  expiresAt: string;
  workspaceId: string;
  siteId: string;
  siteName: string;
};

export function loadUnitSession(): StoredUnitSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredUnitSession;
    if (!parsed?.token || !parsed.expiresAt || !parsed.siteId) return null;
    if (Date.parse(parsed.expiresAt) <= Date.now()) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveUnitSession(session: StoredUnitSession): void {
  sessionStorage.setItem(KEY, JSON.stringify(session));
}

export function clearUnitSession(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function hasUnitSession(): boolean {
  return Boolean(loadUnitSession());
}
