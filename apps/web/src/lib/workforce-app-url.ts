/** Origin of the standalone Workforce Intelligence app. Same Auth, different product shell. */

import { appendAuthHandoffHash } from "./auth-handoff";

function trimOrigin(raw: string | undefined): string {
  return (raw || "").trim().replace(/\/$/, "");
}

function isLoopbackOrigin(raw: string): boolean {
  try {
    const host = new URL(raw).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(raw);
  }
}

/** Keep 127.0.0.1 and localhost aligned so a local handoff stays on the same loopback host. */
export function alignLoopbackOrigin(target: string, currentOrigin: string): string {
  if (!target) return "";
  try {
    const next = new URL(target);
    const current = new URL(currentOrigin);
    if (isLoopbackOrigin(next.origin) && isLoopbackOrigin(current.origin)) {
      next.hostname = current.hostname;
      next.protocol = current.protocol;
      return next.origin;
    }
  } catch {
    return target;
  }
  return target;
}

/** Localhost is a development default only. Production must set VITE_WORKFORCE_APP_URL. */
export function resolveWorkforceAppOrigin(configured: string | undefined, dev: boolean): string {
  const value = trimOrigin(configured);
  if (value) {
    if (!dev && isLoopbackOrigin(value)) return "";
    return value;
  }
  return dev ? "http://localhost:5175" : "";
}

export function workforceAppOrigin(): string {
  const origin = resolveWorkforceAppOrigin(import.meta.env.VITE_WORKFORCE_APP_URL, import.meta.env.DEV);
  if (typeof window === "undefined") return origin;
  return alignLoopbackOrigin(origin, window.location.origin);
}

/** Map leftover Site Secure `/app/workforce...` bookmarks onto the WorkForce app. */
export function workforceAppUrlFromWebPath(pathname: string, search = ""): string {
  const origin = workforceAppOrigin();
  if (!origin) return "";
  const stripped = pathname.replace(/^\/app\/workforce\/?/, "/");
  const path = stripped === "" || stripped === "/" ? "/" : stripped.startsWith("/") ? stripped : `/${stripped}`;
  return `${origin}${path}${search}`;
}

/** Attach the current SITE SECURE Auth session so WorkForce does not bounce to /login. */
export function workforceAppUrlWithSession(
  pathname: string,
  search: string,
  tokens: {
    access_token?: string | null;
    refresh_token?: string | null;
    expires_at?: number | null;
  },
): string {
  return appendAuthHandoffHash(workforceAppUrlFromWebPath(pathname, search), tokens);
}
