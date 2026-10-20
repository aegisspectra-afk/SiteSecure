import { createFileRoute } from "@tanstack/react-router";
import { Briefcase } from "lucide-react";
import { EmptyRows, ErrorState, ModuleScaffold, SimpleEntityTable, useQuery } from "../../../components/modules/ModuleKit";
import { RequireAnyPermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/workforce/positions")({
  component: WorkforcePositionsPage,
});

function WorkforcePositionsPage() {
  return (
    <RequireAnyPermission permissions={["workforce.employees.view", "workforce.sites.view", "workforce.schedules.view"]}>
      <WorkforcePositionsBody />
    </RequireAnyPermission>
  );
}

function WorkforcePositionsBody() {
  const { session, api } = useSession();
  const workspaceId = session?.memberships[0]?.workspace_id;
  const query = useQuery({
    queryKey: ["workforce-positions", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listWorkforcePositions(workspaceId!),
  });
  const rows = (query.data?.items ?? []).map((row) => ({
    id: row.id,
    title: row.name,
    meta: row.code || undefined,
    status: row.is_active ? "active" : "inactive",
  }));

  return (
    <ModuleScaffold title={he.workforcePositionsTitle} lead={he.workforcePositionsLead}>
      {query.isError ? (
        <ErrorState title={he.workforceLoadError} description={he.workforceLoadErrorHint} />
      ) : query.isLoading ? (
        <p className="text-sm text-fg-muted">{he.loading}</p>
      ) : rows.length ? (
        <SimpleEntityTable
          rows={rows}
          empty={he.workforcePositionsEmpty}
          statusLabel={(status) => (status === "active" ? he.workforceStatusActive : he.workforceInactive)}
          leadingIcon={Briefcase}
        />
      ) : (
        <EmptyRows message={he.workforcePositionsEmpty} />
      )}
    </ModuleScaffold>
  );
}
