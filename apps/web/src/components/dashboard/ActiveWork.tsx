import type { DashboardItem } from "@site-secure/api-client";
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
      <section className="ops-today-card is-empty" aria-labelledby="active-work-heading">
        <div className="ops-today-empty-row">
          <h2 id="active-work-heading" className="ops-section-title is-secondary">
            {he.activeWorkTitle}
          </h2>
          <p className="ops-today-empty-text">{he.todaySectionEmptyCompact}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="ops-today-card is-dense" aria-labelledby="active-work-heading">
      <div className="ops-section-head">
        <div className="ops-today-head-main">
          <h2 id="active-work-heading" className="ops-section-title is-secondary">
            {he.activeWorkTitle}
          </h2>
          {items.length ? (
            <span className="ops-section-count">{he.activeWorkCount(items.length)}</span>
          ) : null}
        </div>
        <Link to="/app/today" className="ops-section-link">
          {he.todayViewAll}
        </Link>
      </div>

      {items.length ? (
        <ul className="ops-today-list">
          {items.map((item) => {
            const time = formatTime(item.scheduled_for);
            const place = item.site_name || item.customer_name || "—";
            return (
              <li key={item.entity_id} className="ops-today-row">
                <div className="ops-today-main min-w-0">
                  <p className="ops-today-title">
                    {time ? (
                      <>
                        <span className="ops-today-time ltr-meta" dir="ltr">
                          {time}
                        </span>
                        <span className="ops-today-sep" aria-hidden>
                          ·
                        </span>
                      </>
                    ) : null}
                    <span>{item.title_he || item.number}</span>
                  </p>
                  <p className="ops-today-context">
                    {place}
                    {item.number && item.title_he ? ` · ${item.number}` : null}
                  </p>
                </div>
                {item.entity_type === "job" ? (
                  <a href={`/app/jobs/${item.entity_id}`} className="ops-attention-cta is-ghost">
                    {he.todayOpenJob}
                  </a>
                ) : null}
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
