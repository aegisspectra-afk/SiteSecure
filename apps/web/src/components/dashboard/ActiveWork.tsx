import type { DashboardItem } from "@site-secure/api-client";
import { Status } from "@site-secure/ui";
import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";

function formatTime(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function ActiveWork({ items }: { items: DashboardItem[] }) {
  return (
    <section className="ops-panel p-5" aria-labelledby="active-work-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.todaySectionKicker}</p>
          <h2 id="active-work-heading" className="mt-1 text-base font-semibold text-fg">
            {he.activeWorkTitle}
          </h2>
          <p className="mt-1 text-sm text-fg-muted">
            {items.length ? he.activeWorkCount(items.length) : he.todaySectionKicker}
          </p>
        </div>
        <Link
          to="/app/today"
          className="text-sm font-medium text-action hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {he.todayViewAll}
        </Link>
      </div>

      {items.length ? (
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {items.map((item) => {
            const time = formatTime(item.scheduled_for);
            return (
              <li key={item.entity_id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  {time ? (
                    <p className="public-mono text-lg font-semibold tracking-[-0.03em] text-fg" dir="ltr">
                      {time}
                    </p>
                  ) : null}
                  <p className="mt-1 truncate text-sm font-medium text-fg">{item.number}</p>
                  <p className="mt-0.5 text-sm text-fg-muted">{item.site_name || item.customer_name || "—"}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Status label={item.title_he} tone={item.severity === "now" ? "warning" : "info"} />
                  {item.entity_type === "job" ? (
                    <a
                      href={`/app/jobs/${item.entity_id}`}
                      className="text-sm font-medium text-action hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    >
                      {he.todayOpenJob}
                    </a>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-4 border border-border px-4 py-5">
          <p className="text-sm font-medium text-fg">{he.activeWorkEmpty}</p>
          <p className="mt-1 text-sm text-fg-muted">{he.dashboardLead}</p>
        </div>
      )}
    </section>
  );
}
