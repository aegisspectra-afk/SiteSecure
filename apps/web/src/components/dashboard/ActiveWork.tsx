import type { DashboardItem } from "@site-secure/api-client";
import { ActivityRow } from "@site-secure/ui";
import { Link } from "@tanstack/react-router";
import { CalendarDays, Clock } from "lucide-react";
import { he } from "../../i18n/he";

function formatTime(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
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
      <section className="ops-today-card is-empty is-premium" aria-labelledby="active-work-heading">
        <div className="ops-section-head is-today">
          <h2 id="active-work-heading" className="ops-section-title is-today">
            {he.todayTitle}
          </h2>
        </div>
        <div className="ops-today-empty-tile">
          <ActivityRow
            leading={<CalendarDays aria-hidden strokeWidth={1.75} />}
            title={he.todaySectionEmptyCompact}
            trailing={
              <Link to="/app/today" className="ops-today-empty-action">
                {he.todayScheduleCta}
              </Link>
            }
          />
        </div>
      </section>
    );
  }

  return (
    <section className="ops-today-card is-dense" aria-labelledby="active-work-heading">
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
        <ul className="ops-today-list">
          {items.map((item) => {
            const time = formatTime(item.scheduled_for);
            const place = item.site_name || item.customer_name || "—";
            const statusLabel =
              item.status && item.status in he.jobStatuses
                ? he.jobStatuses[item.status as keyof typeof he.jobStatuses]
                : null;
            return (
              <li key={item.entity_id} className="ops-today-row">
                <ActivityRow
                  leading={<Clock aria-hidden />}
                  title={item.title_he || item.number}
                  subtitle={[place, statusLabel, item.number].filter(Boolean).join(" · ")}
                  trailing={
                    <>
                      {time ? (
                        <span className="ops-today-time ltr-meta" dir="ltr">
                          {time}
                        </span>
                      ) : null}
                      {item.entity_type === "job" ? (
                        <Link
                          to="/app/jobs/$jobId"
                          params={{ jobId: item.entity_id }}
                          className="ops-attention-cta is-ghost"
                        >
                          {he.todayOpenJob}
                        </Link>
                      ) : null}
                    </>
                  }
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="ops-today-empty-text">{he.activeWorkEmpty}</p>
      )}
    </section>
  );
}
