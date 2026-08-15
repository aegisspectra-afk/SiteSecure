const KEY = "ss.remember-device";

export function getRememberDevice(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}

export function setRememberDevice(remember: boolean): void {
  try {
    window.localStorage.setItem(KEY, remember ? "1" : "0");
  } catch {
    // Private mode or blocked storage should not break sign-in.
  }
}

/** Reads existing sessions from either store; writes according to remember-me. */
export const authTokenStorage = {
  getItem(key: string): string | null {
    try {
      return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      const remember = getRememberDevice();
      const target = remember ? window.localStorage : window.sessionStorage;
      const other = remember ? window.sessionStorage : window.localStorage;
      other.removeItem(key);
      target.setItem(key, value);
    } catch {
      // Ignore quota / private-mode failures; Supabase will retry in-memory.
    }
  },
  removeItem(key: string): void {
    try {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};
