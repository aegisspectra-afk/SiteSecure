import { useId, useState } from "react";
import type { UsageOccupant, WorkspaceUsage, WorkspaceUsageMeter } from "@site-secure/api-client";
import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { roleLabel } from "../../lib/app-nav";
import { seatTone, seatUtilization } from "../../lib/ux-metrics";
import { RingMetric } from "./RingMetric";

function occupantStatus(row: UsageOccupant): string {
  return row.status === "pending" ? he.usageOccupantPending : he.usageOccupantActive;
}

function OccupantTable({ meter }: { meter: WorkspaceUsageMeter }) {
  const occupants = meter.occupants ?? [];
  return (
    <div className="mt-3 w-full overflow-x-auto rounded-[var(--radius-panel)] border border-border">
      <p className="border-b border-border px-3 py-2 text-start text-xs font-medium text-fg">
        {he.usageWho}
      </p>
      {occupants.length === 0 ? (
        <p className="px-3 py-3 text-start text-sm text-fg-muted">{he.usageOccupantsEmpty}</p>
      ) : (
        <table className="w-full text-start text-sm">
          <thead>
            <tr className="text-xs text-fg-muted">
              <th className="px-3 py-2 font-medium">{he.usageColUser}</th>
              <th className="px-3 py-2 font-medium">{he.usageColRole}</th>
              <th className="px-3 py-2 font-medium">{he.usageColStatus}</th>
            </tr>
          </thead>
          <tbody>
            {occupants.map((row) => (
              <tr key={`${row.kind}-${row.email ?? row.label}-${row.role_key}`}>
                <td className="px-3 py-2 text-fg">
                  {row.label}
                  {row.email && row.label !== row.email ? (
                    <span className="ltr-meta mt-0.5 block text-xs text-fg-muted">{row.email}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-fg">{roleLabel(row.role_key)}</td>
                <td className="px-3 py-2 text-fg-muted">{occupantStatus(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function UsageSnapshot({
  usage,
  canManageTeam = false,
}: {
  usage: WorkspaceUsage;
  canManageTeam?: boolean;
}) {
  const quotaMeters = usage.meters.filter((meter) => seatUtilization(meter) != null);
  const unlimitedMeters = usage.meters.filter((meter) => meter.unlimited || meter.limit <= 0);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const panelId = useId();

  return (
    <section className="ops-card p-5" aria-labelledby="usage-heading">
      <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.usageKicker}</p>
      <h2 id="usage-heading" className="mt-1 text-base font-semibold text-fg">
        {he.usageTitle}
      </h2>
      {quotaMeters.length ? (
        <div className="mt-5 grid grid-cols-2 gap-6">
          {quotaMeters.map((meter) => {
            const percent = seatUtilization(meter);
            const office = meter.key === "seats_operator";
            const field = meter.key === "seats_field";
            const open = openKey === meter.key;
            return (
              <div key={meter.key} className="flex min-w-0 flex-col items-center">
                <RingMetric
                  percent={percent}
                  label={meter.label_he}
                  hint={`${meter.current} / ${meter.limit}`}
                  next={meter.at_limit ? he.uxSeatFull : undefined}
                  tone={seatTone(meter)}
                  onActivate={() => setOpenKey(open ? null : meter.key)}
                  expanded={open}
                  controlsId={`${panelId}-${meter.key}`}
                  tip={office ? he.uxSeatOfficeTip : field ? he.uxSeatFieldTip : undefined}
                />
                {open ? (
                  <div id={`${panelId}-${meter.key}`} className="w-full">
                    <OccupantTable meter={meter} />
                  </div>
                ) : meter.occupants && meter.occupants.length === 1 ? (
                  <p className="mt-2 text-center text-xs text-fg-muted">
                    <span className="block">{meter.occupants[0].label}</span>
                    {meter.occupants[0].status === "pending" ? (
                      <span className="block">{he.usageOccupantPending}</span>
                    ) : null}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
      {unlimitedMeters.length ? (
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {unlimitedMeters.map((row) => (
            <div key={row.key} className="rounded-[var(--radius-panel)] border border-border bg-bg px-4 py-3">
              <dt className="text-xs font-medium text-fg-muted">{row.label_he}</dt>
              <dd className="mt-1 text-sm font-semibold text-fg">{he.usersUsageUnlimited}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="mt-5 border-t border-border pt-4">
        <p className="text-xs font-medium text-fg-muted">{he.usageActiveMembers}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-fg">{usage.active_members}</p>
        <p className="mt-1 text-xs text-fg-muted">{he.usageActiveMembersHint}</p>
      </div>
      {canManageTeam ? (
        <Link
          to="/app/settings/users"
          className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-action hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {he.usageManageUsers}
        </Link>
      ) : null}
    </section>
  );
}
