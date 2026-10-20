import { ApiClientError } from "@site-secure/api-client";
import { Button } from "@site-secure/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useFleetDepartment } from "../../../components/fleet/FleetDepartmentContext";
import { FleetMileageForm } from "../../../components/fleet/FleetMileageForm";
import {
  FleetExpiryBadge,
  FleetMaintenanceBadge,
  FleetStatusBadge,
} from "../../../components/fleet/FleetStatusBadge";
import {
  FleetVehicleForm,
  toVehiclePayload,
  type FleetVehicleFormValues,
} from "../../../components/fleet/FleetVehicleForm";
import {
  computeMaintenanceStatus,
  formatKm,
  vehicleTitle,
} from "../../../components/fleet/fleet-labels";
import { EmptyRows, ErrorState, Input, ModuleScaffold, useMutation, useQuery } from "../../../components/modules/ModuleKit";
import { he } from "../../../i18n/he";
import { can } from "../../../lib/can";
import { useSession } from "../../../lib/session";

const TABS = [
  "overview",
  "mileage",
  "maintenance",
  "documents",
  "equipment",
  "assignments",
  "notes",
] as const;

type Tab = (typeof TABS)[number];

export const Route = createFileRoute("/app/fleet/vehicles/$vehicleId")({
  validateSearch: (search: Record<string, unknown>): { departmentId?: string; tab?: Tab } => {
    const out: { departmentId?: string; tab?: Tab } = {};
    if (typeof search.departmentId === "string" && search.departmentId) {
      out.departmentId = search.departmentId;
    }
    if (typeof search.tab === "string" && TABS.includes(search.tab as Tab)) {
      out.tab = search.tab as Tab;
    }
    return out;
  },
  component: FleetVehicleDetailPage,
});

