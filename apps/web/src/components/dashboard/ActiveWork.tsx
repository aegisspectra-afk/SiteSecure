import type { DashboardItem } from "@site-secure/api-client";
import { Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { he } from "../../i18n/he";

function formatTime(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function formatTodaySchedule(
  item: Pick<DashboardItem, "scheduled_for" | "scheduled_end">,
): string | null {
  const start = formatTime(item.scheduled_for);
  const end = formatTime(item.scheduled_end);
  if (start && end) return `${start}–${end}`;
  return start;
}

export function todayStatusTone(
  status: string | null | undefined,
  _severity?: string | null,
): "active" | "success" | "warning" | "info" | "neutral" {
  if (status === "in_progress") return "active";
  if (status === "completed") return "success";
  if (status === "blocked") return "warning";
  if (status === "scheduled") return "info";
  return "neutral";
}

function statusLabel(status: string | null | undefined): string | null {
  if (status && status in he.jobStatuses) {
    return he.jobStatuses[status as keyof typeof he.jobStatuses];
  }
  return null;
}

function ActiveWorkRow({ item }: { item: DashboardItem }) {
  const isJob = item.entity_type === "job";
  const schedule = formatTodaySchedule(item);
  const tone = todayStatusTone(item.status, item.severity);
  const label = statusLabel(item.status);
  const rowClass = [
    "ops-today-row",
    "is-queue",
    isJob ? "is-interactive" : "is-static",
    `is-tone-${tone}`,
  ].join(" ");
  const body = (
    <div className="ss-activity-row">
      <span className="ss-activity-row-leading">
        <Clock aria-hidden strokeWidth={1.75} />
      </span>
      <div className="ss-activity-row-body">
        <p className="ops-today-title">{item.title_he || item.number}</p>
        <p className="ops-today-context">
          {[item.customer_name, item.site_name].filter(Boolean).join(" · ") || "—"}
        </p>
        {label ? <span className="ops-today-status">{label}</span> : null}
        {item.number ? (
          <span className="ops-today-id ltr-meta" dir="ltr">
            {item.number}
          </span>
        ) : null}
      </div>
      <div className="ss-activity-row-trailing">
        {schedule ? (
          <span className="ops-today-time ltr-meta" dir="ltr">
            {schedule}
          </span>
        ) : (
          <span className="ops-today-time is-empty">{he.fieldNoSchedule}</span>
        )}
        {isJob ? <span className="ops-today-cta is-quiet">{he.openLinkedJob}</span> : null}
      </div>
    </div>
  );

  if (isJob) {
    return (
      <Link className={rowClass} to="/app/jobs/$jobId" params={{ jobId: item.entity_id }}>
        {body}
      </Link>
    );
  }
  return <div className={rowClass}>{body}</div>;
}

export function ActiveWork({
  items,
  compactEmpty = false,
}: {
  items: DashboardItem[];
  compactEmpty?: boolean;
}) {
  if (!items.length && compactEmpty) {
    return (
      <section className="ops-today-card is-empty is-queue is-compact-empty" aria-labelledby="active-work-heading">
        <div className="ops-section-head is-today">
          <h2 id="active-work-heading" className="ops-section-title is-today">
            {he.todayTitle}
          </h2>
          <Link to="/app/today" className="ops-section-link">
            {he.dashViewToday}
          </Link>
        </div>
        <p className="ops-today-empty-text">{he.todayRestDay}</p>
      </section>
    );
  }

  return (
    <section className="ops-today-card is-dense is-queue" aria-labelledby="active-work-heading">
      <div className="ops-section-head is-today">
        <div className="ops-today-head-main">
          <h2 id="active-work-heading" className="ops-section-title is-today">
            {he.todayTitle}
          </h2>
          {items.length ? (
            <span className="ops-section-count">{he.activeWorkCount(items.length)}</span>
          ) : null}
        </div>
        <Link to="/app/today" className="ops-section-link">
          {he.dashViewToday}
        </Link>
      </div>

      {items.length ? (
        <ul className="ops-today-list is-queue">
          {items.map((item) => (
            <li key={item.entity_id}>
              <ActiveWorkRow item={item} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="ops-today-empty-text">{he.activeWorkEmpty}</p>
      )}
    </section>
  );
}
