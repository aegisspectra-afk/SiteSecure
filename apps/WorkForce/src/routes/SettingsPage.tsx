import { RequirePermission } from "../components/RequirePermission";
import { ErrorState, ModuleScaffold, useQuery } from "../components/Kit";
import { he } from "../i18n/he";
import { queryErrorDescription } from "../lib/query-error";
import { useSession } from "../lib/session";

export function SettingsPage() {
  return (
    <RequirePermission permission="workforce.settings.manage">
      <SettingsBody />
    </RequirePermission>
  );
}

function SettingsBody() {
  const { session, api } = useSession();
  const workspaceId = session?.memberships[0]?.workspace_id;
  const query = useQuery({
    queryKey: ["workforce-policy", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getWorkforcePolicy(workspaceId!),
  });

  return (
    <ModuleScaffold title={he.settingsTitle} lead={he.settingsLead}>
      {query.isError ? (
        <ErrorState title={he.loadError} description={queryErrorDescription(query.error)} />
      ) : query.isLoading || !query.data ? (
        <p className="text-sm text-fg-muted">{he.loading}</p>
      ) : (
        <dl className="wf-profile-list">
          <div>
            <dt>{he.policyMaxShift}</dt>
            <dd>{query.data.max_shift_hours}</dd>
          </div>
          <div>
            <dt>{he.policyRest}</dt>
            <dd>{query.data.min_rest_hours ?? "—"}</dd>
          </div>
          <div>
            <dt>{he.policyRestEnabled}</dt>
            <dd>{query.data.rest_rule_enabled ? he.enabled : he.disabled}</dd>
          </div>
          <div>
            <dt>{he.policyWeeklyCap}</dt>
            <dd>{query.data.weekly_hour_cap ?? "—"}</dd>
          </div>
        </dl>
      )}
    </ModuleScaffold>
  );
}
