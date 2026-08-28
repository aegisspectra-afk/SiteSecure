import { useId, useState } from "react";
import type { UsageOccupant, WorkspaceUsage, WorkspaceUsageMeter } from "@site-secure/api-client";
import { Link } from "@tanstack/react-router";
import { cn } from "@site-secure/ui";
import { he } from "../../i18n/he";
import { roleLabel } from "../../lib/app-nav";
import {
  formatStorageBytes,
  meterTone,
  meterUtilization,
} from "../../lib/ux-metrics";

function occupantStatus(row: UsageOccupant): string {
  return row.status === "pending" ? he.usageOccupantPending : he.usageOccupantActive;
}

function OccupantTable({ meter }: { meter: WorkspaceUsageMeter }) {
  const occupants = meter.occupants ?? [];
  return (
    <div className="mt-2 overflow-x-auto rounded-[var(--radius-panel)] border border-border">
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

function storageMeterHint(meter: WorkspaceUsageMeter): string {
  const used = formatStorageBytes(meter.current);
  if (meter.unlimited || meter.limit <= 0) {
    return `${used} / ${he.usageStorageUnlimited}`;
  }
  const total = formatStorageBytes(meter.limit);
  const remaining = formatStorageBytes(Math.max(0, meter.limit - meter.current));
  return `${used} / ${total} · ${he.usageStorageAvailable(remaining)}`;
}

function seatStatusLabel(meter: WorkspaceUsageMeter): string | undefined {
  if (meter.unit !== "seats") return undefined;
  if (meter.key === "seats_operator" && meter.at_limit && meter.current === 1) {
    const owner = meter.occupants?.find((row) => row.role_key === "owner" && row.status === "active");
    if (owner) return he.usageOfficeSeatTaken(owner.label);
  }
  if (meter.at_limit) return he.uxSeatFull;
  if (meter.unlimited || meter.limit <= 0) return undefined;
  if (meter.key === "seats_field" && meter.limit > meter.current) {
    return he.usageSeatsLeft(Math.max(0, meter.limit - meter.current));
  }
  return undefined;
}

function quotaStatusLabel(meter: WorkspaceUsageMeter): string | undefined {
  if (meter.unlimited || meter.limit <= 0) return undefined;
  if (meter.at_limit) {
    if (meter.key === "quota_quotes") return he.quotesAtLimit;
    if (meter.key === "quota_clients") return he.clientsAtLimit;
    return he.uxSeatFull;
  }
  const remaining = Math.max(0, meter.limit - meter.current);
  if (meter.key === "quota_quotes") return he.quotesRemaining(remaining);
  if (meter.key === "quota_clients") return he.clientsRemaining(remaining);
  return undefined;
}

function meterHint(meter: WorkspaceUsageMeter): string {
  if (meter.unit === "bytes") return storageMeterHint(meter);
  if (meter.unlimited || meter.limit <= 0) return he.usersUsageUnlimited;
  return `${meter.current} / ${meter.limit}`;
}

function meterSubtitle(meter: WorkspaceUsageMeter): string | undefined {
  if (meter.unit === "bytes") {
    if (meter.at_limit) return he.uxStorageFull;
    return undefined;
  }
  return seatStatusLabel(meter) ?? quotaStatusLabel(meter) ?? meter.detail_he ?? undefined;
}

function barToneClass(meter: WorkspaceUsageMeter): string {
  const tone = meterTone(meter);
  if (tone === "danger") return "is-danger";
  if (tone === "warning") return "is-warning";
  if (meter.key === "seats_field") return "is-tech";
  if (meter.key === "storage_gb") return "is-analytics";
  if (meter.key === "quota_clients") return "is-tech";
  return "is-action";
}

function UsageProgressRow({
  meter,
  expanded,
  onToggle,
  controlsId,
}: {
  meter: WorkspaceUsageMeter;
  expanded: boolean;
  onToggle?: () => void;
  controlsId?: string;
}) {
  const percent = meterUtilization(meter);
  const subtitle = meterSubtitle(meter);
  const expandable = (meter.occupants?.length ?? 0) > 0 && meter.unit === "seats";
  const displayPercent = percent ?? (meter.unit === "bytes" && meter.limit > 0 ? 0 : null);
  const ariaLabel =
    displayPercent == null
      ? `${meter.label_he}: ${meterHint(meter)}`
      : `${meter.label_he}: ${displayPercent} אחוז. ${meterHint(meter)}`;

  return (
    <div className="ops-usage-row">
      <div className="flex items-start justify-between gap-3">
        {expandable ? (
          <button
            type="button"
            className="min-w-0 flex-1 text-start"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={controlsId}
          >
            <span className="text-sm font-medium text-fg">{meter.label_he}</span>
          </button>
        ) : (
          <span className="text-sm font-medium text-fg">{meter.label_he}</span>
        )}
        <span className="shrink-0 text-xs text-fg-muted tabular-nums">{meterHint(meter)}</span>
      </div>
      {displayPercent != null ? (
        <div
          className="ops-usage-bar mt-2"
          role="progressbar"
          aria-valuenow={displayPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={ariaLabel}
        >
          <span
            className={cn("ops-usage-bar-fill", barToneClass(meter))}
            style={{ width: `${Math.max(0, Math.min(100, displayPercent))}%` }}
          />
        </div>
      ) : (
        <p className="mt-2 text-xs text-fg-muted">{meterHint(meter)}</p>
      )}
      {subtitle ? <p className="mt-1.5 text-xs text-fg-muted">{subtitle}</p> : null}
      {expanded && expandable ? (
        <div id={controlsId}>
          <OccupantTable meter={meter} />
        </div>
      ) : null}
    </div>
  );
}

const METER_ORDER = ["seats_operator", "seats_field", "storage_gb", "quota_quotes", "quota_clients"];

export function UsageSnapshot({
  usage,
  canManageTeam = false,
}: {
  usage: WorkspaceUsage;
  canManageTeam?: boolean;
}) {
  const ordered = METER_ORDER.map((key) => usage.meters.find((meter) => meter.key === key)).filter(
    (meter): meter is WorkspaceUsageMeter => Boolean(meter),
  );
  const [openKey, setOpenKey] = useState<string | null>(null);
  const panelId = useId();

  return (
    <section className="ops-card p-5" aria-labelledby="usage-heading">
      <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.usageKicker}</p>
      <h2 id="usage-heading" className="mt-1 text-base font-semibold text-fg">
        {he.usageTitle}
      </h2>
      {ordered.length ? (
        <div className="ops-usage-list mt-5">
          {ordered.map((meter) => {
            const open = openKey === meter.key;
            const expandable = (meter.occupants?.length ?? 0) > 0 && meter.unit === "seats";
            return (
              <UsageProgressRow
                key={meter.key}
                meter={meter}
                expanded={open}
                controlsId={expandable ? `${panelId}-${meter.key}` : undefined}
                onToggle={
                  expandable ? () => setOpenKey(open ? null : meter.key) : undefined
                }
              />
            );
          })}
        </div>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-4 text-xs text-fg-muted">
        <span>
          {he.usageActiveMembers}: <strong className="text-fg">{usage.active_members}</strong>
        </span>
        <span>
          {he.usagePendingInvites}: <strong className="text-fg">{usage.pending_invites}</strong>
        </span>
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
