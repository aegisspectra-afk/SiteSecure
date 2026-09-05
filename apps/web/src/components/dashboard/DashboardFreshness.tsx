import { he } from "../../i18n/he";

const STALE_MS = 15 * 60 * 1000;

/** Invisible when fresh; only surfaces when data is meaningfully stale. */
export function DashboardFreshness({
  generatedAt,
  now = Date.now(),
}: {
  generatedAt: string;
  now?: number;
}) {
  const date = new Date(generatedAt);
  if (Number.isNaN(date.getTime())) return null;
  const age = now - date.getTime();
  if (age < STALE_MS) return null;
  return (
    <p className="text-xs text-warning" role="status">
      {he.dashboardFreshnessStale}
    </p>
  );
}
