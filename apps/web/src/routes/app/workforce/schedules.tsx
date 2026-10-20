import { ApiClientError, type WorkforceShiftOut } from "@site-secure/api-client";
import { Input, Select } from "@site-secure/ui";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import {
  Button,
  CreatePanel,
  EmptyRows,
  ErrorState,
  ModuleScaffold,
  useMutation,
  useQuery,
} from "../../../components/modules/ModuleKit";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { can } from "../../../lib/can";
import { useSession } from "../../../lib/session";
import {
  addDays,
  formatDayHeading,
  formatTimeRange,
  formatWeekLabel,
  fromDateTimeLocal,
  startOfWeekSunday,
  toDateTimeLocal,
  toIso,
  weekDays,
} from "../../../lib/workforce-week";

export const Route = createFileRoute("/app/workforce/schedules")({
  component: WorkforceSchedulesPage,
});

function WorkforceSchedulesPage() {
  return (
    <RequirePermission permission="workforce.schedules.view">
      <WorkforceSchedulesBody />
    </RequirePermission>
  );
}

function WorkforceSchedulesBody() {
  const { session, api } = useSession();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const grants = membership?.permissions ?? null;
  const features = membership?.features ?? [];
  const canEdit = can(membership?.role_key, "workforce.schedules.edit", features, grants);
  const [weekStart, setWeekStart] = useState(() => startOfWeekSunday(new Date()));
  const [success, setSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [notes, setNotes] = useState("");

  const weekEnd = addDays(weekStart, 7);
  const days = weekDays(weekStart);

  const shiftsQuery = useQuery({
    queryKey: ["workforce-shifts", workspaceId, weekStart.toISOString()],
    enabled: Boolean(workspaceId),
    queryFn: () =>
      api.listWorkforceShifts(workspaceId!, { startsFrom: toIso(weekStart), startsTo: toIso(weekEnd) }),
  });
  const lookups = useQuery({
    queryKey: ["workforce-lookups", workspaceId],
    enabled: Boolean(workspaceId && canEdit),
    queryFn: () => api.listWorkforceLookups(workspaceId!),
  });
  const employeesQuery = useQuery({
    queryKey: ["workforce-employees", workspaceId, "schedule"],
    enabled: Boolean(workspaceId && canEdit),
    queryFn: () => api.listWorkforceEmployees(workspaceId!, { status: "active" }),
  });

  const resetForm = () => {
    setEmployeeId("");
    setSiteId("");
    setPositionId("");
    setStartsAt("");
    setEndsAt("");
    setNotes("");
    setEditingId(null);
    setFormError(null);
  };

  const fillFromShift = (row: WorkforceShiftOut) => {
    setEditingId(row.id);
    setCreating(true);
    setEmployeeId(row.employee_id ?? "");
    setSiteId(row.site_id ?? "");
    setPositionId(row.position_id ?? "");
    setStartsAt(toDateTimeLocal(row.starts_at));
    setEndsAt(toDateTimeLocal(row.ends_at));
    setNotes(row.notes ?? "");
    setFormError(null);
    setSuccess(null);
  };

  const save = useMutation({
    mutationFn: () => {
      const body = {
        employee_id: employeeId,
        site_id: siteId,
        position_id: positionId || null,
        starts_at: fromDateTimeLocal(startsAt),
        ends_at: fromDateTimeLocal(endsAt),
        notes: notes.trim() || null,
      };
      return editingId
        ? api.patchWorkforceShift(workspaceId!, editingId, body)
        : api.createWorkforceShift(workspaceId!, body);
    },
    onSuccess: async () => {
      setSuccess(editingId ? he.workforceShiftUpdated : he.workforceShiftCreated);
      setCreating(false);
      resetForm();
      await shiftsQuery.refetch();
    },
    onError: (err) => {
      setFormError(err instanceof ApiClientError ? err.message : he.workforceLoadError);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteWorkforceShift(workspaceId!, id),
    onSuccess: async () => {
      setSuccess(he.workforceShiftDeleted);
      await shiftsQuery.refetch();
    },
    onError: (err) => {
      setFormError(err instanceof ApiClientError ? err.message : he.workforceLoadError);
    },
  });

  const shiftsByDay = useMemo(() => {
    const buckets = new Map<string, WorkforceShiftOut[]>();
    for (const day of days) {
      buckets.set(day.toDateString(), []);
    }
    for (const row of shiftsQuery.data?.items ?? []) {
      const key = new Date(row.starts_at).toDateString();
      const list = buckets.get(key);
      if (list) list.push(row);
    }
    return buckets;
  }, [days, shiftsQuery.data]);

  const employees = employeesQuery.data?.items ?? [];
  const sites = (lookups.data?.sites ?? []).filter((item) => item.is_active);
  const positions = (lookups.data?.positions ?? []).filter((item) => item.is_active);

  return (
    <ModuleScaffold title={he.workforceSchedulesTitle} lead={he.workforceSchedulesLead}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            {he.workforceWeekPrev}
          </Button>
          <Button type="button" onClick={() => setWeekStart(startOfWeekSunday(new Date()))}>
            {he.workforceWeekThis}
          </Button>
          <Button type="button" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            {he.workforceWeekNext}
          </Button>
        </div>
        <p className="text-sm text-fg-muted">{formatWeekLabel(weekStart)}</p>
        {canEdit ? (
          <Button
            type="button"
            onClick={() => {
              setCreating((value) => !value);
              resetForm();
              setSuccess(null);
            }}
          >
            {creating ? he.cancel : he.workforceCreateShift}
          </Button>
        ) : null}
      </div>
      {success ? (
        <p className="text-sm text-success" role="status">
          {success}
        </p>
      ) : null}
      <CreatePanel
        open={creating && canEdit}
        pending={save.isPending}
        error={formError}
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2" data-testid="workforce-shift-form">
          <Select
            id="wf-shift-employee"
            label={he.workforceNavEmployees}
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
            required
          >
            <option value="">{he.workforceLookupNone}</option>
            {employees.map((row) => (
              <option key={row.id} value={row.id}>
                {`${row.first_name} ${row.last_name}`.trim()}
              </option>
            ))}
          </Select>
          <Select
            id="wf-shift-site"
            label={he.workforceFieldSite}
            value={siteId}
            onChange={(event) => setSiteId(event.target.value)}
            required
          >
            <option value="">{he.workforceLookupNone}</option>
            {sites.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </Select>
          <Select
            id="wf-shift-position"
            label={he.workforceFieldPosition}
            value={positionId}
            onChange={(event) => setPositionId(event.target.value)}
          >
            <option value="">{he.workforceLookupNone}</option>
            {positions.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </Select>
          <Input
            id="wf-shift-start"
            label={he.workforceFieldStarts}
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            required
          />
          <Input
            id="wf-shift-end"
            label={he.workforceFieldEnds}
            type="datetime-local"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            required
          />
          <Input
            id="wf-shift-notes"
            label={he.workforceFieldNotes}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
      </CreatePanel>
      {shiftsQuery.isError ? (
        <ErrorState title={he.workforceLoadError} description={he.workforceLoadErrorHint} />
      ) : shiftsQuery.isLoading ? (
        <p className="text-sm text-fg-muted">{he.loading}</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-7" data-testid="workforce-week-board">
          {days.map((day) => {
            const items = shiftsByDay.get(day.toDateString()) ?? [];
            return (
              <section key={day.toISOString()} className="rounded-[var(--radius-control)] border border-border p-3">
                <h2 className="mb-2 text-sm font-semibold text-fg">{formatDayHeading(day)}</h2>
                {items.length ? (
                  <ul className="grid gap-2">
                    {items.map((row) => (
                      <li key={row.id} className="rounded-[var(--radius-control)] bg-bg-1 p-2 text-sm">
                        <p className="font-medium text-fg">{row.employee_name || he.workforceNavEmployees}</p>
                        <p className="text-xs text-fg-muted">{formatTimeRange(row.starts_at, row.ends_at)}</p>
                        <p className="text-xs text-fg-muted">
                          {[row.site_name, row.region_name, row.position_name].filter(Boolean).join(" · ")}
                        </p>
                        {canEdit ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button type="button" onClick={() => fillFromShift(row)}>
                              {he.workforceEditAction}
                            </Button>
                            <Button
                              type="button"
                              onClick={() => {
                                if (!window.confirm(he.workforceConfirmDeleteShift)) return;
                                remove.mutate(row.id);
                              }}
                            >
                              {he.workforceDeleteAction}
                            </Button>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-fg-muted">{he.workforceSchedulesEmpty}</p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </ModuleScaffold>
  );
}
