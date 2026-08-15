import { Status, cn } from "@site-secure/ui";
import type { AttentionGroup, DashboardItem } from "@site-secure/api-client";
import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { itemHref } from "../../lib/home";

const tone = (severity: DashboardItem["severity"]) =>
  severity === "now" ? "warning" : severity === "next" ? "info" : "neutral";

export function AttentionList({ groups }: { groups: AttentionGroup[] }) {
  if (!groups.length) return null;
  return (
    <section className="ops-card p-5" aria-labelledby="attention-heading">
      <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">ATTENTION</p>
      <h2 id="attention-heading" className="text-lg font-semibold text-fg">
        {he.attentionTitle}
      </h2>
      {groups.map((group) => (
        <div key={group.kind} className="mt-4 flex flex-col gap-2">
          <p className="text-sm font-medium text-fg">
            {group.count} {group.label_he}
          </p>
          <ul className="divide-y divide-border border-t border-border">
            {group.items.map((item) => (
              <AttentionRow key={item.entity_id} item={item} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function AttentionRow({ item }: { item: DashboardItem }) {
  const href = itemHref(item.entity_type, item.entity_id);
  const meta = [item.number, item.customer_name, item.site_name].filter(Boolean).join(" · ");
  const body = (
    <>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-sm font-medium text-fg">{meta || item.number}</span>
        <Status label={item.title_he} tone={tone(item.severity)} />
      </span>
      {href ? (
        <span className="text-fg-muted" aria-hidden>
          ‹
        </span>
      ) : null}
    </>
  );
  const className = cn(
    "flex min-h-10 items-center justify-between gap-3 py-2",
    href &&
      "rounded-[var(--radius-control)] hover:bg-bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
  );
  if (href) {
    if (item.entity_type === "quote") {
      return (
        <li>
          <Link to="/app/quotes/$quoteId" params={{ quoteId: item.entity_id }} className={className}>
            {body}
          </Link>
        </li>
      );
    }
    return (
      <li>
        <a href={href} className={className}>
          {body}
        </a>
      </li>
    );
  }
  return <li className={className}>{body}</li>;
}
