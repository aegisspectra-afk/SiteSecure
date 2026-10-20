import { ErrorState, PageHeader } from "@site-secure/ui";
import { Link } from "@tanstack/react-router";
import { RequireSspAccess } from "../components/RequirePermission";
import { he } from "../i18n/he";
import { useOrg } from "../lib/org";
import { useSession } from "../lib/session";

export function TemplatesPage() {
  return (
    <RequireSspAccess anyOf={["ssp.forms.view", "ssp.patrols.view", "ssp.org.view", "ssp.settings.view"]}>
      <TemplatesBody />
    </RequireSspAccess>
  );
}

function TemplatesBody() {
  const { workspaceId } = useSession();
  const { sspCan } = useOrg();
  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  return (
    <div className="flex flex-col gap-4" data-testid="ssp-templates">
      <PageHeader title={he.navTemplatesHub} description={he.templatesHubLead} />
      <ul className="divide-y divide-border rounded-lg border border-border text-sm">
        {sspCan("ssp.forms.view") ? (
          <li>
            <Link to="/forms" className="block px-4 py-3 hover:bg-bg-subtle">
              <p className="font-medium">{he.navFormTemplates}</p>
              <p className="text-xs text-fg-muted">{he.formTemplatesLead}</p>
            </Link>
          </li>
        ) : null}
        {sspCan("ssp.patrols.view") ? (
          <li>
            <Link to="/task-templates" className="block px-4 py-3 hover:bg-bg-subtle">
              <p className="font-medium">{he.navTaskTemplates}</p>
              <p className="text-xs text-fg-muted">{he.taskTemplatesLead}</p>
            </Link>
          </li>
        ) : null}
        {sspCan("ssp.org.view") ? (
          <li>
            <Link to="/organization" className="block px-4 py-3 hover:bg-bg-subtle">
              <p className="font-medium">{he.navOrg}</p>
            </Link>
          </li>
        ) : null}
        {sspCan("ssp.settings.view") ? (
          <li>
            <Link to="/settings" className="block px-4 py-3 hover:bg-bg-subtle">
              <p className="font-medium">{he.navSettings}</p>
            </Link>
          </li>
        ) : null}
      </ul>
      <p className="text-sm text-fg-muted">{he.reportsDeferred}</p>
    </div>
  );
}
