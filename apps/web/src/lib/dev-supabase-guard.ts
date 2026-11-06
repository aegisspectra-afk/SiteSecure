/** Local dev must never talk to a hosted Supabase project unless explicitly allowed. */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function isLocalSupabaseUrl(raw: string | undefined): boolean {
  try {
    const host = new URL((raw ?? "").trim()).hostname.toLowerCase();
    return LOCAL_HOSTS.has(host) || host.endsWith(".local");
  } catch {
    return false;
  }
}

export function requireLocalSupabaseInDev(raw: string | undefined, allowRemote: string | undefined): void {
  if (allowRemote === "1") return;
  if (isLocalSupabaseUrl(raw)) return;
  let host = "<empty>";
  try {
    host = new URL((raw ?? "").trim()).hostname || host;
  } catch {
    // keep placeholder
  }
  throw new Error(
    `Refusing non-local VITE_SUPABASE_URL host '${host}' in dev. Point it at local Supabase ` +
      "(http://127.0.0.1:54321), or set VITE_ALLOW_REMOTE_SUPABASE=1 to opt in deliberately.",
  );
}
