import { ApiClientError } from "@site-secure/api-client";
import { Select } from "@site-secure/ui";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useFleetDepartment } from "../../../components/fleet/FleetDepartmentContext";
import { FleetMileageForm } from "../../../components/fleet/FleetMileageForm";
import { formatKm } from "../../../components/fleet/fleet-labels";
import { EmptyRows, ErrorState, ModuleScaffold, useMutation, useQuery } from "../../../components/modules/ModuleKit";
import { he } from "../../../i18n/he";
import { can } from "../../../lib/can";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/fleet/mileage")({
  component: FleetMileagePage,
});

function FleetMileagePage() {
  const { session, api } = useSession();
  const queryClient = useQueryClient();
  const { workspaceId, departmentId } = useFleetDepartment();
  const membership = session?.memberships[0];
  const canMileage = can(membership?.role_key, "fleet.mileage", membership?.features ?? []);
  const [vehicleId, setVehicleId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const vehiclesQuery = useQuery({
    queryKey: ["fleet-vehicles", workspaceId, departmentId, "mileage-pick"],
    enabled: Boolean(workspaceId) && canMileage,
    queryFn: () =>
      api.listFleetVehicles(workspaceId, { department_id: departmentId, limit: 100 }),
  });

  const logsQuery = useQuery({
    queryKey: ["fleet-mileage", workspaceId, departmentId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listFleetMileage(workspaceId, { department_id: departmentId, limit: 50 }),
  });

  const selected = (vehiclesQuery.data?.items ?? []).find((v) => v.id === vehicleId);

  const update = useMutation({
    mutationFn: (body: { mileage: number; notes?: string }) =>
      api.updateFleetMileage(workspaceId, vehicleId, body),
    onSuccess: async () => {
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ["fleet-mileage", workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ["fleet-vehicles", workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ["fleet-dashboard", workspaceId] });
    },
    onError: (err) => setFormError(err instanceof ApiClientError ? err.message : he.fleetError),
  });

  if (logsQuery.isError) return <ErrorState title={he.fleetError} />;

  return (
    <ModuleScaffold title={he.fleetMileageTitle} lead={he.fleetMileageLead}>
      {canMileage ? (
        <div className="ss-module-create space-y-3">
          <Select
            id="fleet-mileage-vehicle"
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
          {selected ? (
            <FleetMileageForm
              currentMileage={selected.current_mileage}
              pending={update.isPending}
              error={formError}
              onSubmit={(body) => update.mutate(body)}
            />
          ) : null}
        </div>
      ) : null}

      {logsQuery.isLoading ? (
        <p className="ss-module-empty-text">{he.fleetLoading}</p>
      ) : (logsQuery.data?.items ?? []).length === 0 ? (
        <EmptyRows message={he.fleetMileageEmpty} />
      ) : (
        <ul className="ss-module-mobile-list">
          {(logsQuery.data?.items ?? []).map((log) => (
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
    </ModuleScaffold>
  );
}
