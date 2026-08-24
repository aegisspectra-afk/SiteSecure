export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Visual handoff between real auth states — 0ms when reduced motion is on. */
export function motionMs(ms: number): number {
  return prefersReducedMotion() ? 0 : ms;
}

export function wait(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
