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
  return (
    <section
      className="ops-usage-notice is-quiet"
      aria-labelledby="usage-threshold-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="usage-threshold-heading" className="text-sm font-semibold text-fg">
            {he.usageThresholdTitle}
          </h2>
          <p className="mt-0.5 text-sm text-fg-muted tabular-nums">{he.usageThresholdBody(lines[0])}</p>
          {lines.length > 1 ? (
            <p className="mt-1 text-xs text-fg-subtle tabular-nums">{lines.slice(1).join(" · ")}</p>
          ) : null}
          <p className="mt-1 text-xs text-fg-subtle">{he.usageThresholdHint}</p>
        </div>
        {canManageTeam ? (
          <Link
            to="/app/settings/users"
            className="text-sm font-medium text-action hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {he.usageManageUsers}
          </Link>
        ) : (
          <Link
            to="/app/settings"
            className="text-sm font-medium text-action hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {he.settingsTitle}
          </Link>
        )}
      </div>
    </section>
  );
}
