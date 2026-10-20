/** Optional client markers for demo `/app/platform-path` screens.
 * Public Site Secure onboarding no longer gates on this — `needsPlatformSetup` is always false.
 */

const KEY = "aegis-platform-setup-done";

function readMap(): Record<string, true> {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, true>;
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, true>): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore quota / private mode */
  }
}

export function isPlatformSetupDone(workspaceId: string | null | undefined): boolean {
  if (!workspaceId) return false;
  return Boolean(readMap()[workspaceId]);
}

export function markPlatformSetupDone(workspaceId: string): void {
  if (!workspaceId) return;
  const map = readMap();
  map[workspaceId] = true;
  writeMap(map);
}

/** Disabled for public Site Secure signup — owners are not forced into product selection. */
export function needsPlatformSetup(_opts: {
  workspaceId: string | null | undefined;
  roleKey: string | null | undefined;
}): boolean {
  return false;
}
