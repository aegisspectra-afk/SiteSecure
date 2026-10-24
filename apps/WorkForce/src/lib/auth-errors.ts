import { he } from "../i18n/he";

const MAPPED: Record<string, string> = {
  "Invalid login credentials": he.loginFailed,
  "Email not confirmed": he.emailNotConfirmed,
  NO_CONFIG: he.noConfig,
  SESSION_FAILED: he.sessionFailed,
};

export function workforceAuthErrorMessage(raw: string | null | undefined): string {
  const value = (raw || "").trim();
  if (!value) return he.loginGenericError;
  if (MAPPED[value]) return MAPPED[value];
  if (/[\u0590-\u05FF]/.test(value)) return value;
  return he.loginGenericError;
}
