/**
 * Conservative engineering bitrate defaults (Mbps per camera).
 * These are ASSUMPTIONS — not product facts.
 *
 * Baseline: H.265, ~15–20 FPS, moderate scene complexity.
 * H.264 uses a 1.4× multiplier when codec is h264.
 */
export const DEFAULT_FPS = 15;
export const DEFAULT_CODEC = "h265" as const;
/** Default motion/event duty cycle when mode=motion and duty not supplied. */
export const DEFAULT_MOTION_DUTY_CYCLE = 0.3;
export const DEFAULT_STORAGE_OVERHEAD = 0.2;

/** Resolution MP → Mbps (H.265 baseline). */
export const BITRATE_DEFAULTS_H265_MBPS: Readonly<Record<number, number>> = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  8: 8,
  12: 10,
};

export function defaultBitrateMbps(resolutionMp: number, codec: string | null | undefined): number | null {
  if (!Number.isFinite(resolutionMp) || resolutionMp <= 0) return null;
  // Snap to nearest known key
  const keys = Object.keys(BITRATE_DEFAULTS_H265_MBPS)
    .map(Number)
    .sort((a, b) => a - b);
  let nearest = keys[0];
  let best = Math.abs(resolutionMp - nearest);
  for (const k of keys) {
    const d = Math.abs(resolutionMp - k);
    if (d < best) {
      best = d;
      nearest = k;
    }
  }
  // Only accept if within 0.6 MP of a known tier (avoid inventing for exotic values far away)
  if (best > 0.6 && !BITRATE_DEFAULTS_H265_MBPS[resolutionMp]) {
    // If exact integer key missing but close enough to a key, still use nearest when within 1.0
    if (best > 1.0) return null;
  }
  const base = BITRATE_DEFAULTS_H265_MBPS[nearest];
  if (base == null) return null;
  const c = (codec || DEFAULT_CODEC).toLowerCase();
  if (c === "h264" || c === "avc") return base * 1.4;
  return base;
}
