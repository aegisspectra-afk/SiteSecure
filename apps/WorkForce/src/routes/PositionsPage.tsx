import { RequireAnyPermission } from "../components/RequirePermission";
import { EmptyRows, ErrorState, ModuleScaffold, SimpleEntityTable, useQuery } from "../components/Kit";
import { he } from "../i18n/he";
import { useSession } from "../lib/session";

export function PositionsPage() {
  return (
    <RequireAnyPermission permissions={["workforce.employees.view", "workforce.sites.view", "workforce.schedules.view"]}>
      <PositionsBody />
    </RequireAnyPermission>
  );
}

function PositionsBody() {
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
    <ModuleScaffold title={he.positionsTitle} lead={he.positionsLead}>
      {query.isError ? (
        <ErrorState title={he.loadError} description={he.loadErrorHint} />
      ) : query.isLoading ? (
        <p className="text-sm text-fg-muted">{he.loading}</p>
      ) : rows.length ? (
        <SimpleEntityTable
          rows={rows}
          empty={he.positionsEmpty}
          statusLabel={(status) => (status === "active" ? he.statusActive : he.inactive)}
        />
      ) : (
        <EmptyRows message={he.positionsEmpty} />
      )}
    </ModuleScaffold>
  );
}
