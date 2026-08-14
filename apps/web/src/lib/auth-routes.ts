/** Unauthenticated /app and onboarding send guests to Login. `/` is the public website. */

export function guestEntryPath(): "/login" {
  return "/login";
}

export function afterAuthPath(hasWorkspace: boolean): "/app" | "/onboarding" {
  return hasWorkspace ? "/app" : "/onboarding";
}
