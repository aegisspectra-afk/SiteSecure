/** Field-device credential. Server TTL is the authority; client cache is not authorization. */

const POLL_KEY = "ssp_enroll_poll";
const DEVICE_KEY = "ssp_device_session";

export type StoredDeviceSession = {
  device_token: string;
  expires_at: string;
  site_id: string;
  site_name: string;
};

export function savePollToken(token: string) {
  sessionStorage.setItem(POLL_KEY, token);
}

export function readPollToken(): string | null {
  return sessionStorage.getItem(POLL_KEY);
}

export function clearPollToken() {
  sessionStorage.removeItem(POLL_KEY);
}

export function saveDeviceSession(row: StoredDeviceSession) {
  const raw = JSON.stringify(row);
  sessionStorage.setItem(DEVICE_KEY, raw);
  try {
    localStorage.setItem(DEVICE_KEY, raw);
  } catch {
    /* private mode */
  }
}

export function readDeviceSession(): StoredDeviceSession | null {
  const raw = sessionStorage.getItem(DEVICE_KEY) || localStorage.getItem(DEVICE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredDeviceSession;
    if (!parsed.device_token || !parsed.expires_at) return null;
    if (Date.parse(parsed.expires_at) <= Date.now()) {
      clearDeviceSession();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearDeviceSession() {
  sessionStorage.removeItem(DEVICE_KEY);
  try {
    localStorage.removeItem(DEVICE_KEY);
  } catch {
    /* ignore */
  }
}
