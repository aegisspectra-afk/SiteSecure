import { RequireAnyPermission } from "../components/RequirePermission";
import { ModuleScaffold } from "../components/Kit";
import { he } from "../i18n/he";
import { useSession } from "../lib/session";

export function ProfilePage() {
  return (
    <RequireAnyPermission permissions={["workforce.view", "workforce.portal.view"]}>
      <ProfileBody />
    </RequireAnyPermission>
  );
}

function ProfileBody() {
  const { session } = useSession();
  const membership = session?.memberships[0];
  return (
    <ModuleScaffold title={he.profileTitle} lead={he.profileLead}>
      <dl className="wf-profile-list">
        <div>
          <dt>{he.name}</dt>
          <dd>{session?.profile?.full_name || "—"}</dd>
        </div>
        <div>
          <dt>{he.email}</dt>
          <dd>{session?.email || "—"}</dd>
        </div>
        <div>
          <dt>{he.fieldProductRole}</dt>
          <dd>{membership?.role_key || "—"}</dd>
        </div>
        <div>
          <dt>{he.navSites}</dt>
          <dd>{membership?.workspace_name || "—"}</dd>
        </div>
      </dl>
    </ModuleScaffold>
  );
}
