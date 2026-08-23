import { ErrorState } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CustomerProfile } from "../../../components/customers/CustomerProfile";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { can } from "../../../lib/can";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/customers/$customerId")({
  component: CustomerDetailPage,
});

function CustomerDetailPage() {
  return (
    <RequirePermission permission="crm.view">
      <CustomerDetailBody />
    </RequirePermission>
  );
}

function CustomerDetailBody() {
  const { customerId } = Route.useParams();
  const { session, api } = useSession();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const features = membership?.features ?? [];
  const canEdit = can(membership?.role_key, "crm.edit", features);
  const canDelete = can(membership?.role_key, "crm.delete", features);
  const canCreateSite = can(membership?.role_key, "sites.create", features);
  const canCreateQuote = can(membership?.role_key, "quotes.create", features);
  const canCreateProject = can(membership?.role_key, "projects.create", features);
  const canCreateService = can(membership?.role_key, "service.create", features);

  const customerQuery = useQuery({
    queryKey: ["customer", workspaceId, customerId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getCustomer(workspaceId!, customerId),
  });

  if (!workspaceId) return <ErrorState title={he.customersError} />;
  if (customerQuery.isError) return <ErrorState title={he.customersError} />;
  if (customerQuery.isLoading || !customerQuery.data) return <p className="text-sm text-fg-muted">{he.loading}</p>;

  return (
    <CustomerProfile
      customerId={customerId}
      workspaceId={workspaceId}
      api={api}
      canEdit={canEdit}
      canDelete={canDelete}
      canCreateSite={canCreateSite}
      canCreateQuote={canCreateQuote}
      canCreateProject={canCreateProject}
      canCreateService={canCreateService}
    />
  );
}