function FleetVehicleDetailPage() {
  const { vehicleId } = Route.useParams();
  const search = Route.useSearch();
  const tab = search.tab ?? "overview";
  const navigate = useNavigate();
  const { session, api } = useSession();
  const queryClient = useQueryClient();
  const { workspaceId, departments, departmentId } = useFleetDepartment();
  const membership = session?.memberships[0];
  const features = membership?.features ?? [];
  const roleKey = membership?.role_key;
  const canEdit = can(roleKey, "fleet.edit", features);
  const canMileage = can(roleKey, "fleet.mileage", features);
  const canMaintenance = can(roleKey, "fleet.maintenance", features);
  const canEquipment = can(roleKey, "fleet.equipment", features);
  const canAssignments = can(roleKey, "fleet.assignments", features);
  const canDelete = can(roleKey, "fleet.delete", features);
  const [editing, setEditing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [mileageError, setMileageError] = useState<string | null>(null);
  const [maintType, setMaintType] = useState("service");
  const [maintMileage, setMaintMileage] = useState("");
  const [maintNext, setMaintNext] = useState("");
  const [maintProvider, setMaintProvider] = useState("");
  const [maintDesc, setMaintDesc] = useState("");
  const [eqName, setEqName] = useState("");
  const [eqType, setEqType] = useState("");
  const [eqSerial, setEqSerial] = useState("");
  const [assignUserId, setAssignUserId] = useState("");
  const [notesDraft, setNotesDraft] = useState<string | null>(null);

  const vehicleQuery = useQuery({
    queryKey: ["fleet-vehicle", workspaceId, vehicleId],
    enabled: Boolean(workspaceId && vehicleId),
    queryFn: () => api.getFleetVehicle(workspaceId, vehicleId),
  });

  const mileageQuery = useQuery({
    queryKey: ["fleet-vehicle-mileage", workspaceId, vehicleId],
    enabled: Boolean(workspaceId && vehicleId) && tab === "mileage",
    queryFn: () => api.listFleetVehicleMileage(workspaceId, vehicleId, { limit: 50 }),
  });

  const maintQuery = useQuery({
    queryKey: ["fleet-vehicle-maintenance", workspaceId, vehicleId],
    enabled: Boolean(workspaceId && vehicleId) && tab === "maintenance",
    queryFn: () => api.listFleetVehicleMaintenance(workspaceId, vehicleId, { limit: 50 }),
  });

  const docsQuery = useQuery({
    queryKey: ["fleet-vehicle-docs", workspaceId, vehicleId],
    enabled: Boolean(workspaceId && vehicleId) && tab === "documents",
    queryFn: () =>
      api.listDocuments(workspaceId, { entity_type: "vehicle", entity_id: vehicleId, limit: 100 }),
  });

  const equipQuery = useQuery({
    queryKey: ["fleet-vehicle-equipment", workspaceId, vehicleId],
    enabled: Boolean(workspaceId && vehicleId) && tab === "equipment",
    queryFn: () => api.listFleetVehicleEquipment(workspaceId, vehicleId, { limit: 50 }),
  });

  const assignQuery = useQuery({
    queryKey: ["fleet-vehicle-assignments", workspaceId, vehicleId],
    enabled: Boolean(workspaceId && vehicleId) && tab === "assignments",
    queryFn: () => api.listFleetAssignments(workspaceId, vehicleId, { limit: 50 }),
  });

  const membersQuery = useQuery({
    queryKey: ["members", workspaceId],
    enabled: Boolean(workspaceId) && tab === "assignments" && canAssignments,
    queryFn: () => api.listMembers(workspaceId),
  });

  const patchVehicle = useMutation({
    mutationFn: (values: FleetVehicleFormValues) =>
      api.patchFleetVehicle(workspaceId, vehicleId, toVehiclePayload(values)),
    onSuccess: async () => {
      setEditing(false);
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ["fleet-vehicle", workspaceId, vehicleId] });
      await queryClient.invalidateQueries({ queryKey: ["fleet-vehicles", workspaceId] });
    },
    onError: (err) => setFormError(err instanceof ApiClientError ? err.message : he.fleetError),
  });

  const archive = useMutation({
    mutationFn: () => api.archiveFleetVehicle(workspaceId, vehicleId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["fleet-vehicles", workspaceId] });
      void navigate({ to: "/app/fleet/vehicles", search: { departmentId } });
    },
  });

  const updateMileage = useMutation({
    mutationFn: (body: { mileage: number; notes?: string }) =>
      api.updateFleetMileage(workspaceId, vehicleId, body),
    onSuccess: async () => {
      setMileageError(null);
      await queryClient.invalidateQueries({ queryKey: ["fleet-vehicle", workspaceId, vehicleId] });
      await queryClient.invalidateQueries({ queryKey: ["fleet-vehicle-mileage", workspaceId, vehicleId] });
      await queryClient.invalidateQueries({ queryKey: ["fleet-mileage", workspaceId] });
    },
    onError: (err) => setMileageError(err instanceof ApiClientError ? err.message : he.fleetError),
  });

  const createMaint = useMutation({
    mutationFn: () =>
      api.createFleetMaintenance(workspaceId, vehicleId, {
        maintenance_type: maintType,
        mileage: maintMileage ? Number(maintMileage) : null,
        next_mileage: maintNext ? Number(maintNext) : null,
        provider: maintProvider.trim() || null,
        description: maintDesc.trim() || null,
        update_vehicle: true,
      }),
    onSuccess: async () => {
      setMaintDesc("");
      setMaintProvider("");
      setMaintMileage("");
      setMaintNext("");
      await queryClient.invalidateQueries({ queryKey: ["fleet-vehicle-maintenance", workspaceId, vehicleId] });
      await queryClient.invalidateQueries({ queryKey: ["fleet-vehicle", workspaceId, vehicleId] });
    },
  });

  const createEquip = useMutation({
    mutationFn: () =>
      api.createFleetEquipment(workspaceId, vehicleId, {
        name: eqName.trim(),
        equipment_type: eqType.trim() || "other",
        serial_number: eqSerial.trim() || null,
      }),
    onSuccess: async () => {
      setEqName("");
      setEqType("");
      setEqSerial("");
      await queryClient.invalidateQueries({ queryKey: ["fleet-vehicle-equipment", workspaceId, vehicleId] });
    },
  });

  const createAssign = useMutation({
    mutationFn: () => api.createFleetAssignment(workspaceId, vehicleId, { user_id: assignUserId }),
    onSuccess: async () => {
      setAssignUserId("");
      await queryClient.invalidateQueries({ queryKey: ["fleet-vehicle-assignments", workspaceId, vehicleId] });
      await queryClient.invalidateQueries({ queryKey: ["fleet-vehicle", workspaceId, vehicleId] });
    },
  });

  const endAssign = useMutation({
    mutationFn: (assignmentId: string) => api.endFleetAssignment(workspaceId, assignmentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["fleet-vehicle-assignments", workspaceId, vehicleId] });
      await queryClient.invalidateQueries({ queryKey: ["fleet-vehicle", workspaceId, vehicleId] });
    },
  });

  const saveNotes = useMutation({
    mutationFn: (notes: string) => api.patchFleetVehicle(workspaceId, vehicleId, { notes: notes || null }),
    onSuccess: async () => {
      setNotesDraft(null);
      await queryClient.invalidateQueries({ queryKey: ["fleet-vehicle", workspaceId, vehicleId] });
    },
  });

  if (vehicleQuery.isError) return <ErrorState title={he.fleetError} />;
  if (vehicleQuery.isLoading || !vehicleQuery.data) {
    return (
      <ModuleScaffold title={he.fleetVehicleDetail}>
        <p className="ss-module-empty-text">{he.fleetLoading}</p>
      </ModuleScaffold>
    );
  }

  const vehicle = vehicleQuery.data;

  function setTab(next: Tab) {
    void navigate({
      to: "/app/fleet/vehicles/$vehicleId",
      params: { vehicleId },
      search: { departmentId: search.departmentId ?? departmentId, tab: next },
      replace: true,
    });
  }

  return (
    <ModuleScaffold
      title={vehicleTitle(vehicle)}
      lead={he.fleetVehicleDetail}
      action={
        <Link to="/app/fleet/vehicles" search={{ departmentId: search.departmentId ?? departmentId }}>
          <Button type="button" variant="secondary">
            {he.fleetBack}
          </Button>
        </Link>
      }
    >
      <div className="flex flex-wrap gap-2">
        <FleetStatusBadge status={vehicle.status} />
        <FleetMaintenanceBadge status={computeMaintenanceStatus(vehicle)} />
        <FleetExpiryBadge date={vehicle.test_expiry_date} />
        <FleetExpiryBadge date={vehicle.insurance_expiry_date} />
      </div>

      <nav className="fleet-subnav" aria-label={he.fleetVehicleDetail}>
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "fleet-subnav-link is-active" : "fleet-subnav-link"}
            onClick={() => setTab(id)}
          >
            {
              {
                overview: he.fleetTabOverview,
                mileage: he.fleetTabMileage,
                maintenance: he.fleetTabMaintenance,
                documents: he.fleetTabDocuments,
                equipment: he.fleetTabEquipment,
                assignments: he.fleetTabAssignments,
                notes: he.fleetTabNotes,
              }[id]
            }
          </button>
        ))}
      </nav>

      {tab === "overview" ? (
        <div className="space-y-4">
          <div className="fleet-stat-grid">
            <div className="fleet-stat-card">
              <div className="fleet-stat-label">{he.fleetCurrentMileage}</div>
              <div className="fleet-stat-value">{formatKm(vehicle.current_mileage)}</div>
            </div>
            <div className="fleet-stat-card">
              <div className="fleet-stat-label">{he.fleetNextServiceMileage}</div>
              <div className="fleet-stat-value">{formatKm(vehicle.next_service_mileage)}</div>
            </div>
            <div className="fleet-stat-card">
              <div className="fleet-stat-label">{he.fleetTestExpiry}</div>
              <div className="fleet-stat-value">{vehicle.test_expiry_date ?? "—"}</div>
            </div>
            <div className="fleet-stat-card">
              <div className="fleet-stat-label">{he.fleetInsuranceExpiry}</div>
              <div className="fleet-stat-value">{vehicle.insurance_expiry_date ?? "—"}</div>
            </div>
          </div>
          {canEdit ? (
            editing ? (
              <FleetVehicleForm
                departments={departments}
                initial={vehicle}
                pending={patchVehicle.isPending}
                error={formError}
                submitLabel={he.fleetVehicleSave}
                onCancel={() => setEditing(false)}
                onSubmit={(values) => patchVehicle.mutate(values)}
              />
            ) : (
              <div className="ss-module-toolbar">
                <Button type="button" onClick={() => setEditing(true)}>
                  {he.fleetVehicleEdit}
                </Button>
                {canDelete && !vehicle.archived_at ? (
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => {
                      if (window.confirm(he.fleetVehicleArchiveConfirm)) archive.mutate();
                    }}
                  >
                    {he.fleetVehicleArchive}
                  </Button>
                ) : null}
              </div>
            )
          ) : null}
        </div>
      ) : null}

      {tab === "mileage" ? (
        <div className="space-y-4">
          {canMileage ? (
            <FleetMileageForm
              currentMileage={vehicle.current_mileage}
              pending={updateMileage.isPending}
              error={mileageError}
              onSubmit={(body) => updateMileage.mutate(body)}
            />
          ) : null}
          {(mileageQuery.data?.items ?? []).length === 0 ? (
            <EmptyRows message={he.fleetMileageEmpty} />
          ) : (
            <ul className="ss-module-mobile-list">
              {(mileageQuery.data?.items ?? []).map((log) => (
                <li key={log.id} className="ss-module-mobile-row is-static">
                  <div className="font-medium">{formatKm(log.mileage)}</div>
                  <div className="ss-module-empty-text">
                    +{formatKm(log.distance_since_previous)} · {new Date(log.recorded_at).toLocaleString("he-IL")}
                    {log.notes ? ` · ${log.notes}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "maintenance" ? (
        <div className="space-y-4">
          {canMaintenance ? (
            <form
              className="ss-module-create"
              onSubmit={(ev) => {
                ev.preventDefault();
                createMaint.mutate();
              }}
            >
              <Input
                id="maint-type"
                label={he.fleetMaintenanceType}
                value={maintType}
                onChange={(ev) => setMaintType(ev.target.value)}
              />
              <Input
                id="maint-mileage"
                label={he.fleetCurrentMileage}
                type="number"
                value={maintMileage}
                onChange={(ev) => setMaintMileage(ev.target.value)}
              />
              <Input
                id="maint-next"
                label={he.fleetNextServiceMileage}
                type="number"
                value={maintNext}
                onChange={(ev) => setMaintNext(ev.target.value)}
              />
              <Input
                id="maint-provider"
                label={he.fleetMaintenanceProvider}
                value={maintProvider}
                onChange={(ev) => setMaintProvider(ev.target.value)}
              />
              <Input
                id="maint-desc"
                label={he.notes}
                value={maintDesc}
                onChange={(ev) => setMaintDesc(ev.target.value)}
              />
              <Button type="submit" disabled={createMaint.isPending}>
                {he.fleetMaintenanceAdd}
              </Button>
            </form>
          ) : null}
          {(maintQuery.data?.items ?? []).length === 0 ? (
            <EmptyRows message={he.fleetEmpty} />
          ) : (
            <ul className="ss-module-mobile-list">
              {(maintQuery.data?.items ?? []).map((row) => (
                <li key={row.id} className="ss-module-mobile-row is-static">
                  <div className="font-medium">
                    {row.maintenance_type} · {row.performed_on}
                  </div>
                  <div className="ss-module-empty-text">
                    {formatKm(row.mileage)} · {row.provider ?? "—"} · {row.description ?? ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "documents" ? (
        (docsQuery.data?.items ?? []).length === 0 ? (
          <EmptyRows message={he.fleetDocumentsEmpty} />
        ) : (
          <ul className="ss-module-mobile-list">
            {(docsQuery.data?.items ?? []).map((doc) => (
              <li key={doc.id} className="ss-module-mobile-row is-static">
                <div className="font-medium">{doc.original_filename ?? doc.kind}</div>
                <div className="ss-module-empty-text">{new Date(doc.created_at).toLocaleString("he-IL")}</div>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {tab === "equipment" ? (
        <div className="space-y-4">
          {canEquipment ? (
            <form
              className="ss-module-create"
              onSubmit={(ev) => {
                ev.preventDefault();
                if (!eqName.trim()) return;
                createEquip.mutate();
              }}
            >
              <Input id="eq-name" label={he.fleetEquipmentName} value={eqName} onChange={(ev) => setEqName(ev.target.value)} />
              <Input id="eq-type" label={he.fleetEquipmentType} value={eqType} onChange={(ev) => setEqType(ev.target.value)} />
              <Input
                id="eq-serial"
                label={he.fleetEquipmentSerial}
                value={eqSerial}
                onChange={(ev) => setEqSerial(ev.target.value)}
              />
              <Button type="submit" disabled={createEquip.isPending}>
                {he.fleetEquipmentAdd}
              </Button>
            </form>
          ) : null}
          {(equipQuery.data?.items ?? []).length === 0 ? (
            <EmptyRows message={he.fleetEquipmentEmpty} />
          ) : (
            <ul className="ss-module-mobile-list">
              {(equipQuery.data?.items ?? []).map((row) => (
                <li key={row.id} className="ss-module-mobile-row is-static">
                  <div className="font-medium">{row.name}</div>
                  <div className="ss-module-empty-text">
                    {row.equipment_type} · {row.serial_number ?? "—"} · {row.status}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "assignments" ? (
        <div className="space-y-4">
          {canAssignments ? (
            <form
              className="ss-module-create"
              onSubmit={(ev) => {
                ev.preventDefault();
                if (!assignUserId) return;
                createAssign.mutate();
              }}
            >
              <label className="block text-sm">
                <span className="mb-1 block">{he.fleetAssignmentUser}</span>
                <select
                  className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-1)] px-3 py-2"
                  value={assignUserId}
                  onChange={(ev) => setAssignUserId(ev.target.value)}
                >
                  <option value="">—</option>
                  {(membersQuery.data ?? []).map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.full_name || m.email || m.user_id}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" disabled={createAssign.isPending}>
                {he.fleetAssignmentCreate}
              </Button>
            </form>
          ) : null}
          {(assignQuery.data?.items ?? []).length === 0 ? (
            <EmptyRows message={he.fleetAssignmentsEmpty} />
          ) : (
            <ul className="ss-module-mobile-list">
              {(assignQuery.data?.items ?? []).map((row) => (
                <li key={row.id} className="ss-module-mobile-row is-static">
                  <div className="font-medium">{row.user_name ?? row.user_id}</div>
                  <div className="ss-module-empty-text">
                    {new Date(row.starts_at).toLocaleString("he-IL")}
                    {row.ends_at ? ` → ${new Date(row.ends_at).toLocaleString("he-IL")}` : ` · ${he.fleetAssignmentEnd}`}
                  </div>
                  {canAssignments && !row.ends_at ? (
                    <Button type="button" variant="secondary" onClick={() => endAssign.mutate(row.id)}>
                      {he.fleetAssignmentEnd}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "notes" ? (
        <div className="space-y-3">
          {canEdit ? (
            <>
              <textarea
                className="w-full min-h-32 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-1)] p-3"
                value={notesDraft ?? vehicle.notes ?? ""}
                onChange={(ev) => setNotesDraft(ev.target.value)}
              />
              <Button
                type="button"
                disabled={saveNotes.isPending}
                onClick={() => saveNotes.mutate(notesDraft ?? vehicle.notes ?? "")}
              >
                {he.save}
              </Button>
            </>
          ) : (
            <p className="ss-module-empty-text">{vehicle.notes || he.fleetEmpty}</p>
          )}
        </div>
      ) : null}
    </ModuleScaffold>
  );
}
