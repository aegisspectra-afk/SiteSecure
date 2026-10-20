import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useFleetDepartment } from "../../../components/fleet/FleetDepartmentContext";
import { formatKm } from "../../../components/fleet/fleet-labels";
import { EmptyRows, ErrorState, ModuleScaffold, useQuery } from "../../../components/modules/ModuleKit";
import { he } from "../../../i18n/he";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/fleet/")({
  component: FleetDashboardPage,
});

function FleetDashboardPage() {
  const { api } = useSession();
  const { workspaceId, departmentId, setDepartmentId, departmentsError } = useFleetDepartment();
  const navigate = useNavigate();

  const dashQuery = useQuery({
    queryKey: ["fleet-dashboard", workspaceId, departmentId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getFleetDashboard(workspaceId, { department_id: departmentId }),
  });

  if (departmentsError || dashQuery.isError) return <ErrorState title={he.fleetError} />;
  if (dashQuery.isLoading) {
    return (
      <ModuleScaffold title={he.fleetDashboardTitle} lead={he.fleetDashboardLead}>
        <p className="ss-module-empty-text">{he.fleetLoading}</p>
      </ModuleScaffold>
    );
  }

  const data = dashQuery.data;
  if (!data) {
    return (
      <ModuleScaffold title={he.fleetDashboardTitle} lead={he.fleetDashboardLead}>
        <EmptyRows message={he.fleetEmpty} />
      </ModuleScaffold>
    );
  }

  const stats = [
    { label: he.fleetStatTotal, value: String(data.total_vehicles) },
    { label: he.fleetStatDue, value: String(data.maintenance_due) },
    { label: he.fleetStatSoon, value: String(data.maintenance_soon) },
    { label: he.fleetStatTest, value: String(data.expiring_tests) },
    { label: he.fleetStatInsurance, value: String(data.expiring_insurance) },
    { label: he.fleetStatMileage, value: formatKm(data.total_mileage) },
  ];

  return (
    <ModuleScaffold title={he.fleetDashboardTitle} lead={he.fleetDashboardLead}>
      <div className="fleet-stat-grid">
        {stats.map((stat) => (
          <div key={stat.label} className="fleet-stat-card">
            <div className="fleet-stat-label">{stat.label}</div>
            <div className="fleet-stat-value">{stat.value}</div>
          </div>
        ))}
      </div>

      {data.by_department?.length ? (
        <section className="space-y-2">
          <h2 className="text-base font-semibold">{he.fleetByDepartment}</h2>
          <div className="fleet-stat-grid">
            {data.by_department.map((row) => (
              <button
                key={row.department_id}
                type="button"
                className="fleet-stat-card fleet-stat-card-btn"
                onClick={() => {
                  setDepartmentId(row.department_id);
                  void navigate({
                    to: "/app/fleet/vehicles",
                    search: { departmentId: row.department_id },
                  });
                }}
              >
                <div className="fleet-stat-label">{row.name_he}</div>
                <div className="fleet-stat-value">{row.count}</div>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-base font-semibold">{he.fleetRecentMileage}</h2>
        {(data.recent_mileage ?? []).length === 0 ? (
          <EmptyRows message={he.fleetMileageEmpty} />
        ) : (
          <ul className="ss-module-mobile-list">
            {(data.recent_mileage ?? []).map((log) => (
              <li key={log.id} className="ss-module-mobile-row is-static">
                <div className="font-medium">{log.license_plate ?? log.vehicle_id}</div>
                <div className="ss-module-empty-text">
                  {formatKm(log.mileage)} · +{formatKm(log.distance_since_previous)} ·{" "}
                  {new Date(log.recorded_at).toLocaleString("he-IL")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </ModuleScaffold>
  );
}
