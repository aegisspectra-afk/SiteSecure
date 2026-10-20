import { Link, createFileRoute } from "@tanstack/react-router";
import { ErrorState, ModuleScaffold } from "../../../components/modules/ModuleKit";
import { useSspWorkspace } from "../../../components/ssp/useSspWorkspace";
import { he } from "../../../i18n/he";

export const Route = createFileRoute("/app/ssp/templates")({
  component: SspTemplatesHubPage,
});

function SspTemplatesHubPage() {
  const { workspaceId, sspCan } = useSspWorkspace();
  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  return (
    <div data-testid="ssp-templates">
      <ModuleScaffold title={he.sspNavTemplatesHub} lead={he.sspTemplatesHubLead}>
        <ul className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-bg-1 text-sm">
          {sspCan("ssp.forms.view") ? (
            <li>
              <Link to="/app/ssp/forms" className="block px-4 py-3 hover:bg-bg-subtle">
                <p className="font-medium text-fg">{he.sspNavFormTemplates}</p>
                <p className="text-xs text-fg-muted">{he.sspFormTemplatesLead}</p>
              </Link>
            </li>
          ) : null}
          {sspCan("ssp.patrols.view") ? (
            <li>
              <Link to="/app/ssp/task-templates" className="block px-4 py-3 hover:bg-bg-subtle">
                <p className="font-medium text-fg">{he.sspNavTaskTemplates}</p>
                <p className="text-xs text-fg-muted">{he.sspTaskTemplatesLead}</p>
              </Link>
            </li>
          ) : null}
          {sspCan("ssp.org.view") ? (
            <li>
              <Link to="/app/ssp/organization" className="block px-4 py-3 hover:bg-bg-subtle">
                <p className="font-medium text-fg">{he.sspNavOrganization}</p>
                <p className="text-xs text-fg-muted">{he.sspNavOrg}</p>
              </Link>
            </li>
          ) : null}
        </ul>
        <p className="text-sm text-fg-muted">{he.sspReportsDeferred}</p>
      </ModuleScaffold>
    </div>
  );
}
