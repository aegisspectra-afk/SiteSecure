/** Guest entry is Login. Register is opt-in. `/` is not the public website yet. */

export function guestEntryPath(): "/login" {
  return "/login";
}

export function afterAuthPath(hasWorkspace: boolean): "/app" | "/onboarding" {
  return hasWorkspace ? "/app" : "/onboarding";
}
