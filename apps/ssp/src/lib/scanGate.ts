/** Pure helpers for scan submit + API result display. No camera / DOM. */

export const SCAN_RESULTS = ["ok", "duplicate", "out_of_route", "unauthorized", "error"] as const;
export type ScanResultCode = (typeof SCAN_RESULTS)[number];

export function isScanResult(value: string): value is ScanResultCode {
  return (SCAN_RESULTS as readonly string[]).includes(value);
}

export function canSubmitScan(opts: { code: string; pending: boolean }): boolean {
  return Boolean(opts.code.trim()) && !opts.pending;
}

/** Normalize a camera/manual payload to the server checkpoint code (lowercase, trimmed). */
export function normalizeScanCode(raw: string): string {
  return raw.trim().toLowerCase();
}

export function scanResultTone(result: string): "ok" | "warn" | "danger" {
  if (result === "ok") return "ok";
  if (result === "duplicate" || result === "out_of_route") return "warn";
  return "danger";
}
