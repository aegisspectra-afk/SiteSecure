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

export function ActiveWork({
  items,
  compactEmpty = false,
}: {
  items: DashboardItem[];
  compactEmpty?: boolean;
}) {
  if (!items.length && compactEmpty) {
    return (
      <section className="ops-panel px-4 py-3" aria-labelledby="active-work-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="active-work-heading" className="text-sm font-semibold text-fg">
            {he.activeWorkTitle}
          </h2>
          <p className="text-sm text-fg-muted">{he.todaySectionEmptyCompact}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="ops-panel p-4" aria-labelledby="active-work-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="active-work-heading" className="text-base font-semibold text-fg">
            {he.activeWorkTitle}
          </h2>
          {items.length ? (
            <p className="mt-1 text-sm text-fg-muted">{he.activeWorkCount(items.length)}</p>
          ) : null}
        </div>
        <Link
          to="/app/today"
          className="text-sm font-medium text-action hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {he.todayViewAll}
        </Link>
      </div>

      {items.length ? (
        <ul className="mt-3 divide-y divide-border border-y border-border">
          {items.map((item) => {
            const time = formatTime(item.scheduled_for);
            return (
              <li
                key={item.entity_id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  {time ? (
                    <p className="public-mono text-base font-semibold tracking-[-0.03em] text-fg" dir="ltr">
                      {time}
                    </p>
                  ) : null}
                  <p className="mt-0.5 truncate text-sm font-medium text-fg">{item.number}</p>
                  <p className="text-sm text-fg-muted">{item.site_name || item.customer_name || "—"}</p>
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
        <p className="mt-3 text-sm text-fg-muted">{he.activeWorkEmpty}</p>
      )}
    </section>
  );
}
