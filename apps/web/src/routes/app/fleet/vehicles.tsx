import { ApiClientError } from "@site-secure/api-client";
import { Button, Select, Table, TBody, TD, TH, THead, TR } from "@site-secure/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useFleetDepartment } from "../../../components/fleet/FleetDepartmentContext";
import {
  FleetVehicleForm,
  toVehiclePayload,
  type FleetVehicleFormValues,
} from "../../../components/fleet/FleetVehicleForm";
import { FleetMaintenanceBadge, FleetStatusBadge } from "../../../components/fleet/FleetStatusBadge";
import {
  computeMaintenanceStatus,
  formatKm,
  vehicleTitle,
} from "../../../components/fleet/fleet-labels";
import {
  EmptyRows,
  ErrorState,
  ModuleScaffold,
  SearchCreateBar,
  useMutation,
  useQuery,
} from "../../../components/modules/ModuleKit";
import { he } from "../../../i18n/he";
import { can } from "../../../lib/can";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/fleet/vehicles")({
  component: FleetVehiclesPage,
});

function FleetVehiclesPage() {
  const { session, api } = useSession();
  const queryClient = useQueryClient();
  const { workspaceId, departmentId, departments } = useFleetDepartment();
  const membership = session?.memberships[0];
  const features = membership?.features ?? [];
  const roleKey = membership?.role_key;
  const canCreate = can(roleKey, "fleet.create", features);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["fleet-vehicles", workspaceId, departmentId, q, status],
    enabled: Boolean(workspaceId),
    queryFn: () =>
      api.listFleetVehicles(workspaceId, {
        department_id: departmentId,
        q: q || undefined,
        status: status || undefined,
        limit: 100,
      }),
  });

  const create = useMutation({
    mutationFn: (values: FleetVehicleFormValues) =>
      api.createFleetVehicle(workspaceId, toVehiclePayload(values)),
    onSuccess: async () => {
      setCreating(false);
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ["fleet-vehicles", workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ["fleet-dashboard", workspaceId] });
    },
    onError: (err) => setFormError(err instanceof ApiClientError ? err.message : he.fleetError),
  });

  const filtered = listQuery.data?.items ?? [];

  if (listQuery.isError) return <ErrorState title={he.fleetError} />;

  return (
    <ModuleScaffold title={he.fleetVehiclesTitle} lead={he.fleetVehiclesLead}>
      <SearchCreateBar
        query={q}
        onQuery={setQ}
        canCreate={canCreate}
        creating={creating}
        onToggleCreate={() => {
          setCreating((v) => !v);
          setFormError(null);
        }}
        createLabel={he.fleetVehicleCreate}
      />
      <div className="ss-module-toolbar">
        <Select
          id="fleet-vehicles-status"
          label={he.fleetStatus}
          value={status}
          onChange={(ev) => setStatus(ev.target.value)}
        >
          <option value="">{he.all}</option>
          {Object.entries(he.fleetVehicleStatuses).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      {creating ? (
        <FleetVehicleForm
          departments={departments}
          defaultDepartmentId={departmentId}
          pending={create.isPending}
          error={formError}
          submitLabel={he.fleetVehicleSave}
          onCancel={() => setCreating(false)}
          onSubmit={(values) => create.mutate(values)}
        />
      ) : null}

      {listQuery.isLoading ? (
        <p className="ss-module-empty-text">{he.fleetLoading}</p>
      ) : filtered.length === 0 ? (
        <EmptyRows message={he.fleetVehiclesEmpty} />
      ) : (
        <>
          <ul className="ss-module-mobile-list md:hidden">
            {filtered.map((row) => (
              <li key={row.id}>
                <Link
                  to="/app/fleet/vehicles/$vehicleId"
                  params={{ vehicleId: row.id }}
                  search={{ departmentId }}
                  className="ss-module-mobile-row"
                >
                  <div className="font-medium">{vehicleTitle(row)}</div>
                  <div className="ss-module-empty-text">{formatKm(row.current_mileage)}</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <FleetStatusBadge status={row.status} />
                    <FleetMaintenanceBadge status={computeMaintenanceStatus(row)} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>{he.fleetLicensePlate}</TH>
                  <TH>{he.fleetManufacturer}</TH>
                  <TH>{he.fleetCurrentMileage}</TH>
                  <TH>{he.fleetStatus}</TH>
                  <TH>{he.fleetNavMaintenance}</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {filtered.map((row) => (
                  <TR key={row.id}>
                    <TD>{row.license_plate}</TD>
                    <TD>{[row.manufacturer, row.model].filter(Boolean).join(" ") || "—"}</TD>
                    <TD>{formatKm(row.current_mileage)}</TD>
                    <TD>
                      <FleetStatusBadge status={row.status} />
                    </TD>
                    <TD>
                      <FleetMaintenanceBadge status={computeMaintenanceStatus(row)} />
                    </TD>
                    <TD>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to="/app/fleet/vehicles/$vehicleId"
                          params={{ vehicleId: row.id }}
                          search={{ departmentId }}
                        >
                          <Button type="button" variant="secondary">
                            {he.fleetVehicleView}
                          </Button>
                        </Link>
                        <Link
                          to="/app/fleet/vehicles/$vehicleId"
                          params={{ vehicleId: row.id }}
                          search={{ departmentId, tab: "mileage" }}
                        >
                          <Button type="button" variant="secondary">
                            {he.fleetVehicleMileageAction}
                          </Button>
                        </Link>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </>
      )}
    </ModuleScaffold>
  );
}
