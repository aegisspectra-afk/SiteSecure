import { ApiClientError } from "@site-secure/api-client";
import { Button, Select } from "@site-secure/ui";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useFleetDepartment } from "../../../components/fleet/FleetDepartmentContext";
import { EmptyRows, ErrorState, ModuleScaffold, useMutation, useQuery } from "../../../components/modules/ModuleKit";
import { he } from "../../../i18n/he";
import { can } from "../../../lib/can";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/fleet/assignments")({
  component: FleetAssignmentsPage,
});

function FleetAssignmentsPage() {
  const { session, api } = useSession();
  const queryClient = useQueryClient();
  const { workspaceId, departmentId } = useFleetDepartment();
  const membership = session?.memberships[0];
  const canAssign = can(membership?.role_key, "fleet.assignments", membership?.features ?? []);
  const [creating, setCreating] = useState(false);
  const [vehicleId, setVehicleId] = useState("");
  const [userId, setUserId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const vehiclesQuery = useQuery({
    queryKey: ["fleet-vehicles", workspaceId, departmentId, "assign"],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listFleetVehicles(workspaceId, { department_id: departmentId, limit: 50 }),
  });

  const membersQuery = useQuery({
    queryKey: ["members", workspaceId],
    enabled: Boolean(workspaceId) && creating,
    queryFn: () => api.listMembers(workspaceId),
  });

  const vehicles = vehiclesQuery.data?.items ?? [];

  const assignQueries = useQueries({
    queries: vehicles.map((v) => ({
      queryKey: ["fleet-vehicle-assignments", workspaceId, v.id],
      enabled: Boolean(workspaceId) && vehicles.length > 0,
      queryFn: () => api.listFleetAssignments(workspaceId, v.id, { limit: 20 }),
    })),
  });

  const history = useMemo(() => {
    const out: Array<{
      id: string;
      vehicleId: string;
      plate: string;
      user: string;
      starts: string;
      ends: string | null;
    }> = [];
    assignQueries.forEach((q, idx) => {
      const vehicle = vehicles[idx];
      if (!vehicle || !q.data?.items) return;
      for (const item of q.data.items) {
        out.push({
          id: item.id,
          vehicleId: vehicle.id,
          plate: vehicle.license_plate,
          user: item.user_name ?? item.user_id,
          starts: item.starts_at,
          ends: item.ends_at ?? null,
        });
      }
    });
    return out.sort((a, b) => b.starts.localeCompare(a.starts));
  }, [assignQueries, vehicles]);

  const create = useMutation({
    mutationFn: () => api.createFleetAssignment(workspaceId, vehicleId, { user_id: userId }),
    onSuccess: async () => {
      setCreating(false);
      setError(null);
      setUserId("");
      setVehicleId("");
      await queryClient.invalidateQueries({ queryKey: ["fleet-vehicle-assignments", workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ["fleet-vehicles", workspaceId] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : he.fleetError),
  });

  const end = useMutation({
    mutationFn: (assignmentId: string) => api.endFleetAssignment(workspaceId, assignmentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["fleet-vehicle-assignments", workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ["fleet-vehicles", workspaceId] });
    },
  });

  if (vehiclesQuery.isError) return <ErrorState title={he.fleetError} />;

  const loading = vehiclesQuery.isLoading || assignQueries.some((q) => q.isLoading);

  return (
    <ModuleScaffold
      title={he.fleetAssignmentsTitle}
      lead={he.fleetAssignmentsLead}
      action={
        canAssign ? (
          <Button type="button" variant={creating ? "secondary" : "primary"} onClick={() => setCreating((v) => !v)}>
            {creating ? he.cancel : he.fleetAssignmentCreate}
          </Button>
        ) : null
      }
    >
      {creating ? (
        <form
          className="ss-module-create"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (!vehicleId || !userId) return;
            create.mutate();
          }}
        >
          {error ? <p role="alert">{error}</p> : null}
          <Select
            id="assign-vehicle"
            label={he.fleetPickVehicle}
            value={vehicleId}
            onChange={(ev) => setVehicleId(ev.target.value)}
          >
            <option value="">—</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.license_plate}
              </option>
            ))}
          </Select>
          <Select
            id="assign-user"
            label={he.fleetAssignmentUser}
            value={userId}
            onChange={(ev) => setUserId(ev.target.value)}
          >
            <option value="">—</option>
            {(membersQuery.data ?? []).map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.full_name || m.email || m.user_id}
              </option>
            ))}
          </Select>
          <Button type="submit" disabled={create.isPending}>
            {he.save}
          </Button>
        </form>
      ) : null}

      {loading ? (
        <p className="ss-module-empty-text">{he.fleetLoading}</p>
      ) : history.length === 0 ? (
        <EmptyRows message={he.fleetAssignmentsEmpty} />
      ) : (
        <ul className="ss-module-mobile-list">
          {history.map((row) => (
            <li key={row.id} className="ss-module-mobile-row is-static">
              <Link
                to="/app/fleet/vehicles/$vehicleId"
                params={{ vehicleId: row.vehicleId }}
                search={{ departmentId, tab: "assignments" }}
                className="font-medium"
              >
                {row.plate}
              </Link>
              <div className="ss-module-empty-text">
                {row.user} · {new Date(row.starts).toLocaleString("he-IL")}
                {row.ends ? ` → ${new Date(row.ends).toLocaleString("he-IL")}` : ""}
              </div>
              {canAssign && !row.ends ? (
                <Button type="button" variant="secondary" onClick={() => end.mutate(row.id)}>
                  {he.fleetAssignmentEnd}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </ModuleScaffold>
  );
}
