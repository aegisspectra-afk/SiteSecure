function trimOrigin(raw: string | undefined): string {
  return (raw || "").trim().replace(/\/$/, "");
}

export function isLoopbackOrigin(raw: string): boolean {
  try {
    const host = new URL(raw).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(raw);
  }
}

/** Development may default to local SITE SECURE. Production must set VITE_PLATFORM_HOME_URL. */
export function resolvePlatformHomeUrl(configured: string | undefined, dev: boolean): string {
  const value = trimOrigin(configured);
  if (value) {
    if (!dev && isLoopbackOrigin(value)) return "";
    return value;
  }
  return dev ? "http://localhost:5173/platform" : "";
}

export function resolveForgotPasswordUrl(platformHome: string): string {
  if (!platformHome) return "";
  try {
    return `${new URL(platformHome).origin}/forgot-password`;
  } catch {
    return "";
  }
}
