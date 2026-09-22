import { ActivityRow, Button, Status } from "@site-secure/ui";
import type { DashboardItem } from "@site-secure/api-client";
import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { he } from "../../i18n/he";

function formatTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function statusTone(status: string | null | undefined, severity: DashboardItem["severity"]): "warning" | "info" | "neutral" | "success" {
  if (status === "completed" || severity === "info") return "success";
  if (status === "en_route" || status === "arrived" || status === "in_progress" || status === "blocked") return "warning";
  if (severity === "now") return "warning";
  if (severity === "next") return "info";
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
  if (item.severity === "info" || item.status === "completed") return "done";
  if (item.severity === "now") return "now";
  if (item.severity === "later") return "later";
  return "next";
}

function statusLabel(item: DashboardItem): string {
  if (item.status && item.status in he.jobStatuses) {
    return he.jobStatuses[item.status as keyof typeof he.jobStatuses];
  }
  return item.title_he;
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
  const start = formatTime(item.scheduled_for);
  const end = formatTime(item.scheduled_end);
  const busy = busyId === item.entity_id;
  const isJob = item.entity_type === "job";
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
      <ActivityRow
        leading={<MapPin aria-hidden />}
        title={item.site_name || he.fieldSiteUnknown}
        subtitle={
          <>
            <span>{item.title_he}</span>
            {item.customer_name ? <span>{` · ${item.customer_name}`}</span> : null}
          </>
        }
        meta={
          <>
            <span className="public-mono ltr-meta" dir="ltr">
              {item.number}
            </span>
            {start ? (
              <span className="public-mono ltr-meta" dir="ltr">
                {" · "}
                {start}
                {end ? `–${end}` : ""}
              </span>
            ) : (
              <span>{` · ${he.fieldNoSchedule}`}</span>
            )}
            {address ? <span className="ss-activity-row-address">{address}</span> : null}
          </>
        }
        trailing={<Status label={statusLabel(item)} tone={statusTone(item.status, item.severity)} />}
      />

      <div className="field-job-card-actions">
        {address ? (
          <a className="field-job-navlink" href={mapsUrl(address)} target="_blank" rel="noreferrer">
            {he.navigateMaps}
          </a>
        ) : null}
        {isJob ? (
          <Link to="/app/jobs/$jobId" params={{ jobId: item.entity_id }} className="field-job-navlink">
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
