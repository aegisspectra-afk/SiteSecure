import { createFileRoute } from "@tanstack/react-router";
import { useFleetDepartment } from "../../../components/fleet/FleetDepartmentContext";
import { EmptyRows, ErrorState, ModuleScaffold, useQuery } from "../../../components/modules/ModuleKit";
import { he } from "../../../i18n/he";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/fleet/access")({
  component: FleetAccessPage,
});

function FleetAccessPage() {
  const { api } = useSession();
  const { workspaceId } = useFleetDepartment();

  const accessQuery = useQuery({
    queryKey: ["fleet-my-access", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getFleetMyAccess(workspaceId),
  });

  if (accessQuery.isError) return <ErrorState title={he.fleetError} />;

  const data = accessQuery.data;

  return (
    <ModuleScaffold title={he.fleetAccessTitle} lead={he.fleetAccessLead}>
      {accessQuery.isLoading || !data ? (
        <p className="ss-module-empty-text">{he.fleetLoading}</p>
      ) : (
        <div className="space-y-4">
          <div className="fleet-stat-grid">
            <div className="fleet-stat-card">
              <div className="fleet-stat-label">{he.fleetAccessRole}</div>
              <div className="fleet-stat-value text-base">{data.role_key}</div>
            </div>
            <div className="fleet-stat-card">
              <div className="fleet-stat-label">{he.fleetAccessDepartments}</div>
              <div className="fleet-stat-value text-base">
                {data.managerial ? he.fleetAccessManagerial : he.fleetAccessLimited}
              </div>
            </div>
          </div>

          <section className="space-y-2">
            <h2 className="text-base font-semibold">{he.fleetAccessDepartments}</h2>
            {data.departments.length === 0 ? (
              <EmptyRows message={he.fleetAccessEmpty} />
            ) : (
              <ul className="ss-module-mobile-list">
                {data.departments.map((dept) => (
                  <li key={dept.id} className="ss-module-mobile-row is-static">
                    <div className="font-medium">{dept.name_he}</div>
                    <div className="ss-module-empty-text">{dept.key}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold">{he.fleetAccessPermissions}</h2>
            {data.permissions.length === 0 ? (
              <EmptyRows message={he.fleetEmpty} />
            ) : (
              <ul className="ss-module-mobile-list">
                {data.permissions.map((perm) => (
                  <li key={perm} className="ss-module-mobile-row is-static">
                    {perm}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </ModuleScaffold>
  );
}
