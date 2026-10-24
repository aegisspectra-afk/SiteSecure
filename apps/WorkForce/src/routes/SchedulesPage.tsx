import { ApiClientError, type WorkforceIssue, type WorkforceShiftOut, type WorkforceSlotOut } from "@site-secure/api-client";
import { Input, Select } from "@site-secure/ui";
import { useMemo, useState, type FormEvent } from "react";
import { RequirePermission } from "../components/RequirePermission";
import { Button, CreatePanel, EmptyRows, ErrorState, ModuleScaffold, useMutation, useQuery } from "../components/Kit";
import { he } from "../i18n/he";
import { can } from "../lib/can";
import { queryErrorDescription } from "../lib/query-error";
import {
  assignmentMatchesFilters,
  assignmentsForSlot,
  boardFilterOptions,
  employeeDisplayName,
  employeeMatchesQuery,
  fillLabel,
  issueHeadline,
  issuesForTarget,
  looseAssignments,
  occupancyCounts,
  occupancyTotals,
  slotMatchesFilters,
  splitIssues,
  type BoardFilters,
  type BoardStatusFilter,
} from "../lib/schedule-board";
import { useSession } from "../lib/session";
import {
  addDays,
  crossesLocalMidnight,
  formatDayHeading,
  formatTimeRange,
  formatWeekLabel,
  fromDateTimeLocal,
  rangeOverlapsDay,
  startOfWeekSunday,
  toDateTimeLocal,
  toIso,
  weekDays,
} from "../lib/week";

type Selected = { kind: "slot" | "assignment"; id: string };

export function SchedulesPage() {
  return (
    <RequirePermission permission="workforce.schedules.view">
      <SchedulesBody />
    </RequirePermission>
  );
}

