/**
 * Relative aging labels for dashboard attention / ops rows.
 * Uses calendar-day and hour buckets; never invents timestamps.
 */
export function relativeAgeLabel(
  iso: string | null | undefined,
  now = new Date(),
): string | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  const diffMs = now.getTime() - then.getTime();
  if (diffMs < 0) return null;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "עכשיו";
  if (minutes < 60) return minutes === 1 ? "לפני דקה" : `לפני ${minutes} דקות`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "לפני שעה" : `לפני ${hours} שעות`;
  const startNow = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const startThen = Date.UTC(then.getFullYear(), then.getMonth(), then.getDate());
  const days = Math.round((startNow - startThen) / 86_400_000);
  if (days === 1) return "מאז אתמול";
  if (days > 1) return `ממתינה ${days} ימים`;
  return "היום";
}
