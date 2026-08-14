import { Button, Status } from "@site-secure/ui";
import type { DashboardItem } from "@site-secure/api-client";
import { he } from "../../i18n/he";

function formatTime(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
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
    <section className="flex flex-col gap-4" aria-labelledby="today-heading">
      <h2 id="today-heading" className="text-lg font-semibold text-fg">
        {he.todayTitle}
      </h2>
      <ul className="flex flex-col gap-4">
        {items.map((item) => {
          const time = formatTime(item.scheduled_for);
          const start = item.actions.includes("start") && onStart;
          const complete = item.actions.includes("complete") && onComplete;
          const busy = busyId === item.entity_id;
          return (
            <li
              key={item.entity_id}
              className="flex flex-col gap-3 border-b border-border pb-4 last:border-b-0"
            >
              {time ? (
                <p className="ltr-meta text-sm font-medium text-fg" dir="ltr">
                  {time}
                </p>
              ) : null}
              <p className="text-sm font-semibold text-fg">{item.customer_name ?? item.number}</p>
              {item.site_name ? <p className="text-sm text-fg-muted">{item.site_name}</p> : null}
              <Status
                label={item.title_he}
                tone={item.severity === "now" ? "warning" : "info"}
              />
              {start ? (
                <Button
                  variant="primary"
                  loading={busy}
                  onClick={() => onStart(item.entity_id)}
                  className="self-start"
                >
                  {he.startJob}
                </Button>
              ) : null}
              {complete ? (
                <Button
                  variant="primary"
                  loading={busy}
                  onClick={() => onComplete(item.entity_id)}
                  className="self-start"
                >
                  {he.completeJob}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
