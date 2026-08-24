/** Short launch beats tied to real init — no artificial long splash. */
export function authDelay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function authLaunchSequence(opts: {
  onWorkspace?: () => void;
  onReady?: () => void;
  workspaceMs?: number;
  readyMs?: number;
} = {}) {
  const workspaceMs = opts.workspaceMs ?? 420;
  const readyMs = opts.readyMs ?? 360;
  opts.onWorkspace?.();
  await authDelay(workspaceMs);
  opts.onReady?.();
  await authDelay(readyMs);
}
