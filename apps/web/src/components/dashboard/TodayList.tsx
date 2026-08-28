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

function severityTone(severity: DashboardItem["severity"]): "warning" | "info" | "neutral" {
  if (severity === "now") return "warning";
  if (severity === "next") return "info";
  return "neutral";
}

export function TodayList({
  items,
  onStart,
  onComplete,
  busyId,
}: {
  items: DashboardItem[];
  onStart?: (id: string) => void;
  onComplete?: (id: string) => void;
  busyId?: string | null;
}) {
  if (!items.length) return null;
  return (
    <section className="field-today-list" aria-labelledby="today-heading">
      <h2 id="today-heading" className="sr-only">
        {he.todayTitle}
      </h2>
      <ul className="field-job-stack">
        {items.map((item) => {
          const time = formatTime(item.scheduled_for);
          const start = item.actions.includes("start") && onStart;
          const complete = item.actions.includes("complete") && onComplete;
          const busy = busyId === item.entity_id;
          const isJob = item.entity_type === "job";
          return (
            <li key={item.entity_id} className="field-job-card">
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
                <p className="public-mono mt-2 text-xs text-fg-muted" dir="ltr">
                  {item.number}
                </p>
              </div>

              <div className="field-job-card-actions">
                {isJob ? (
                  <Link
                    to="/app/jobs/$jobId"
                    params={{ jobId: item.entity_id }}
                    className="field-job-open"
                  >
                    {he.todayOpenJob}
                  </Link>
                ) : null}
                {start ? (
                  <Button variant="primary" loading={busy} onClick={() => onStart(item.entity_id)}>
                    {he.startJob}
                  </Button>
                ) : null}
                {complete ? (
                  <Button variant="secondary" loading={busy} onClick={() => onComplete(item.entity_id)}>
                    {he.completeJob}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
