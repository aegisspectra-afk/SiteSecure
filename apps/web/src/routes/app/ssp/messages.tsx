import { createFileRoute } from "@tanstack/react-router";
import { ErrorState, ModuleScaffold } from "../../../components/modules/ModuleKit";
import { useSspWorkspace } from "../../../components/ssp/useSspWorkspace";
import { he } from "../../../i18n/he";

export const Route = createFileRoute("/app/ssp/messages")({
  component: SspMessagesPage,
});

function SspMessagesPage() {
  const { workspaceId } = useSspWorkspace();
  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  return (
    <div data-testid="ssp-messages">
      <ModuleScaffold title={he.sspNavMessages} lead={he.sspMessagesLead}>
        <div className="ops-card flex flex-col gap-3 p-6">
          <p className="text-sm font-medium text-fg">{he.sspNavMessages}</p>
          <p className="text-sm text-fg">{he.sspMessagesUnavailable}</p>
          <p className="text-sm text-fg-muted">{he.sspMessagesNoSend}</p>
          <p className="text-sm text-fg-muted">{he.sspEmailUnavailable}</p>
        </div>
      </ModuleScaffold>
    </div>
  );
}
