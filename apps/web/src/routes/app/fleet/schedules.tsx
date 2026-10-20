import { ApiClientError } from "@site-secure/api-client";
import { Button, Select } from "@site-secure/ui";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useFleetDepartment } from "../../../components/fleet/FleetDepartmentContext";
import { EmptyRows, ErrorState, Input, ModuleScaffold, useMutation, useQuery } from "../../../components/modules/ModuleKit";
import { he } from "../../../i18n/he";
import { can } from "../../../lib/can";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/fleet/schedules")({
  component: FleetSchedulesPage,
});

function FleetSchedulesPage() {
  const { session, api } = useSession();
  const queryClient = useQueryClient();
  const { workspaceId, departmentId, departments } = useFleetDepartment();
  const membership = session?.memberships[0];
  const canSched = can(membership?.role_key, "fleet.schedules", membership?.features ?? []);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("16:00");
  const [shift, setShift] = useState("");
  const [location, setLocation] = useState("");
  const deptId = departmentId ?? departments[0]?.id ?? "";

  const listQuery = useQuery({
    queryKey: ["fleet-schedules", workspaceId, departmentId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listFleetSchedules(workspaceId, { department_id: departmentId, limit: 100 }),
  });

  const membersQuery = useQuery({
    queryKey: ["members", workspaceId],
    enabled: Boolean(workspaceId) && creating,
    queryFn: () => api.listMembers(workspaceId),
  });

  const vehiclesQuery = useQuery({
    queryKey: ["fleet-vehicles", workspaceId, departmentId, "sched"],
    enabled: Boolean(workspaceId) && creating,
    queryFn: () => api.listFleetVehicles(workspaceId, { department_id: departmentId, limit: 100 }),
  });

  const create = useMutation({
    mutationFn: () =>
      api.createFleetSchedule(workspaceId, {
        department_id: deptId,
        user_id: userId,
        vehicle_id: vehicleId || null,
        schedule_date: date,
        start_time: start,
        end_time: end,
        shift_label: shift.trim() || null,
        location: location.trim() || null,
      }),
    onSuccess: async () => {
      setCreating(false);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["fleet-schedules", workspaceId] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : he.fleetError),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteFleetSchedule(workspaceId, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["fleet-schedules", workspaceId] });
    },
  });

  if (listQuery.isError) return <ErrorState title={he.fleetError} />;

  return (
    <ModuleScaffold
      title={he.fleetSchedulesTitle}
      lead={he.fleetSchedulesLead}
      action={
        canSched ? (
          <Button type="button" variant={creating ? "secondary" : "primary"} onClick={() => setCreating((v) => !v)}>
            {creating ? he.cancel : he.fleetScheduleCreate}
          </Button>
        ) : null
      }
    >
      {creating ? (
        <form
          className="ss-module-create"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (!deptId || !userId || !date) return;
            create.mutate();
          }}
        >
          {error ? <p role="alert">{error}</p> : null}
          <Select
            id="sched-user"
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
          <Select
            id="sched-vehicle"
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
          <Input id="sched-date" label={he.fleetScheduleDate} type="date" value={date} onChange={(ev) => setDate(ev.target.value)} />
          <Input id="sched-start" label={he.fleetScheduleStart} type="time" value={start} onChange={(ev) => setStart(ev.target.value)} />
          <Input id="sched-end" label={he.fleetScheduleEnd} type="time" value={end} onChange={(ev) => setEnd(ev.target.value)} />
          <Input id="sched-shift" label={he.fleetScheduleShift} value={shift} onChange={(ev) => setShift(ev.target.value)} />
          <Input
            id="sched-loc"
            label={he.fleetScheduleLocation}
            value={location}
            onChange={(ev) => setLocation(ev.target.value)}
          />
          <Button type="submit" disabled={create.isPending}>
            {he.save}
          </Button>
        </form>
      ) : null}

      {listQuery.isLoading ? (
        <p className="ss-module-empty-text">{he.fleetLoading}</p>
      ) : (listQuery.data?.items ?? []).length === 0 ? (
        <EmptyRows message={he.fleetSchedulesEmpty} />
      ) : (
        <ul className="ss-module-mobile-list">
          {(listQuery.data?.items ?? []).map((row) => (
            <li key={row.id} className="ss-module-mobile-row is-static">
              <div className="font-medium">
                {row.schedule_date} · {row.start_time}–{row.end_time}
              </div>
              <div className="ss-module-empty-text">
                {row.user_name ?? row.user_id}
                {row.license_plate ? ` · ${row.license_plate}` : ""}
                {row.shift_label ? ` · ${row.shift_label}` : ""}
                {row.location ? ` · ${row.location}` : ""}
              </div>
              {canSched ? (
                <Button type="button" variant="secondary" onClick={() => remove.mutate(row.id)}>
                  {he.cancel}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </ModuleScaffold>
  );
}
