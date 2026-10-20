import { Link, createFileRoute } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { useFleetDepartment } from "../../../components/fleet/FleetDepartmentContext";
import { vehicleTitle } from "../../../components/fleet/fleet-labels";
import { EmptyRows, ErrorState, ModuleScaffold, useQuery } from "../../../components/modules/ModuleKit";
import { he } from "../../../i18n/he";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/fleet/equipment")({
  component: FleetEquipmentPage,
});

function FleetEquipmentPage() {
  const { api } = useSession();
  const { workspaceId, departmentId } = useFleetDepartment();

  const vehiclesQuery = useQuery({
    queryKey: ["fleet-vehicles", workspaceId, departmentId, "equip"],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listFleetVehicles(workspaceId, { department_id: departmentId, limit: 50 }),
  });

  const vehicles = vehiclesQuery.data?.items ?? [];

  const equipQueries = useQueries({
    queries: vehicles.map((v) => ({
      queryKey: ["fleet-vehicle-equipment", workspaceId, v.id],
      enabled: Boolean(workspaceId) && vehicles.length > 0,
      queryFn: () => api.listFleetVehicleEquipment(workspaceId, v.id, { limit: 50 }),
    })),
  });

  const rows = useMemo(() => {
    const out: Array<{
      id: string;
      vehicleId: string;
      plate: string;
      name: string;
      type: string;
      serial: string;
      status: string;
    }> = [];
    equipQueries.forEach((q, idx) => {
      const vehicle = vehicles[idx];
      if (!vehicle || !q.data?.items) return;
      for (const item of q.data.items) {
        out.push({
          id: item.id,
          vehicleId: vehicle.id,
          plate: vehicle.license_plate,
          name: item.name,
          type: item.equipment_type,
          serial: item.serial_number ?? "—",
          status: item.status,
        });
      }
    });
    return out;
  }, [equipQueries, vehicles]);

  if (vehiclesQuery.isError) return <ErrorState title={he.fleetError} />;

  const loading = vehiclesQuery.isLoading || equipQueries.some((q) => q.isLoading);

  return (
    <ModuleScaffold title={he.fleetEquipmentTitle} lead={he.fleetEquipmentLead}>
      {loading ? (
        <p className="ss-module-empty-text">{he.fleetLoading}</p>
      ) : rows.length === 0 ? (
        vehicles.length === 0 ? (
          <EmptyRows message={he.fleetEquipmentEmpty} />
        ) : (
          <ul className="ss-module-mobile-list">
            {vehicles.map((v) => (
              <li key={v.id}>
                <Link
                  to="/app/fleet/vehicles/$vehicleId"
                  params={{ vehicleId: v.id }}
                  search={{ departmentId, tab: "equipment" }}
                  className="ss-module-mobile-row"
                >
                  <div className="font-medium">{vehicleTitle(v)}</div>
                  <div className="ss-module-empty-text">{he.fleetEquipmentAdd}</div>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : (
        <ul className="ss-module-mobile-list">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                to="/app/fleet/vehicles/$vehicleId"
                params={{ vehicleId: row.vehicleId }}
                search={{ departmentId, tab: "equipment" }}
                className="ss-module-mobile-row"
              >
                <div className="font-medium">{row.name}</div>
                <div className="ss-module-empty-text">
                  {row.plate} · {row.type} · {row.serial} · {row.status}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ModuleScaffold>
  );
}
