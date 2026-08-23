import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { he } from "../../../i18n/he";
import { useSession } from "../../../lib/session";

export function QuoteAuditStrip({
  workspaceId,
  quoteId,
}: {
  workspaceId: string;
  quoteId: string;
}) {
  const { api } = useSession();
  const [open, setOpen] = useState(false);
  const events = useQuery({
    queryKey: ["quote-events", workspaceId, quoteId],
    queryFn: () => api.listQuoteEvents(workspaceId, quoteId),
    enabled: Boolean(quoteId),
  });

  const items = events.data?.items ?? [];
  if (!quoteId) return null;

  return (
    <section className="ops-card p-3">
      <button type="button" className="cpq-domain-toggle w-full" onClick={() => setOpen((v) => !v)}>
        <span>
          {open ? "▾" : "▸"} {he.cpqActivity}
        </span>
        <span className="text-fg-muted">
          {items.length ? he.cpqActivityCount(items.length) : he.cpqAuditEmpty}
        </span>
      </button>
      {open ? (
        <ul className="mt-3 flex max-h-40 flex-col gap-2 overflow-auto text-sm">
          {events.isLoading ? <li className="text-fg-muted">{he.loading}</li> : null}
          {!items.length && !events.isLoading ? (
            <li className="text-fg-subtle">{he.cpqAuditEmpty}</li>
          ) : null}
          {items.slice(0, 20).map((row) => (
            <li key={row.id} className="border-t border-border/50 pt-2 first:border-0 first:pt-0">
              <span className="font-medium">{eventLabel(row.event_type)}</span>
              <span className="ms-2 text-xs text-fg-muted">
                {row.created_at ? new Date(row.created_at).toLocaleString("he-IL") : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function eventLabel(type: string) {
  const map: Record<string, string> = {
    sent: he.cpqEventSent,
    revised: he.cpqEventRevised,
    item_added: he.cpqEventItemAdded,
    item_updated: he.cpqEventItemUpdated,
    item_removed: he.cpqEventItemRemoved,
    price_override: he.cpqEventPriceOverride,
    margin_override: he.cpqEventMarginOverride,
    template_applied: he.cpqEventTemplateApplied,
    package_applied: he.cpqEventPackageApplied,
    template_saved: he.cpqEventTemplateSaved,
    approved: he.cpqEventApproved,
    rejected: he.cpqEventRejected,
    viewed: he.cpqEventViewed,
  };
  return map[type] || type;
}
