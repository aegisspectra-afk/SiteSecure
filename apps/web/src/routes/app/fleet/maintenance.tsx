import { ApiClientError } from "@site-secure/api-client";
import { Button, Select } from "@site-secure/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useFleetDepartment } from "../../../components/fleet/FleetDepartmentContext";
import { FleetMaintenanceBadge } from "../../../components/fleet/FleetStatusBadge";
import {
  computeMaintenanceStatus,
  formatKm,
  vehicleTitle,
} from "../../../components/fleet/fleet-labels";
import { EmptyRows, ErrorState, Input, ModuleScaffold, useMutation, useQuery } from "../../../components/modules/ModuleKit";
import { he } from "../../../i18n/he";
import { can } from "../../../lib/can";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/fleet/maintenance")({
  component: FleetMaintenancePage,
});

function FleetMaintenancePage() {
  const { session, api } = useSession();
  const queryClient = useQueryClient();
  const { workspaceId, departmentId } = useFleetDepartment();
  const membership = session?.memberships[0];
  const canMaint = can(membership?.role_key, "fleet.maintenance", membership?.features ?? []);
  const [vehicleId, setVehicleId] = useState("");
  const [type, setType] = useState("service");
  const [mileage, setMileage] = useState("");
  const [nextMileage, setNextMileage] = useState("");
  const [provider, setProvider] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const vehiclesQuery = useQuery({
    queryKey: ["fleet-vehicles", workspaceId, departmentId, "maint"],
    enabled: Boolean(workspaceId),
    queryFn: () =>
      api.listFleetVehicles(workspaceId, { department_id: departmentId, limit: 100 }),
  });

  const needing = useMemo(
    () =>
      (vehiclesQuery.data?.items ?? []).filter((v) => {
        const st = computeMaintenanceStatus(v);
        return st === "due" || st === "soon";
      }),
    [vehiclesQuery.data?.items],
  );

  const create = useMutation({
    mutationFn: () =>
      api.createFleetMaintenance(workspaceId, vehicleId, {
        maintenance_type: type,
        mileage: mileage ? Number(mileage) : null,
        next_mileage: nextMileage ? Number(nextMileage) : null,
        provider: provider.trim() || null,
        update_vehicle: true,
      }),
    onSuccess: async () => {
      setCreating(false);
      setError(null);
      setVehicleId("");
      setMileage("");
      setNextMileage("");
      setProvider("");
      await queryClient.invalidateQueries({ queryKey: ["fleet-vehicles", workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ["fleet-dashboard", workspaceId] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : he.fleetError),
  });

  if (vehiclesQuery.isError) return <ErrorState title={he.fleetError} />;

  return (
    <ModuleScaffold
      title={he.fleetMaintenanceTitle}
      lead={he.fleetMaintenanceLead}
      action={
        canMaint ? (
          <Button type="button" variant={creating ? "secondary" : "primary"} onClick={() => setCreating((v) => !v)}>
            {creating ? he.cancel : he.fleetMaintenanceAdd}
          </Button>
        ) : null
      }
    >
      {creating ? (
        <form
          className="ss-module-create"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (!vehicleId) return;
            create.mutate();
          }}
        >
          {error ? <p role="alert">{error}</p> : null}
          <Select
            id="maint-vehicle"
            label={he.fleetPickVehicle}
            value={vehicleId}
            onChange={(ev) => setVehicleId(ev.target.value)}
          >
            <option value="">—</option>
            {(vehiclesQuery.data?.items ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.license_plate}
              </option>
            ))}
          </Select>
          <Input id="maint-type" label={he.fleetMaintenanceType} value={type} onChange={(ev) => setType(ev.target.value)} />
          <Input
            id="maint-km"
            label={he.fleetCurrentMileage}
            type="number"
            value={mileage}
            onChange={(ev) => setMileage(ev.target.value)}
          />
          <Input
            id="maint-next"
            label={he.fleetNextServiceMileage}
            type="number"
            value={nextMileage}
            onChange={(ev) => setNextMileage(ev.target.value)}
          />
          <Input
            id="maint-provider"
            label={he.fleetMaintenanceProvider}
            value={provider}
            onChange={(ev) => setProvider(ev.target.value)}
          />
          <Button type="submit" disabled={create.isPending}>
            {he.save}
          </Button>
        </form>
      ) : null}

      {vehiclesQuery.isLoading ? (
        <p className="ss-module-empty-text">{he.fleetLoading}</p>
      ) : needing.length === 0 ? (
        <EmptyRows message={he.fleetMaintenanceEmpty} />
      ) : (
        <ul className="ss-module-mobile-list">
          {needing.map((row) => (
            <li key={row.id}>
              <Link
                to="/app/fleet/vehicles/$vehicleId"
                params={{ vehicleId: row.id }}
                search={{ departmentId, tab: "maintenance" }}
                className="ss-module-mobile-row"
              >
                <div className="font-medium">{vehicleTitle(row)}</div>
                <div className="ss-module-empty-text">{formatKm(row.current_mileage)}</div>
                <div className="mt-1">
                  <FleetMaintenanceBadge status={computeMaintenanceStatus(row)} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ModuleScaffold>
  );
}
