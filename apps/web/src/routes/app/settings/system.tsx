import { PageHeader } from "@site-secure/ui";
import { createFileRoute, Link } from "@tanstack/react-router";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/settings/system")({
  component: SystemPage,
});

function SystemPage() {
  return (
    <RequirePermission permission="workspace.edit">
      <SystemBody />
    </RequirePermission>
  );
}

function SystemBody() {
  const { session } = useSession();
  const membership = session?.memberships[0];

  return (
    <div className="settings-panel flex flex-col gap-6">
      <PageHeader title={he.settingsNavSystem} description={he.settingsSystemLead} />
      <dl className="settings-meta-list">
        <div>
          <dt>{he.workspaceName}</dt>
          <dd>{membership?.workspace_name ?? "—"}</dd>
        </div>
        <div>
          <dt>{he.planCaption}</dt>
          <dd className="ltr-meta">{membership?.plan_key ?? "—"}</dd>
        </div>
        <div>
          <dt>{he.roleCaption}</dt>
          <dd className="ltr-meta">{membership?.role_key ?? "—"}</dd>
        </div>
        <div>
          <dt>{he.settingsSystemStatus}</dt>
          <dd>{membership?.workspace_status === "active" ? he.workspaceMetaActive : he.workspaceMetaInactive}</dd>
        </div>
      </dl>
      <div className="settings-inline-links">
        <Link to="/app/settings/security" className="ops-section-link">
          {he.navSecurity} →
        </Link>
        <Link to="/app/settings/audit" className="ops-section-link">
          {he.navAudit} →
        </Link>
      </div>
    </div>
  );
}
