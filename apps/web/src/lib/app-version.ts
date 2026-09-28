export const APP_VERSION = "0.1.6-beta";

/** Safe client build metadata for operator diagnostics — no secrets. */
export const WEB_BUILD = {
  version: APP_VERSION,
  mode: import.meta.env.MODE as string,
  /** Only present when injected at build (e.g. VITE_GIT_SHA); never fabricate. */
  gitSha: (import.meta.env.VITE_GIT_SHA as string | undefined) || null,
} as const;
