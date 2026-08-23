import { ErrorState } from "@site-secure/ui";
import { createFileRoute } from "@tanstack/react-router";
import { LeadProfile } from "../../../components/leads/LeadProfile";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { can } from "../../../lib/can";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/leads/$leadId")({
  component: LeadDetailPage,
});

function LeadDetailPage() {
  return (
    <RequirePermission permission="leads.view">
      <LeadDetailBody />
    </RequirePermission>
  );
}

function LeadDetailBody() {
  const { leadId } = Route.useParams();
  const { session, api } = useSession();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const features = membership?.features ?? [];

  if (!workspaceId) return <ErrorState title={he.leadsDetailError} />;

  return (
    <LeadProfile
      leadId={leadId}
      workspaceId={workspaceId}
      api={api}
      canEdit={can(membership?.role_key, "leads.edit", features)}
      canCreateQuote={can(membership?.role_key, "quotes.create", features)}
      canCreateCustomer={can(membership?.role_key, "crm.create", features)}
      canCreateSite={can(membership?.role_key, "sites.create", features)}
    />
  );
}
