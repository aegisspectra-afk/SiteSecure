import { ApiClientError } from "@site-secure/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useFleetDepartment } from "../../../components/fleet/FleetDepartmentContext";
import { FleetMileageForm } from "../../../components/fleet/FleetMileageForm";
import { FleetStatusBadge } from "../../../components/fleet/FleetStatusBadge";
import { formatKm, vehicleTitle } from "../../../components/fleet/fleet-labels";
import { EmptyRows, ErrorState, ModuleScaffold, useMutation, useQuery } from "../../../components/modules/ModuleKit";
import { he } from "../../../i18n/he";
import { can } from "../../../lib/can";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/fleet/my-vehicle")({
  component: FleetMyVehiclePage,
});

function FleetMyVehiclePage() {
  const { session, api } = useSession();
  const queryClient = useQueryClient();
  const { workspaceId } = useFleetDepartment();
  const membership = session?.memberships[0];
  const canMileage = can(membership?.role_key, "fleet.mileage", membership?.features ?? []);
  const [formError, setFormError] = useState<string | null>(null);

  const myQuery = useQuery({
    queryKey: ["fleet-my-vehicle", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getFleetMyVehicle(workspaceId),
  });

  const update = useMutation({
    mutationFn: (body: { mileage: number; notes?: string }) =>
      api.updateFleetMileage(workspaceId, myQuery.data!.id, body),
    onSuccess: async () => {
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ["fleet-my-vehicle", workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ["fleet-mileage", workspaceId] });
    },
    onError: (err) => setFormError(err instanceof ApiClientError ? err.message : he.fleetError),
  });

  if (myQuery.isError) return <ErrorState title={he.fleetError} />;

  const vehicle = myQuery.data;

  return (
    <ModuleScaffold title={he.fleetMyVehicleTitle} lead={he.fleetMyVehicleLead}>
      {myQuery.isLoading ? (
        <p className="ss-module-empty-text">{he.fleetLoading}</p>
      ) : !vehicle ? (
        <EmptyRows message={he.fleetMyVehicleEmpty} />
      ) : (
        <div className="fleet-my-vehicle space-y-4">
          <div className="fleet-stat-card">
            <div className="font-semibold text-lg">{vehicleTitle(vehicle)}</div>
            <div className="ss-module-empty-text mt-1">{formatKm(vehicle.current_mileage)}</div>
            <div className="mt-2">
              <FleetStatusBadge status={vehicle.status} />
            </div>
          </div>
          {canMileage ? (
            <FleetMileageForm
              currentMileage={vehicle.current_mileage}
              pending={update.isPending}
              error={formError}
              compact
              onSubmit={(body) => update.mutate(body)}
            />
          ) : null}
        </div>
      )}
    </ModuleScaffold>
  );
}
