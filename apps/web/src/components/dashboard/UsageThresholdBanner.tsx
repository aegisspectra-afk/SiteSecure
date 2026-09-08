import type { WorkspaceUsage, WorkspaceUsageMeter } from "@site-secure/api-client";
import { Link } from "@tanstack/react-router";
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

export function UsageThresholdBanner({
  meters,
  canManageTeam = false,
}: {
  meters: WorkspaceUsageMeter[];
  canManageTeam?: boolean;
}) {
  if (!meters.length) return null;
  const lines = meters.map(usageMeterQuotaLine);
  const primaryTone = meterTone(meters[0]);
  return (
    <section
      className={`ops-usage-notice is-quiet is-${primaryTone}`}
      aria-labelledby="usage-threshold-heading"
    >
      <div className="ops-usage-notice-row">
        <div className="min-w-0">
          <h2 id="usage-threshold-heading" className="ops-usage-notice-title">
            {he.usageThresholdTitle}
          </h2>
          <p className="ops-usage-notice-body tabular-nums">{he.usageThresholdBody(lines[0])}</p>
          {lines.length > 1 ? (
            <p className="ops-usage-notice-extra tabular-nums">{lines.slice(1).join(" · ")}</p>
          ) : null}
          <p className="ops-usage-notice-hint">{he.usageThresholdHint}</p>
        </div>
        {canManageTeam ? (
          <Link to="/app/settings/users" className="ops-usage-notice-link">
            {he.usageManageUsers}
          </Link>
        ) : (
          <Link to="/app/settings" className="ops-usage-notice-link">
            {he.settingsTitle}
          </Link>
        )}
      </div>
    </section>
  );
}
