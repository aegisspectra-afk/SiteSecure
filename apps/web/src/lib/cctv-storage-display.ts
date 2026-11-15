/**
 * Q2 storage display: one rounding rule for TB, the next commercial disk size, and the
 * bitrate assumption the server engine used. Presentation only; the engine formula
 * (cameras × bitrate × seconds × days × overhead) is unchanged.
 */

/** Disk sizes a customer can actually buy, in TB. */
export const COMMERCIAL_DISK_SIZES_TB = [1, 2, 4, 6, 8, 10, 12] as const;

/** "3.6288" -> "3.6", "4" -> "4". One decimal, no trailing ".0". */
export function formatTb(tb: number): string {
  if (!Number.isFinite(tb)) return "—";
  const rounded = Math.round(tb * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Smallest commercial disk that holds the requirement; above 12 TB, several 12 TB disks. */
export function commercialDisk(requiredTb: number): { driveCount: number; driveTb: number } | null {
  if (!Number.isFinite(requiredTb) || requiredTb <= 0) return null;
  const single = COMMERCIAL_DISK_SIZES_TB.find((size) => size + 1e-9 >= requiredTb);
  if (single != null) return { driveCount: 1, driveTb: single };
  const largest = COMMERCIAL_DISK_SIZES_TB[COMMERCIAL_DISK_SIZES_TB.length - 1];
  return { driveCount: Math.ceil(requiredTb / largest - 1e-9), driveTb: largest };
}

/** "4TB" or "2 × 12TB". */
export function commercialDiskLabel(requiredTb: number): string | null {
  const disk = commercialDisk(requiredTb);
  if (!disk) return null;
  return disk.driveCount === 1 ? `${disk.driveTb}TB` : `${disk.driveCount} × ${disk.driveTb}TB`;
}

const CODEC_LABEL: Record<string, string> = { h265: "H.265", hevc: "H.265", h264: "H.264", avc: "H.264" };

/**
 * "≈4 Mbps למצלמה, H.265" from engineering.storage. Codec: the one the user chose,
 * otherwise the engine default (H.265). Null when the engine resolved no bitrate.
 */
export function storageBitrateAssumptionHe(
  storage: { bitrateMbps?: unknown } | null | undefined,
  codec?: string | null,
): string | null {
  const mbps = typeof storage?.bitrateMbps === "number" ? storage.bitrateMbps : null;
  if (mbps == null || !Number.isFinite(mbps)) return null;
  const shown = Math.round(mbps * 10) / 10;
  const codecLabel = CODEC_LABEL[(codec || "h265").toLowerCase()] ?? codec ?? "H.265";
  return `≈${Number.isInteger(shown) ? shown : shown.toFixed(1)} Mbps למצלמה, ${codecLabel}`;
}
