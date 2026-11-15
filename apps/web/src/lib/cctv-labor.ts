/**
 * Q2.6: CCTV services priced as hours × the workspace hourly rate, no catalog item needed.
 * Durations are the workspace defaults the owner chose (2026-11-15):
 * 45 min installation per camera, 30 min recorder setup, 30 min testing.
 */

export const LABOR_MINUTES: Record<string, { minutes: number; perUnit: boolean; labelHe: string }> = {
  installation_camera: { minutes: 45, perUnit: true, labelHe: "התקנת מצלמות" },
  recorder_setup_main: { minutes: 30, perUnit: false, labelHe: "הגדרת מקליט" },
  testing_main: { minutes: 30, perUnit: false, labelHe: "בדיקות ומסירה" },
};

export function isLaborComponent(componentKey: string): boolean {
  return componentKey in LABOR_MINUTES;
}

/** Hours for a service component: per-camera services scale with quantity. Two decimals. */
export function laborHours(componentKey: string, quantity: number): number | null {
  const spec = LABOR_MINUTES[componentKey];
  if (!spec) return null;
  const units = spec.perUnit ? Math.max(1, Math.round(Number(quantity) || 1)) : 1;
  return Math.round(((spec.minutes * units) / 60) * 100) / 100;
}

function hoursHe(hours: number): string {
  return hours === 1 ? "שעה אחת" : `${Number.isInteger(hours) ? hours : hours.toFixed(2).replace(/0$/, "")} שעות`;
}

/** Customer-facing line name, e.g. "התקנת מצלמות · 4.5 שעות × ₪250". */
export function laborLineName(componentKey: string, hours: number, rate: number | null): string {
  const spec = LABOR_MINUTES[componentKey];
  const base = spec?.labelHe ?? componentKey;
  return rate != null ? `${base} · ${hoursHe(hours)} × ₪${rate}` : `${base} · ${hoursHe(hours)}`;
}

/** Valid rate or null (no default). */
export function normalizeLaborRate(raw: unknown): number | null {
  const n = typeof raw === "string" ? Number(raw.replace(",", ".")) : Number(raw);
  return Number.isFinite(n) && n > 0 && n <= 10_000 ? Math.round(n * 100) / 100 : null;
}
