import { he } from "../../i18n/he";

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function ActivityList({
  items,
}: {
  items: { entity_type: string; entity_id: string; title_he: string; occurred_at: string }[];
}) {
  return (
    <section className="ops-card p-5" aria-labelledby="activity-heading">
      <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">RECENT ACTIVITY</p>
      <h2 id="activity-heading" className="mt-1 text-base font-semibold text-fg">
        {he.activityTitle}
      </h2>
      {items.length === 0 ? (
        <div className="mt-4">
          <p className="text-sm font-medium text-fg">{he.activityEmptyTitle}</p>
          <p className="mt-1 text-sm text-fg-muted">{he.activityEmptyBody}</p>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {items.map((item) => (
            <li
              key={`${item.entity_type}-${item.entity_id}-${item.occurred_at}`}
              className="flex items-baseline gap-3 text-sm"
            >
              <span className="public-mono shrink-0 text-xs text-fg-muted">
                {formatWhen(item.occurred_at)}
              </span>
              <span className="text-fg">{item.title_he}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
