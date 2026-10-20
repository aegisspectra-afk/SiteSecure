import { ErrorState, PageHeader } from "@site-secure/ui";
import { RequireSspAccess } from "../components/RequirePermission";
import { he } from "../i18n/he";
import { useSession } from "../lib/session";

export function MessagesPage() {
  return (
    <RequireSspAccess anyOf={["ssp.dashboard.view", "ssp.forms.view"]}>
      <MessagesBody />
    </RequireSspAccess>
  );
}

function MessagesBody() {
  const { workspaceId } = useSession();
  if (!workspaceId) return <ErrorState title={he.sessionError} />;
  return (
    <div className="flex flex-col gap-4" data-testid="ssp-messages">
      <PageHeader title={he.navMessages} description={he.messagesLead} />
      <p className="text-sm text-fg">{he.messagesUnavailable}</p>
      <p className="text-sm text-fg-muted">{he.messagesNoSend}</p>
      <p className="text-sm text-fg-muted">{he.emailUnavailable}</p>
    </div>
  );
}
