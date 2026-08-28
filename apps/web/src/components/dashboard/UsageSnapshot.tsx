import { useId, useState } from "react";
import type { UsageOccupant, WorkspaceUsage, WorkspaceUsageMeter } from "@site-secure/api-client";
import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { roleLabel } from "../../lib/app-nav";
import {
  formatStorageBytes,
  meterTone,
  meterUtilization,
} from "../../lib/ux-metrics";
import { RingMetric, type RingTone } from "./RingMetric";

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

function ringToneFor(meter: WorkspaceUsageMeter): RingTone {
  if (meter.key === "seats_operator") {
    const tone = meterTone(meter);
    return tone === "warning" || tone === "danger" ? tone : "action";
  }
  if (meter.key === "seats_field") {
    const tone = meterTone(meter);
    return tone === "warning" || tone === "danger" ? tone : "tech";
  }
  if (meter.key === "storage_gb") {
    const tone = meterTone(meter);
    return tone === "warning" || tone === "danger" ? tone : "analytics";
  }
  if (meter.key === "quota_quotes") {
    const tone = meterTone(meter);
    return tone === "warning" || tone === "danger" ? tone : "action";
  }
  if (meter.key === "quota_clients") {
    const tone = meterTone(meter);
    return tone === "warning" || tone === "danger" ? tone : "tech";
  }
  return meterTone(meter);
}

function meterTip(meter: WorkspaceUsageMeter): string | undefined {
  if (meter.key === "seats_operator") return he.uxSeatOfficeTip;
  if (meter.key === "seats_field") return he.uxSeatFieldTip;
  return undefined;
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
  if (meter.current > meter.limit) return he.usageOverLimit;
  if (meter.at_limit) {
    if (meter.key === "quota_quotes") return he.quotesAtLimit;
    if (meter.key === "quota_clients") return he.clientsAtLimit;
    return he.usageAtLimit;
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

function meterNext(meter: WorkspaceUsageMeter): string | undefined {
  if (meter.unit === "bytes") {
    if (meter.at_limit) return he.uxStorageFull;
    return undefined;
  }
  return seatStatusLabel(meter) ?? quotaStatusLabel(meter);
}

function meterDetail(meter: WorkspaceUsageMeter): string | undefined {
  return meter.detail_he ?? undefined;
}

function meterRingPercent(meter: WorkspaceUsageMeter): {
  arc: number | null;
  center: string | undefined;
  overLimit: boolean;
} {
  if (meter.unlimited || meter.limit <= 0) {
    return { arc: null, center: undefined, overLimit: false };
  }
  const raw = Math.round((meter.current / meter.limit) * 100);
  const overLimit = raw > 100;
  return {
    arc: Math.min(100, raw),
    center: he.uxPercent(raw),
    overLimit,
  };
}

const RING_ORDER = ["seats_operator", "seats_field", "storage_gb", "quota_quotes", "quota_clients"];

export function UsageSnapshot({
  usage,
  canManageTeam = false,
}: {
  usage: WorkspaceUsage;
  canManageTeam?: boolean;
}) {
  const ordered = RING_ORDER.map((key) => usage.meters.find((meter) => meter.key === key)).filter(
    (meter): meter is WorkspaceUsageMeter => Boolean(meter),
  );
  const ringMeters = ordered.filter((meter) => meterUtilization(meter) != null || meter.unit === "bytes");
  const unlimitedOnly = ordered.filter((meter) => meter.unlimited || (meter.limit <= 0 && meter.unit !== "bytes"));
  const [openKey, setOpenKey] = useState<string | null>(null);
  const panelId = useId();

  return (
    <section className="ops-card p-5" aria-labelledby="usage-heading">
      <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.usageKicker}</p>
      <h2 id="usage-heading" className="mt-1 text-base font-semibold text-fg">
        {he.usageTitle}
      </h2>
      <p className="mt-1 text-sm text-fg-muted">{he.usageSubtitle}</p>
      {ringMeters.length ? (
        <div className="ops-usage-rings mt-5">
          {ringMeters.map((meter) => {
            const { arc, center, overLimit } = meterRingPercent(meter);
            const rawPercent =
              meter.unlimited || meter.limit <= 0
                ? null
                : Math.round((meter.current / meter.limit) * 100);
            const percent =
              meter.unit === "bytes" && !meter.unlimited && meter.limit > 0
                ? (meterUtilization(meter) ?? 0)
                : arc;
            const open = openKey === meter.key;
            const expandable = (meter.occupants?.length ?? 0) > 0 && meter.unit === "seats";
            const centerLabel =
              meter.unit === "bytes" && percent != null ? he.uxPercent(percent) : center;
            return (
              <div key={meter.key} className="flex min-w-0 flex-col items-center">
                <RingMetric
                  percent={percent}
                  displayPercent={rawPercent ?? percent ?? undefined}
                  centerLabel={centerLabel}
                  overLimit={overLimit}
                  label={meter.label_he}
                  hint={meterHint(meter)}
                  next={meterNext(meter)}
                  tone={ringToneFor(meter)}
                  onActivate={expandable ? () => setOpenKey(open ? null : meter.key) : undefined}
                  expanded={open}
                  controlsId={`${panelId}-${meter.key}`}
                  tip={meterTip(meter)}
                />
                {open && expandable ? (
                  <div id={`${panelId}-${meter.key}`} className="w-full">
                    <OccupantTable meter={meter} />
                  </div>
                ) : meter.occupants && meter.occupants.length === 1 && meter.unit === "seats" ? (
                  <p className="mt-2 text-center text-xs text-fg-muted">
                    <span className="block">{meter.occupants[0].label}</span>
                    {meter.occupants[0].status === "pending" ? (
                      <span className="block">{he.usageOccupantPending}</span>
                    ) : null}
                  </p>
                ) : meterDetail(meter) ? (
                  <p className="mt-2 max-w-[10rem] text-center text-xs text-fg-muted">{meterDetail(meter)}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
      {unlimitedOnly.length ? (
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {unlimitedOnly.map((row) => (
            <div key={row.key} className="rounded-[var(--radius-panel)] border border-border bg-bg px-4 py-3">
              <dt className="text-xs font-medium text-fg-muted">{row.label_he}</dt>
              <dd className="mt-1 text-sm font-semibold text-fg">
                {row.unit === "bytes" ? he.usageStorageUnlimited : he.usersUsageUnlimited}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p className="mt-5 border-t border-border pt-4 text-sm text-fg-muted">
        {he.usageActivitySummary(usage.active_members, usage.pending_invites)}
      </p>
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
