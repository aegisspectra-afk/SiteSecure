import { ActivityRow } from "@site-secure/ui";
import { Activity } from "lucide-react";
import { he } from "../../i18n/he";

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
}

const MAX = 5;

/**
 * Limited activity from dashboard.activity only: quote_events + job completions.
 * Not a workspace-wide feed — copy must stay semantically honest.
 */
export function DashboardActivity({
  items,
}: {
  items: { entity_type: string; entity_id: string; title_he: string; occurred_at: string }[];
}) {
  const rows = items.slice(0, MAX);
  if (!rows.length) return null;

  return (
    <section className="ops-activity-panel" aria-labelledby="dash-activity-heading">
      <div className="ops-section-head is-tight">
        <h2 id="dash-activity-heading" className="ops-section-title is-secondary">
          {he.activityTitleLimited}
        </h2>
      </div>
      <p className="ops-activity-lead">{he.activityLeadLimited}</p>
      <ul className="ops-activity-list">
        {rows.map((item) => (
          <li key={`${item.entity_type}-${item.entity_id}-${item.occurred_at}`} className="ops-activity-row">
            <ActivityRow
              leading={<Activity aria-hidden strokeWidth={1.75} />}
              title={item.title_he}
              trailing={
                <span className="ops-activity-time public-mono ltr-meta" dir="ltr">
                  {formatWhen(item.occurred_at)}
                </span>
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
