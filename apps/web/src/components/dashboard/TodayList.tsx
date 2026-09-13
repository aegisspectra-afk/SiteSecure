import { Button, Status } from "@site-secure/ui";
import type { DashboardItem } from "@site-secure/api-client";
import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";

function formatTime(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function severityTone(severity: DashboardItem["severity"]): "warning" | "info" | "neutral" | "success" {
  if (severity === "now") return "warning";
  if (severity === "next") return "info";
  if (severity === "info") return "success";
  return "neutral";
}

function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function sectionLabel(key: "now" | "next" | "later" | "done"): string {
  if (key === "now") return he.todayNow;
  if (key === "next") return he.todayNext;
  if (key === "later") return he.todayLater;
  return he.todayCompleted;
}

function bucketFor(item: DashboardItem): "now" | "next" | "later" | "done" {
  if (item.severity === "info" || item.actions.length === 0 && item.title_he === he.jobStatuses.completed) {
    // completed items use severity info
    if (item.severity === "info") return "done";
  }
  if (item.severity === "now") return "now";
  if (item.severity === "next") return "next";
  if (item.severity === "info") return "done";
  return "later";
}

export function TodayList({
  items,
  onAction,
  busyId,
}: {
  items: DashboardItem[];
  onAction?: (id: string, action: string) => void;
  busyId?: string | null;
}) {
  if (!items.length) return null;

  const buckets: Record<"now" | "next" | "later" | "done", DashboardItem[]> = {
    now: [],
    next: [],
    later: [],
    done: [],
  };
  for (const item of items) {
    buckets[bucketFor(item)].push(item);
  }

  return (
    <section className="field-today-list" aria-labelledby="today-heading">
      <h2 id="today-heading" className="sr-only">
        {he.todayTitle}
      </h2>
      {(["now", "next", "later", "done"] as const).map((key) => {
        const rows = buckets[key];
        if (!rows.length) return null;
        return (
          <div key={key} className="mb-6">
            <p className="public-mono mb-2 text-[10px] tracking-[0.16em] text-fg-subtle">{sectionLabel(key)}</p>
            <ul className="field-job-stack">
              {rows.map((item) => (
                <TodayCard key={item.entity_id} item={item} busyId={busyId} onAction={onAction} />
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

function TodayCard({
  item,
  busyId,
  onAction,
}: {
  item: DashboardItem;
  busyId?: string | null;
  onAction?: (id: string, action: string) => void;
}) {
  const time = formatTime(item.scheduled_for);
  const busy = busyId === item.entity_id;
  const isJob = item.entity_type === "job";
  const phone = item.customer_phone?.trim() || "";
  const address = item.site_address?.trim() || "";
  const primary =
    item.actions.find((a) => a === "en_route") ||
    item.actions.find((a) => a === "arrived") ||
    item.actions.find((a) => a === "start") ||
    item.actions.find((a) => a === "complete");

  const primaryLabel =
    primary === "en_route"
      ? he.startRoute
      : primary === "arrived"
        ? he.markArrived
        : primary === "start"
          ? he.startJob
          : primary === "complete"
            ? he.completeJob
            : null;

  return (
    <li className="field-job-card">
      <div className="field-job-card-meta">
        {time ? (
          <p className="public-mono text-lg font-semibold tracking-[-0.02em] text-fg" dir="ltr">
            {time}
          </p>
        ) : (
          <p className="text-sm text-fg-muted">{he.fieldNoSchedule}</p>
        )}
        <Status label={item.title_he} tone={severityTone(item.severity)} />
      </div>

      <div className="min-w-0">
        <p className="public-mono text-[10px] tracking-[0.14em] text-fg-subtle">{he.fieldWhereKicker}</p>
        <p className="mt-1 text-base font-semibold text-fg">{item.site_name || he.fieldSiteUnknown}</p>
        {item.customer_name ? <p className="mt-1 text-sm text-fg-muted">{item.customer_name}</p> : null}
        {address ? (
          <p className="mt-1 text-sm text-fg-muted">{address}</p>
        ) : (
          <p className="mt-1 text-xs text-fg-subtle">{he.todayAddressMissing}</p>
        )}
        <p className="public-mono mt-2 text-xs text-fg-muted" dir="ltr">
          {item.number}
        </p>
      </div>

      <div className="field-job-card-actions">
        {address ? (
          <a className="field-job-open" href={mapsUrl(address)} target="_blank" rel="noreferrer">
            {he.navigateMaps}
          </a>
        ) : null}
        {phone ? (
          <a className="field-job-open" href={`tel:${phone}`}>
            {he.todayCall}
          </a>
        ) : null}
        {isJob ? (
          <Link to="/app/jobs/$jobId" params={{ jobId: item.entity_id }} className="field-job-open">
            {he.todayOpenJob}
          </Link>
        ) : null}
        {primary && primaryLabel && onAction ? (
          <Button variant="primary" loading={busy} onClick={() => onAction(item.entity_id, primary)}>
            {primaryLabel}
          </Button>
        ) : null}
      </div>
    </li>
  );
}
