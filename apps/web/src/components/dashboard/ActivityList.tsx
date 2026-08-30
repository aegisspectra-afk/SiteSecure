import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { NewQuoteButton } from "../quotes/NewQuoteButton";

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function GettingStarted({ canCreateQuote = false }: { canCreateQuote?: boolean }) {
  return (
    <div className="mt-3 rounded-[var(--radius-panel)] border border-dashed border-border bg-bg-subtle px-4 py-5">
      <p className="text-sm font-medium text-fg">{he.gettingStartedTitle}</p>
      <p className="mt-1 text-sm text-fg-muted">{he.gettingStartedBody}</p>
      {canCreateQuote ? (
        <NewQuoteButton className="mt-4" />
      ) : (
        <Link
          to="/app/quotes"
          className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-action hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {he.recentQuotesViewAll}
        </Link>
      )}
    </div>
  );
}

export function ActivityList({
  items,
  canCreateQuote = false,
}: {
  items: { entity_type: string; entity_id: string; title_he: string; occurred_at: string }[];
  canCreateQuote?: boolean;
}) {
  return (
    <section className="ops-card p-4" aria-labelledby="activity-heading">
      <h2 id="activity-heading" className="text-base font-semibold text-fg">
        {he.activityTitle}
      </h2>
      {items.length === 0 ? (
        <GettingStarted canCreateQuote={canCreateQuote} />
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
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
