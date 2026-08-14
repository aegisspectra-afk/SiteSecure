import { he } from "../i18n/he";

const KNOWN: Record<string, string> = {
  "Invalid login credentials": he.loginFailed,
  "Email not confirmed": he.emailNotConfirmed,
  "User already registered": he.userExists,
  "A user with this email address has already been registered": he.userExists,
  "Password should be at least 6 characters": he.passwordMin,
  "Password should be at least 8 characters": he.passwordMin,
  "Signup requires a valid password": he.passwordMin,
  "Unable to validate email address: invalid format": he.invalidEmail,
  "New password should be different from the old password": he.passwordDifferent,
  "Auth session missing!": he.resetInvalid,
  "Email rate limit exceeded": he.emailRateLimited,
  "For security purposes, you can only request this once every 60 seconds": he.emailRateLimited,
};

export function authErrorMessage(raw: string | undefined | null): string {
  if (!raw) return he.authGenericError;
  const mapped = KNOWN[raw];
  if (mapped) return mapped;
  if (/[\u0590-\u05FF]/.test(raw)) return raw;
  return he.authGenericError;
}
