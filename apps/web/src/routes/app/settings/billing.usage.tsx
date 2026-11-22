import { ErrorState, PageHeader } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { UsageSnapshot } from "../../../components/dashboard/UsageSnapshot";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { activeMembership } from "../../../lib/active-membership";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/settings/billing/usage")({
  component: BillingUsagePage,
});

function BillingUsagePage() {
  return (
    <RequirePermission permission="settings.view">
      <BillingUsageBody />
    </RequirePermission>
  );
}

function BillingUsageBody() {
  const { api, session } = useSession();
  const membership = activeMembership(session);
  const workspaceId = membership?.workspace_id;

  const query = useQuery({
    queryKey: ["usage", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getUsage(workspaceId!),
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  return (
    <div className="settings-panel flex flex-col gap-6" data-testid="settings-billing-usage">
      <PageHeader title={he.settingsBillingUsageTitle} description={he.settingsBillingLead} />
      <Link to="/app/settings/billing" className="text-sm text-fg-muted underline">
        {he.settingsBillingBack}
      </Link>
      {query.data ? (
        <UsageSnapshot usage={query.data} canManageTeam={false} />
      ) : query.isLoading ? (
        <p className="text-sm text-fg-muted">{he.loading}</p>
      ) : (
        <ErrorState title={he.sessionError} />
      )}
    </div>
  );
}