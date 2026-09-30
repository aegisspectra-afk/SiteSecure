import { ErrorState, PageHeader } from "@site-secure/ui";
import { createFileRoute } from "@tanstack/react-router";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/settings/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  return (
    <RequirePermission permission="workspace.edit">
      <NotificationsBody />
    </RequirePermission>
  );
}

function NotificationsBody() {
  const { session } = useSession();
  const workspaceId = session?.memberships[0]?.workspace_id;
  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  return (
    <div className="settings-panel flex flex-col gap-6">
      <PageHeader title={he.settingsNavNotifications} description={he.settingsNotificationsLead} />
      <div className="settings-unavailable" role="status" data-testid="settings-notifications-unavailable">
        <p className="settings-section-title">{he.settingsNotificationsFutureTitle}</p>
        <p className="settings-section-lead">{he.settingsNotificationsFutureBody}</p>
      </div>
    </div>
  );
}