function SchedulesBody() {
  const { session, api } = useSession();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const grants = membership?.permissions ?? null;
  const features = membership?.features ?? [];
  const canEdit = can(membership?.role_key, "workforce.schedules.edit", features, grants);
  const canSites = can(membership?.role_key, "workforce.sites.view", features, grants);
  const [weekStart, setWeekStart] = useState(() => startOfWeekSunday(new Date()));
  const [filters, setFilters] = useState<BoardFilters>({ siteId: "", positionId: "", status: "all" });
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [selected, setSelected] = useState<Selected | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [creatingSlot, setCreatingSlot] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [slotId, setSlotId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [notes, setNotes] = useState("");
  const [slotSiteId, setSlotSiteId] = useState("");
  const [slotPositionId, setSlotPositionId] = useState("");
  const [slotStartsAt, setSlotStartsAt] = useState("");
  const [slotEndsAt, setSlotEndsAt] = useState("");
  const [slotCount, setSlotCount] = useState("1");

  const weekEnd = addDays(weekStart, 7);
  const days = weekDays(weekStart);
  const weekKey = weekStart.toISOString();

  const weekQuery = useQuery({
    queryKey: ["workforce-week", workspaceId, weekKey],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listWorkforceWeek(workspaceId!, { startsFrom: toIso(weekStart), startsTo: toIso(weekEnd) }),
  });
  const validateQuery = useQuery({
    queryKey: ["workforce-validate-week", workspaceId, weekKey],
    enabled: Boolean(workspaceId && weekQuery.isSuccess),
    queryFn: () => api.validateWorkforceWeek(workspaceId!, { startsFrom: toIso(weekStart), startsTo: toIso(weekEnd) }),
  });
  const lookups = useQuery({
    queryKey: ["workforce-lookups", workspaceId],
    enabled: Boolean(workspaceId && canEdit),
    queryFn: () => api.listWorkforceLookups(workspaceId!),
  });
  const sitesQuery = useQuery({
    queryKey: ["workforce-sites", workspaceId, "schedule"],
    enabled: Boolean(workspaceId && canSites),
    queryFn: () => api.listWorkforceSites(workspaceId!),
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
    setSlotId("");
    setStartsAt("");
    setEndsAt("");
    setNotes("");
    setEditingId(null);
    setEditingSlotId(null);
    setFormError(null);
    setEmployeeQuery("");
  };

  const resetSlotForm = () => {
    setEditingSlotId(null);
    setSlotSiteId("");
    setSlotPositionId("");
    setSlotStartsAt("");
    setSlotEndsAt("");
    setSlotCount("1");
    setFormError(null);
  };

  const fillFromShift = (row: WorkforceShiftOut) => {
    setEditingId(row.id);
    setCreating(true);
    setCreatingSlot(false);
    setSelected({ kind: "assignment", id: row.id });
    setEmployeeId(row.employee_id ?? "");
    setSiteId(row.site_id ?? "");
    setPositionId(row.position_id ?? "");
    setSlotId(row.slot_id ?? "");
    setStartsAt(toDateTimeLocal(row.starts_at));
    setEndsAt(toDateTimeLocal(row.ends_at));
    setNotes(row.notes ?? "");
    setFormError(null);
    setSuccess(null);
  };

  const fillFromSlot = (row: WorkforceSlotOut) => {
    setCreating(true);
    setCreatingSlot(false);
    setEditingId(null);
    setEditingSlotId(null);
    setSelected({ kind: "slot", id: row.id });
    setSlotId(row.id);
    setSiteId(row.site_id ?? "");
    setPositionId(row.position_id ?? "");
    setStartsAt(toDateTimeLocal(row.starts_at));
    setEndsAt(toDateTimeLocal(row.ends_at));
    setFormError(null);
    setSuccess(null);
  };

  const fillSlotForEdit = (row: WorkforceSlotOut) => {
    setCreatingSlot(true);
    setCreating(false);
    setEditingId(null);
    setEditingSlotId(row.id);
    setSelected({ kind: "slot", id: row.id });
    setSlotSiteId(row.site_id ?? "");
    setSlotPositionId(row.position_id ?? "");
    setSlotStartsAt(toDateTimeLocal(row.starts_at));
    setSlotEndsAt(toDateTimeLocal(row.ends_at));
    setSlotCount(String(row.required_count));
    setFormError(null);
    setSuccess(null);
  };

  const refreshBoard = async () => {
    await Promise.all([weekQuery.refetch(), validateQuery.refetch()]);
  };

  const save = useMutation({
    mutationFn: () => {
      const body = {
        employee_id: employeeId,
        site_id: siteId,
        position_id: positionId || null,
        slot_id: slotId || null,
        starts_at: fromDateTimeLocal(startsAt),
        ends_at: fromDateTimeLocal(endsAt),
        notes: notes.trim() || null,
      };
      return editingId
        ? api.patchWorkforceShift(workspaceId!, editingId, body)
        : api.createWorkforceShift(workspaceId!, body);
    },
    onSuccess: async () => {
      setSuccess(editingId ? he.shiftUpdated : he.shiftCreated);
      setCreating(false);
      resetForm();
      await refreshBoard();
    },
    onError: (err) => {
      setFormError(err instanceof ApiClientError ? err.message : he.loadError);
    },
  });

  const saveSlot = useMutation({
    mutationFn: () => {
      const body = {
        site_id: slotSiteId,
        position_id: slotPositionId,
        starts_at: fromDateTimeLocal(slotStartsAt),
        ends_at: fromDateTimeLocal(slotEndsAt),
        required_count: Number(slotCount),
      };
      return editingSlotId
        ? api.patchWorkforceSlot(workspaceId!, editingSlotId, body)
        : api.createWorkforceSlot(workspaceId!, body);
    },
    onSuccess: async () => {
      setSuccess(editingSlotId ? he.slotUpdated : he.slotCreated);
      setCreatingSlot(false);
      resetSlotForm();
      await refreshBoard();
    },
    onError: (err) => {
      setFormError(err instanceof ApiClientError ? err.message : he.loadError);
    },
  });

  const materialize = useMutation({
    mutationFn: () =>
      api.materializeWorkforceSlots(workspaceId!, { startsFrom: toIso(weekStart), startsTo: toIso(weekEnd) }),
    onSuccess: async () => {
      setSuccess(he.slotsMaterialized);
      await refreshBoard();
    },
    onError: (err) => {
      setFormError(err instanceof ApiClientError ? err.message : he.loadError);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteWorkforceShift(workspaceId!, id),
    onSuccess: async () => {
      setSuccess(he.shiftDeleted);
      setSelected(null);
      await refreshBoard();
    },
    onError: (err) => {
      setFormError(err instanceof ApiClientError ? err.message : he.loadError);
    },
  });

  const removeSlot = useMutation({
    mutationFn: (id: string) => api.deleteWorkforceSlot(workspaceId!, id),
    onSuccess: async () => {
      setSuccess(he.slotDeleted);
      setSelected(null);
      await refreshBoard();
    },
    onError: (err) => {
      setFormError(err instanceof ApiClientError ? err.message : he.loadError);
    },
  });

  const weekSlots = weekQuery.data?.slots ?? [];
  const weekAssignments = weekQuery.data?.assignments ?? [];
  const fromWeek = boardFilterOptions(weekSlots, weekAssignments);
  const catalogSites = (sitesQuery.data?.items ?? lookups.data?.sites ?? []).filter((item) => item.is_active);
  const sites = catalogSites.length
    ? uniqueById(catalogSites.map((row) => ({ id: row.id, name: row.name })))
    : fromWeek.sites;
  const lookupPositions = (lookups.data?.positions ?? []).filter((item) => item.is_active);
  const positions = lookupPositions.length
    ? lookupPositions.map((row) => ({ id: row.id, name: row.name }))
    : fromWeek.positions;
  const filterPositions = uniqueById([...fromWeek.positions, ...positions]);
  const visibleSlots = weekSlots.filter((row) => slotMatchesFilters(row, filters));
  const visibleAssignments = weekAssignments.filter((row) => assignmentMatchesFilters(row, filters));
  const totals = occupancyTotals(visibleSlots);
  const issues = validateQuery.data?.issues ?? weekQuery.data?.issues ?? [];
  const { hard, soft } = splitIssues(issues);
  const policy = validateQuery.data?.policy ?? weekQuery.data?.policy;
  const disclaimer = validateQuery.data?.compliance_disclaimer ?? he.boardLegalNote;

  const assignmentsByDay = useMemo(() => {
    const buckets = new Map<string, WorkforceShiftOut[]>();
    for (const day of days) buckets.set(day.toDateString(), []);
    for (const row of visibleAssignments) {
      for (const day of days) {
        if (!rangeOverlapsDay(row.starts_at, row.ends_at, day)) continue;
        buckets.get(day.toDateString())?.push(row);
      }
    }
    return buckets;
  }, [days, visibleAssignments]);

  const slotsByDay = useMemo(() => {
    const buckets = new Map<string, WorkforceSlotOut[]>();
    for (const day of days) buckets.set(day.toDateString(), []);
    for (const row of visibleSlots) {
      for (const day of days) {
        if (!rangeOverlapsDay(row.starts_at, row.ends_at, day)) continue;
        buckets.get(day.toDateString())?.push(row);
      }
    }
    return buckets;
  }, [days, visibleSlots]);

  const allEmployees = employeesQuery.data?.items ?? [];
  const employees = allEmployees.filter((row) => employeeMatchesQuery(row, employeeQuery));
  const selectedSlot = selected?.kind === "slot" ? weekSlots.find((row) => row.id === selected.id) ?? null : null;
  const selectedAssignment =
    selected?.kind === "assignment" ? weekAssignments.find((row) => row.id === selected.id) ?? null : null;
  const selectedIssues = issuesForTarget(issues, {
    slotId: selectedSlot?.id,
    shiftId: selectedAssignment?.id,
    employeeId: selectedAssignment?.employee_id,
  });
  const emptyWeek = !weekSlots.length && !weekAssignments.length;

  return (
    <ModuleScaffold title={he.schedulesTitle} lead={he.schedulesLead}>
      <section className="wf-ops-filters" aria-label={he.weekRange}>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="wf-ops-chip" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            {he.weekPrev}
          </button>
          <p className="text-sm font-medium text-fg">{formatWeekLabel(weekStart)}</p>
          <button type="button" className="wf-ops-chip" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            {he.weekNext}
          </button>
          <button type="button" className="wf-ops-chip" onClick={() => setWeekStart(startOfWeekSunday(new Date()))}>
            {he.weekThis}
          </button>
        </div>
        <div className="wf-schedule-filters" data-testid="workforce-schedule-filters">
          <label className="wf-ops-filter-field">
            <span>{he.filterUnit}</span>
            <select
              value={filters.siteId}
              onChange={(event) => setFilters((current) => ({ ...current, siteId: event.target.value }))}
            >
              <option value="">{he.filterAllOrg}</option>
              {sites.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <label className="wf-ops-filter-field">
            <span>{he.filterPosition}</span>
            <select
              value={filters.positionId}
              onChange={(event) => setFilters((current) => ({ ...current, positionId: event.target.value }))}
            >
              <option value="">{he.filterAllPositions}</option>
              {filterPositions.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <label className="wf-ops-filter-field">
            <span>{he.filterStatus}</span>
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({ ...current, status: event.target.value as BoardStatusFilter }))
              }
            >
              <option value="all">{he.filterAllStatuses}</option>
              <option value="gap">{he.filterStatusGap}</option>
              <option value="short">{he.filterStatusShort}</option>
              <option value="full">{he.filterStatusFull}</option>
            </select>
          </label>
        </div>
      </section>

      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => materialize.mutate()} disabled={materialize.isPending}>
            {he.materializeSlots}
          </Button>
          <Button
            type="button"
            onClick={() => {
              setCreatingSlot((value) => !value);
              setCreating(false);
              resetSlotForm();
              setSuccess(null);
            }}
          >
            {creatingSlot ? he.cancel : he.createSlot}
          </Button>
          <Button
            type="button"
            onClick={() => {
              setCreating((value) => !value);
              setCreatingSlot(false);
              resetForm();
              setSuccess(null);
            }}
          >
            {creating ? he.cancel : he.createShift}
          </Button>
        </div>
      ) : null}

      {success ? (
        <p className="text-sm text-success" role="status">
          {success}
        </p>
      ) : null}
      {formError && !creating && !creatingSlot ? (
        <p className="text-sm text-danger" role="alert">
          {formError}
        </p>
      ) : null}

      {weekQuery.isSuccess ? (
        <div className="wf-kpi-grid" data-testid="workforce-schedule-kpis">
          <Kpi label={he.occupancyRequired} value={String(totals.required)} />
          <Kpi label={he.occupancyAssigned} value={String(totals.assigned)} />
          <Kpi label={he.occupancyMissing} value={String(totals.missing)} />
          <Kpi label={he.issueHard} value={String(hard.length)} />
        </div>
      ) : null}

      <section className="wf-ops-panel" data-testid="workforce-validate-week">
        <div className="wf-ops-panel-head">
          <h2 className="wf-ops-heading">{he.boardValidationTitle}</h2>
          {policy?.rest_rule_enabled ? <p className="text-xs text-fg-muted">{he.restPolicyOn}</p> : null}
        </div>
        {validateQuery.isError ? (
          <p className="text-sm text-fg-muted">{queryErrorDescription(validateQuery.error)}</p>
        ) : hard.length || soft.length ? (
          <IssueList issues={issues} />
        ) : weekQuery.isSuccess ? (
          <p className="text-sm text-fg-muted">{he.boardValidationOk}</p>
        ) : null}
        <p className="text-xs text-fg-muted">{disclaimer}</p>
        <p className="text-xs text-fg-muted">{he.boardPublishBlocked}</p>
      </section>

      <CreatePanel
        open={creatingSlot && canEdit}
        pending={saveSlot.isPending}
        error={formError}
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          saveSlot.mutate();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2" data-testid="workforce-slot-form">
          <Select id="wf-slot-site" label={he.fieldSite} value={slotSiteId} onChange={(event) => setSlotSiteId(event.target.value)} required>
            <option value="">{he.lookupNone}</option>
            {sites.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </Select>
          <Select id="wf-slot-position" label={he.fieldPosition} value={slotPositionId} onChange={(event) => setSlotPositionId(event.target.value)} required>
            <option value="">{he.lookupNone}</option>
            {positions.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </Select>
          <Input id="wf-slot-start" label={he.fieldStarts} type="datetime-local" value={slotStartsAt} onChange={(event) => setSlotStartsAt(event.target.value)} required />
          <Input id="wf-slot-end" label={he.fieldEnds} type="datetime-local" value={slotEndsAt} onChange={(event) => setSlotEndsAt(event.target.value)} required />
          <Input id="wf-slot-count" label={he.fieldRequiredCount} type="number" min={1} value={slotCount} onChange={(event) => setSlotCount(event.target.value)} />
        </div>
      </CreatePanel>
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
          <Input
            id="wf-employee-search"
            label={he.employeeSearch}
            value={employeeQuery}
            onChange={(event) => setEmployeeQuery(event.target.value)}
          />
          <Select id="wf-shift-employee" label={he.navEmployees} value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} required>
            <option value="">{allEmployees.length && !employees.length ? he.noEmployeeMatches : he.lookupNone}</option>
            {employees.map((row) => {
              const unit = sites.find((site) => site.id === row.site_id)?.name;
              return (
                <option key={row.id} value={row.id}>
                  {[employeeDisplayName(row), unit ? `${he.employeeUnit}: ${unit}` : null].filter(Boolean).join(" · ")}
                </option>
              );
            })}
          </Select>
          <Select id="wf-shift-site" label={he.fieldSite} value={siteId} onChange={(event) => setSiteId(event.target.value)} required>
            <option value="">{he.lookupNone}</option>
            {sites.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </Select>
          <Select id="wf-shift-position" label={he.fieldPosition} value={positionId} onChange={(event) => setPositionId(event.target.value)}>
            <option value="">{he.lookupNone}</option>
            {positions.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </Select>
          <Select id="wf-shift-slot" label={he.fieldSlot} value={slotId} onChange={(event) => setSlotId(event.target.value)}>
            <option value="">{he.lookupNone}</option>
            {weekSlots.map((row) => (
              <option key={row.id} value={row.id}>
                {`${row.site_name ?? he.fieldSite} · ${formatTimeRange(row.starts_at, row.ends_at)} · ${row.assigned_count}/${row.required_count}`}
              </option>
            ))}
          </Select>
          <Input id="wf-shift-start" label={he.fieldStarts} type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required />
          <Input id="wf-shift-end" label={he.fieldEnds} type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} required />
          <Input id="wf-shift-notes" label={he.fieldNotes} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
      </CreatePanel>

      {weekQuery.isError ? (
        <ErrorState title={he.loadError} description={queryErrorDescription(weekQuery.error)} />
      ) : weekQuery.isLoading ? (
        <p className="text-sm text-fg-muted">{he.loading}</p>
      ) : emptyWeek ? (
        <EmptyRows message={he.schedulesOpenHint} />
      ) : (
        <div className="wf-board" data-testid="workforce-week-board">
          {days.map((day) => {
            const daySlots = slotsByDay.get(day.toDateString()) ?? [];
            const dayAssignments = assignmentsByDay.get(day.toDateString()) ?? [];
            const unattached = looseAssignments(dayAssignments, weekSlots);
            return (
              <section key={day.toISOString()} className="wf-board-day">
                <h2>{formatDayHeading(day)}</h2>
                {daySlots.length ? (
                  <ul>
                    {daySlots.map((row) => {
                      const people = assignmentsForSlot(dayAssignments, row.id);
                      const occupancy = occupancyCounts(row);
                      const slotIssues = issuesForTarget(issues, { slotId: row.id });
                      return (
                        <li key={`slot-${row.id}-${day.toDateString()}`}>
                          <button
                            type="button"
                            className="wf-slot-card"
                            data-tone={occupancy.tone}
                            data-testid={occupancy.missing > 0 ? "workforce-unfilled-slot" : "workforce-filled-slot"}
                            onClick={() => setSelected({ kind: "slot", id: row.id })}
                          >
                            <p className="wf-slot-title">
                              {[row.site_name, row.position_name].filter(Boolean).join(" · ") || he.fieldSlot}
                            </p>
                            <p className="wf-slot-meta">
                              {formatTimeRange(row.starts_at, row.ends_at)}
                              {crossesLocalMidnight(row.starts_at, row.ends_at) ? ` · ${he.overnightShift}` : ""}
                            </p>
                            <p className="wf-slot-fill">
                              {occupancy.assigned}/{occupancy.required} · {fillLabel(occupancy.tone)}
                              {occupancy.missing > 0 ? ` · ${he.occupancyMissing} ${occupancy.missing}` : ""}
                            </p>
                            {slotIssues.length ? <p className="wf-slot-flag">{issueHeadline(slotIssues[0])}</p> : null}
                          </button>
                          {people.length ? (
                            <ul className="wf-slot-people">
                              {people.map((person) => (
                                <li key={`${person.id}-${day.toDateString()}`}>
                                  <button type="button" className="wf-person" onClick={() => setSelected({ kind: "assignment", id: person.id })}>
                                    {person.employee_name || he.navEmployees}
                                    {crossesLocalMidnight(person.starts_at, person.ends_at) ? ` · ${he.overnightShift}` : ""}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          {canEdit && occupancy.missing > 0 ? (
                            <div className="mt-2">
                              <Button type="button" onClick={() => fillFromSlot(row)}>
                                {he.fillSlot}
                              </Button>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                {unattached.length ? (
                  <ul className="wf-slot-people">
                    {unattached.map((row) => (
                      <li key={`${row.id}-${day.toDateString()}`}>
                        <button type="button" className="wf-person" onClick={() => setSelected({ kind: "assignment", id: row.id })}>
                          <span className="wf-slot-flag">{he.unattachedAssignments}</span>
                          {" · "}
                          {row.employee_name || he.navEmployees}
                          {" · "}
                          {formatTimeRange(row.starts_at, row.ends_at)}
                          {crossesLocalMidnight(row.starts_at, row.ends_at) ? ` · ${he.overnightShift}` : ""}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {daySlots.length || unattached.length ? null : <EmptyRows message={he.schedulesEmpty} />}
              </section>
            );
          })}
        </div>
      )}

      {selectedSlot || selectedAssignment ? (
        <section className="wf-ops-panel" data-testid="workforce-schedule-detail">
          <div className="wf-ops-panel-head">
            <h2 className="wf-ops-heading">{selectedSlot ? he.selectedShift : he.selectedAssignment}</h2>
            <Button type="button" onClick={() => setSelected(null)}>
              {he.closeDetails}
            </Button>
          </div>
          {selectedSlot ? (
            <ShiftDetail
              slot={selectedSlot}
              people={assignmentsForSlot(weekAssignments, selectedSlot.id)}
              issues={selectedIssues}
              canEdit={canEdit}
              onAssign={() => fillFromSlot(selectedSlot)}
              onEdit={() => fillSlotForEdit(selectedSlot)}
              onEditPerson={fillFromShift}
              onRemovePerson={(id) => {
                if (!window.confirm(he.confirmDeleteShift)) return;
                remove.mutate(id);
              }}
              onDelete={() => {
                if (!window.confirm(he.confirmDeleteSlot)) return;
                removeSlot.mutate(selectedSlot.id);
              }}
            />
          ) : selectedAssignment ? (
            <AssignmentDetail
              row={selectedAssignment}
              issues={selectedIssues}
              canEdit={canEdit}
              onEdit={() => fillFromShift(selectedAssignment)}
              onRemove={() => {
                if (!window.confirm(he.confirmDeleteShift)) return;
                remove.mutate(selectedAssignment.id);
              }}
            />
          ) : null}
        </section>
      ) : null}
    </ModuleScaffold>
  );
}

function uniqueById(rows: Array<{ id: string; name: string }>): Array<{ id: string; name: string }> {
  const seen = new Map<string, string>();
  for (const row of rows) {
    if (!seen.has(row.id)) seen.set(row.id, row.name);
  }
  return [...seen.entries()].map(([id, name]) => ({ id, name }));
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="wf-kpi-card">
      <p className="text-xs text-fg-muted">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}

function IssueList({ issues }: { issues: WorkforceIssue[] }) {
  const { hard, soft } = splitIssues(issues);
  return (
    <ul className="wf-issue-list" data-testid="workforce-week-warnings">
      {hard.map((issue, index) => (
        <li key={`hard-${issue.code}-${issue.slot_id ?? issue.employee_id ?? index}`} className="wf-issue-hard">
          {he.issueHard}: {issueHeadline(issue)}
          {issue.message && issue.message !== issueHeadline(issue) ? ` · ${issue.message}` : ""}
        </li>
      ))}
      {soft.map((issue, index) => (
        <li key={`soft-${issue.code}-${issue.slot_id ?? issue.employee_id ?? index}`} className="wf-issue-soft">
          {he.issueSoft}: {issueHeadline(issue)}
          {issue.message && issue.message !== issueHeadline(issue) ? ` · ${issue.message}` : ""}
        </li>
      ))}
    </ul>
  );
}

function ShiftDetail({
  slot,
  people,
  issues,
  canEdit,
  onAssign,
  onEdit,
  onEditPerson,
  onRemovePerson,
  onDelete,
}: {
  slot: WorkforceSlotOut;
  people: WorkforceShiftOut[];
  issues: WorkforceIssue[];
  canEdit: boolean;
  onAssign: () => void;
  onEdit: () => void;
  onEditPerson: (row: WorkforceShiftOut) => void;
  onRemovePerson: (id: string) => void;
  onDelete: () => void;
}) {
  const occupancy = occupancyCounts(slot);
  return (
    <div className="grid gap-3">
      <p className="text-sm">
        {formatTimeRange(slot.starts_at, slot.ends_at)}
        {crossesLocalMidnight(slot.starts_at, slot.ends_at) ? ` · ${he.overnightShift}` : ""}
      </p>
      <p className="text-sm text-fg-muted">{[slot.site_name, slot.position_name].filter(Boolean).join(" · ")}</p>
      <p className="text-sm">
        {occupancy.assigned}/{occupancy.required} · {fillLabel(occupancy.tone)}
        {occupancy.missing > 0 ? ` · ${he.occupancyMissing} ${occupancy.missing}` : ""}
      </p>
      {issues.length ? <IssueList issues={issues} /> : null}
      {people.length ? (
        <ul className="wf-slot-people">
          {people.map((person) => (
            <li key={person.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>{person.employee_name || he.navEmployees}</span>
              {canEdit ? (
                <span className="flex gap-2">
                  <Button type="button" onClick={() => onEditPerson(person)}>
                    {he.editAction}
                  </Button>
                  <Button type="button" onClick={() => onRemovePerson(person.id)}>
                    {he.deleteAction}
                  </Button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          {occupancy.missing > 0 ? (
            <Button type="button" onClick={onAssign}>
              {he.fillSlot}
            </Button>
          ) : null}
          <Button type="button" onClick={onEdit}>
            {he.editSlot}
          </Button>
          {people.length ? (
            <p className="text-xs text-fg-muted">{he.slotHasAssignments}</p>
          ) : (
            <Button type="button" onClick={onDelete}>
              {he.deleteAction}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function AssignmentDetail({
  row,
  issues,
  canEdit,
  onEdit,
  onRemove,
}: {
  row: WorkforceShiftOut;
  issues: WorkforceIssue[];
  canEdit: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid gap-3">
      <p className="text-sm font-medium">{row.employee_name || he.navEmployees}</p>
      <p className="text-sm">
        {formatTimeRange(row.starts_at, row.ends_at)}
        {crossesLocalMidnight(row.starts_at, row.ends_at) ? ` · ${he.overnightShift}` : ""}
      </p>
      <p className="text-sm text-fg-muted">{[row.site_name, row.region_name, row.position_name].filter(Boolean).join(" · ")}</p>
      {issues.length ? <IssueList issues={issues} /> : null}
      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onEdit}>
            {he.editAction}
          </Button>
          <Button type="button" onClick={onRemove}>
            {he.deleteAction}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
