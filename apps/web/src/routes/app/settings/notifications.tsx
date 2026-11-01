import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ErrorState, PageHeader } from "@site-secure/ui";
import { createFileRoute } from "@tanstack/react-router";
import type { NotificationPreference } from "@site-secure/api-client";
import { he } from "../../../i18n/he";
import { activeMembership } from "../../../lib/active-membership";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/settings/notifications")({
  component: NotificationsPage,
});

const EVENT_LABELS: Record<string, string> = {
  "quote.sent": he.notifyEventQuoteSent,
  "quote.viewed": he.notifyEventQuoteViewed,
  "quote.approved": he.notifyEventQuoteApproved,
  "quote.rejected": he.notifyEventQuoteRejected,
  "quote.expired": he.notifyEventQuoteExpired,
  "task.assigned": he.notifyEventTaskAssigned,
};

function NotificationsPage() {
  const { api, session } = useSession();
  const queryClient = useQueryClient();
  const workspaceId = activeMembership(session)?.workspace_id;
  const query = useQuery({
    queryKey: ["notification-preferences", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getNotificationPreferences(workspaceId!),
  });
  const save = useMutation({
    mutationFn: (items: NotificationPreference[]) => api.putNotificationPreferences(workspaceId!, items),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["notification-preferences", workspaceId] }),
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  const items = query.data?.items ?? [];

  function toggle(eventType: string, inApp: boolean) {
    const next = items.map((item) =>
      item.event_type === eventType ? { ...item, in_app: inApp, email: false, push: false } : item,
    );
    save.mutate(next);
  }

  return (
    <div className="settings-panel flex flex-col gap-6">
      <PageHeader title={he.settingsNavNotifications} description={he.settingsNotificationsLead} />
      <p className="text-sm text-fg-muted">{he.settingsNotificationsFutureBody}</p>
      <ul className="flex flex-col gap-3" data-testid="settings-notifications-prefs">
        {items.map((item) => (
          <li
            key={item.event_type}
            className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border px-4 py-3"
          >
            <span className="text-sm font-medium text-fg">{EVENT_LABELS[item.event_type] ?? item.event_type}</span>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={item.in_app}
                onChange={(event) => toggle(item.event_type, event.target.checked)}
              />
              {he.settingsNotificationsInApp}
            </label>
          </li>
        ))}
      </ul>
      <p className="text-xs text-fg-muted">
        {he.settingsNotificationsEmailOff} · {he.settingsNotificationsPushOff}
      </p>
    </div>
  );
}
