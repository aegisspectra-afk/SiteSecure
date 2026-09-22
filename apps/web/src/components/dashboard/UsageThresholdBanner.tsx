import type { WorkspaceUsage, WorkspaceUsageMeter } from "@site-secure/api-client";
import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { he } from "../../i18n/he";
import { meterTone, usageMeterQuotaLine } from "../../lib/ux-metrics";

/** Meters that need a compact dashboard warning (approaching / at / over limit). */
export function usageThresholdMeters(usage: WorkspaceUsage | null | undefined): WorkspaceUsageMeter[] {
  if (!usage) return [];
  return usage.meters.filter((meter) => {
    if (meter.unlimited || meter.limit <= 0) return false;
    const tone = meterTone(meter);
    return tone === "warning" || tone === "danger";
  });
}

/** Compact actionable quota warning row — not a Dashboard module. */
export function UsageThresholdBanner({
  meters,
  canManageTeam = false,
}: {
  meters: WorkspaceUsageMeter[];
  canManageTeam?: boolean;
}) {
  if (!meters.length) return null;
  const primary = meters[0];
  const line = usageMeterQuotaLine(primary);
  const primaryTone = meterTone(primary);
  const title = primary.at_limit
    ? he.usageThresholdMeterFull(primary.label_he)
    : he.usageThresholdTitle;

  return (
    <section
      className={`ops-usage-row is-utility is-${primaryTone}`}
      aria-labelledby="usage-threshold-heading"
    >
      <span className="ops-usage-row-icon" aria-hidden>
        <AlertTriangle strokeWidth={1.75} />
      </span>
      <div className="ops-usage-row-text min-w-0">
        <h2 id="usage-threshold-heading" className="ops-usage-row-title">
          {title}
        </h2>
        <p className="ops-usage-row-body tabular-nums">{line}</p>
      </div>
      {canManageTeam ? (
        <Link to="/app/settings/users" className="ops-usage-row-link">
          {he.usageManageUsers}
        </Link>
      ) : (
        <Link to="/app/settings" className="ops-usage-row-link">
          {he.settingsTitle}
        </Link>
      )}
    </section>
  );
}
