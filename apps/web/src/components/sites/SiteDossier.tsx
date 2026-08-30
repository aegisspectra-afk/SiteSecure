import {
  ApiClientError,
  type DocumentOut,
  type EquipmentOut,
  type JobOut,
  type ServiceCallOut,
  type SystemOut,
  type WarrantyOut,
} from "@site-secure/api-client";
import { Button, ErrorState, Input, Select, Status, Tabs } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Camera, FileText, Phone, Wrench } from "lucide-react";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { addressLine } from "../modules/ModuleKit";
import { he } from "../../i18n/he";
import { can } from "../../lib/can";
import { installationStatusLabel } from "../../lib/customer-profile";
import { planQuotaMessage } from "../../lib/plan-quota";
import { quoteCreateSearch } from "../../lib/workflow-context";
import { useSession } from "../../lib/session";

type SiteTab = "overview" | "systems" | "equipment" | "service" | "documents" | "history" | "field";

function systemTypeLabel(type: string): string {
  return he.systemTypes[type as keyof typeof he.systemTypes] ?? type;
}

function systemStatusLabel(status: string): string {
  return he.systemStatuses[status as keyof typeof he.systemStatuses] ?? status;
}

function equipmentStatusLabel(status: string): string {
  return he.equipmentStatuses[status as keyof typeof he.equipmentStatuses] ?? status;
}

function equipmentCategoryLabel(category: string): string {
  return he.equipmentCategories[category as keyof typeof he.equipmentCategories] ?? category;
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("he-IL");
}

function countCategory(items: EquipmentOut[], categories: string[]): number {
  return items.filter((row) => categories.includes(row.category)).length;
}

function operationalTone(status: string | null | undefined): "success" | "warning" | "neutral" | "danger" {
  if (!status) return "neutral";
  if (status === "completed" || status === "active" || status === "installed") return "success";
  if (status === "in_progress" || status === "planned") return "warning";
  if (status === "inactive" || status === "removed" || status === "decommissioned") return "danger";
  return "neutral";
}

function groupEquipmentByLocation(items: EquipmentOut[]): { key: string; label: string; items: EquipmentOut[] }[] {
  const map = new Map<string, EquipmentOut[]>();
  for (const row of items) {
    const key = row.location_note?.trim() || "__none__";
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return [...map.entries()]
    .map(([key, groupItems]) => ({
      key,
      label: key === "__none__" ? he.siteLocationUnknown : key,
      items: groupItems,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "he"));
}

type HistoryItem = {
  id: string;
  at: string;
  title: string;
  kind: "job" | "service";
  status: string;
  href?: { to: "/app/jobs/$jobId"; params: { jobId: string } };
};

function buildHistory(jobs: JobOut[], serviceCalls: ServiceCallOut[]): HistoryItem[] {
  const rows: HistoryItem[] = [
    ...jobs.map((job) => ({
      id: `job-${job.id}`,
      at: job.completed_at || job.started_at || job.scheduled_for || job.created_at || job.updated_at || "",
      title: job.title,
      kind: "job" as const,
      status: job.status,
      href: { to: "/app/jobs/$jobId" as const, params: { jobId: job.id } },
    })),
    ...serviceCalls.map((call) => ({
      id: `svc-${call.id}`,
      at: call.updated_at || call.created_at,
      title: call.title,
      kind: "service" as const,
      status: call.status,
    })),
  ];
  return rows
    .filter((row) => row.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export function SiteDossier({ siteId }: { siteId: string }) {
  const { session, api } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const features = membership?.features ?? [];
  const roleKey = membership?.role_key;
  const canEdit = can(roleKey, "sites.edit", features);
  const canUpload = can(roleKey, "documents.upload", features);
  const canCreateQuote = can(roleKey, "quotes.create", features);
  const canSystems = can(roleKey, "systems.view", features);
  const canEditSystems = can(roleKey, "systems.edit", features);
  const canService = can(roleKey, "service.view", features);
  const canJobs = can(roleKey, "jobs.create", features);
  const canViewJobs = can(roleKey, "jobs.view", features);
  const canWarranties = can(roleKey, "warranties.view", features);

  const [tab, setTab] = useState<SiteTab>("overview");
  const [editing, setEditing] = useState(false);
  const [selectedEquipId, setSelectedEquipId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState("planned");
  const [notes, setNotes] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [systemName, setSystemName] = useState("");
  const [systemType, setSystemType] = useState("cctv");
  const [equipName, setEquipName] = useState("");
  const [equipSerial, setEquipSerial] = useState("");
  const [equipCategory, setEquipCategory] = useState("camera");
  const [equipLocation, setEquipLocation] = useState("");

  const siteQuery = useQuery({
    queryKey: ["site", workspaceId, siteId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const row = await api.getSite(workspaceId!, siteId);
      if (!hydrated) {
        setName(row.name);
        setAddress(addressLine(row.address));
        setStatus(row.installation_status ?? "planned");
        setNotes(row.access_notes ?? "");
        setHydrated(true);
      }
      return row;
    },
  });

  const customerQuery = useQuery({
    queryKey: ["site-customer", workspaceId, siteQuery.data?.customer_id],
    enabled: Boolean(workspaceId && siteQuery.data?.customer_id),
    queryFn: () => api.getCustomer(workspaceId!, siteQuery.data!.customer_id),
  });

  const docsQuery = useQuery({
    queryKey: ["site-docs", workspaceId, siteId],
    enabled: Boolean(workspaceId) && can(roleKey, "documents.view", features),
    queryFn: () => api.listDocuments(workspaceId!, { entity_type: "site", entity_id: siteId, limit: 100 }),
  });

  const systemsQuery = useQuery({
    queryKey: ["site-systems", workspaceId, siteId],
    enabled: Boolean(workspaceId) && canSystems,
    queryFn: () => api.listSystems(workspaceId!, siteId),
  });

  const equipmentQuery = useQuery({
    queryKey: ["site-equipment", workspaceId, siteId],
    enabled: Boolean(workspaceId) && canSystems,
    queryFn: () => api.listEquipment(workspaceId!, siteId),
  });

  const serviceQuery = useQuery({
    queryKey: ["site-service", workspaceId, siteId],
    enabled: Boolean(workspaceId) && canService,
    queryFn: async () => {
      const all = await api.listServiceCalls(workspaceId!, { limit: 100 });
      return { items: all.items.filter((row) => row.site_id === siteId) };
    },
  });

  const jobsQuery = useQuery({
    queryKey: ["site-jobs", workspaceId, siteId],
    enabled: Boolean(workspaceId) && canViewJobs,
    queryFn: () => api.listJobs(workspaceId!, { site_id: siteId, limit: 50 }),
  });

  const warrantiesQuery = useQuery({
    queryKey: ["site-warranties", workspaceId, siteId],
    enabled: Boolean(workspaceId) && canWarranties,
    queryFn: () => api.listWarranties(workspaceId!, { site_id: siteId, limit: 50 }),
  });

  const save = useMutation({
    mutationFn: () =>
      api.patchSite(workspaceId!, siteId, {
        name: name.trim(),
        address: address.trim() ? { line: address.trim() } : {},
        installation_status: status,
        access_notes: notes.trim() || null,
      }),
    onSuccess: () => {
      setError(null);
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: ["site", workspaceId, siteId] });
      void queryClient.invalidateQueries({ queryKey: ["sites", workspaceId] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : he.sitesError),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const isPhoto = file.type.startsWith("image/");
      const intent = await api.createDocumentUpload(workspaceId!, {
        entity_type: "site",
        entity_id: siteId,
        kind: isPhoto ? "photo" : "document",
        mime_type: file.type || undefined,
        original_filename: file.name,
        byte_size: Math.max(file.size, 1),
      });
      const put = await fetch(intent.upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!put.ok) throw new Error(he.sitesError);
      await api.completeDocumentUpload(workspaceId!, intent.document_id, {
        byte_size: file.size,
        mime_type: file.type || undefined,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["site-docs", workspaceId, siteId] });
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (err) => setError(planQuotaMessage(err) ?? (err instanceof Error ? err.message : he.sitesError)),
  });

  const createSystem = useMutation({
    mutationFn: () =>
      api.createSystem(workspaceId!, {
        site_id: siteId,
        name: systemName.trim(),
        type: systemType,
      }),
    onSuccess: () => {
      setSystemName("");
      void queryClient.invalidateQueries({ queryKey: ["site-systems", workspaceId, siteId] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : he.sitesError),
  });

  const createEquipment = useMutation({
    mutationFn: () =>
      api.createEquipment(workspaceId!, {
        site_id: siteId,
        name: equipName.trim(),
        serial: equipSerial.trim() || undefined,
        category: equipCategory,
        location_note: equipLocation.trim() || undefined,
        status: "installed",
      }),
    onSuccess: () => {
      setEquipName("");
      setEquipSerial("");
      setEquipLocation("");
      void queryClient.invalidateQueries({ queryKey: ["site-equipment", workspaceId, siteId] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : he.sitesError),
  });

  const startInstall = useMutation({
    mutationFn: () =>
      api.createJob(workspaceId!, {
        title: he.installationJobTitle(siteQuery.data?.name ?? ""),
        customer_id: siteQuery.data!.customer_id,
        site_id: siteId,
        kind: "installation",
      }),
    onSuccess: (job) => {
      void queryClient.invalidateQueries({ queryKey: ["site-jobs", workspaceId, siteId] });
      void navigate({ to: "/app/jobs/$jobId", params: { jobId: job.id } });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : he.sitesError),
  });

  const systems = systemsQuery.data?.items ?? [];
  const equipment = equipmentQuery.data?.items ?? [];
  const serviceCalls = serviceQuery.data?.items ?? [];
  const jobs = jobsQuery.data?.items ?? [];
  const docs = docsQuery.data?.items ?? [];
  const warranties = warrantiesQuery.data?.items ?? [];

  const selectedEquip = useMemo(
    () => equipment.find((row) => row.id === selectedEquipId) ?? null,
    [equipment, selectedEquipId],
  );
  const locationGroups = useMemo(() => groupEquipmentByLocation(equipment), [equipment]);
  const history = useMemo(() => buildHistory(jobs, serviceCalls), [jobs, serviceCalls]);
  const photos = docs.filter((doc) => doc.kind === "photo" || (doc.mime_type ?? "").startsWith("image/"));
  const documentsOnly = docs.filter((doc) => !photos.some((photo) => photo.id === doc.id));

  const cameraCount = countCategory(equipment, ["camera"]);
  const nvrCount = countCategory(equipment, ["nvr", "dvr"]);
  const switchCount = countCategory(equipment, ["switch"]);
  const jobCount = jobs.length;

  const siteHealthAttention =
    status === "inactive" ||
    systems.some((row) => row.status === "inactive" || row.status === "decommissioned") ||
    equipment.some((row) => row.status === "removed") ||
    serviceCalls.some((row) => row.status === "open" || row.status === "in_progress");

  if (!workspaceId) return <ErrorState title={he.sitesError} />;
  if (siteQuery.isError) return <ErrorState title={he.sitesError} />;
  if (siteQuery.isLoading || !siteQuery.data) return <p className="text-sm text-fg-muted">{he.loading}</p>;

  const site = siteQuery.data;
  const siteCode = site.code?.trim() || null;
  const siteAddress = addressLine(site.address);

  const tabs = [
    { id: "overview", label: he.siteTabOverview },
    { id: "equipment", label: he.siteTabDevices, count: equipment.length },
    { id: "systems", label: he.siteTabSystems, count: systems.length },
    { id: "service", label: he.siteTabService, count: serviceCalls.length },
    { id: "documents", label: he.siteTabDocuments, count: docs.length },
    { id: "history", label: he.siteTabHistory, count: history.length },
    { id: "field", label: he.siteTabField },
  ];

  return (
    <div className="site-file space-y-5">
      <Link to="/app/sites" className="customer-360-back text-sm text-fg-muted hover:text-fg">
        ← {he.navSiteFiles}
      </Link>

      <header className="site-file-hero">
        <div className="min-w-0">
          <p className="public-mono text-[10px] tracking-[0.16em] text-fg-subtle">{he.siteFileKicker}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-fg sm:text-3xl">{site.name}</h1>
          {siteCode ? (
            <p className="public-mono mt-2 text-xs text-fg-muted" dir="ltr">
              {siteCode}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Status
              label={installationStatusLabel(site.installation_status) || site.installation_status || "—"}
              tone={operationalTone(site.installation_status)}
            />
            {siteAddress ? <p className="text-sm text-fg-muted">{siteAddress}</p> : null}
          </div>
        </div>
        <div className="site-file-hero-actions">
          {canEdit ? (
            <Button type="button" variant="secondary" onClick={() => setEditing((value) => !value)}>
              {editing ? he.cancel : he.siteEditAction}
            </Button>
          ) : null}
          {canEditSystems ? (
            <Button type="button" variant="secondary" onClick={() => setTab("equipment")}>
              {he.equipmentAdd}
            </Button>
          ) : null}
          {canJobs ? (
            <Button type="button" loading={startInstall.isPending} onClick={() => startInstall.mutate()}>
              {he.installationStart}
            </Button>
          ) : null}
          {canCreateQuote ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                void navigate({
                  to: "/app/quotes/new",
                  search: quoteCreateSearch({
                    customerId: site.customer_id,
                    siteId: site.id,
                  }),
                })
              }
            >
              {he.newQuote}
            </Button>
          ) : null}
        </div>
      </header>

      <dl className="site-file-metrics">
        {[
          [cameraCount, he.siteMetricCameras],
          [nvrCount, he.siteMetricNvrs],
          [switchCount, he.siteMetricSwitches],
          [jobCount, he.siteMetricJobs],
        ].map(([value, label]) => (
          <div key={String(label)} className="site-file-metric">
            <dd className="public-mono text-2xl font-semibold tracking-[-0.03em] text-fg">{value}</dd>
            <dt className="mt-1 text-xs text-fg-muted">{label}</dt>
          </div>
        ))}
      </dl>

      <section className="site-file-health" aria-labelledby="site-health-heading">
        <div>
          <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.siteHealthKicker}</p>
          <h2 id="site-health-heading" className="mt-2 flex items-center gap-2 text-base font-semibold text-fg">
            <span
              className={`size-2 rounded-full ${siteHealthAttention ? "bg-warning" : "bg-success"}`}
              aria-hidden
            />
            <span className="ltr-meta" dir="ltr">
              {siteHealthAttention ? he.siteHealthAttention : he.siteHealthOperational}
            </span>
          </h2>
        </div>
        <ul className="site-file-health-grid">
          {systems.length ? (
            systems.slice(0, 4).map((row) => (
              <li key={row.id} className="site-file-health-item">
                <span className="text-sm text-fg">{systemTypeLabel(row.type)}</span>
                <Status label={systemStatusLabel(row.status)} tone={operationalTone(row.status)} />
              </li>
            ))
          ) : (
            <li className="site-file-health-item text-sm text-fg-muted">{he.systemEmpty}</li>
          )}
          {canService ? (
            <li className="site-file-health-item">
              <span className="text-sm text-fg">{he.siteTabService}</span>
              <Status
                label={
                  serviceCalls.some((row) => row.status === "open" || row.status === "in_progress")
                    ? he.siteHealthAttention
                    : he.siteServiceUpToDate
                }
                tone={
                  serviceCalls.some((row) => row.status === "open" || row.status === "in_progress")
                    ? "warning"
                    : "success"
                }
              />
            </li>
          ) : null}
        </ul>
      </section>

      {customerQuery.data ? (
        <div className="site-file-customer">
          <p className="public-mono text-[10px] tracking-[0.16em] text-fg-subtle">{he.siteCustomerKicker}</p>
          <Link
            to="/app/customers/$customerId"
            params={{ customerId: customerQuery.data.id }}
            className="mt-1 inline-flex text-sm font-medium text-fg hover:text-action"
          >
            {customerQuery.data.display_name}
            <span className="ms-2 text-fg-muted">{he.siteOpenCustomer}</span>
          </Link>
        </div>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Tabs tabs={tabs} value={tab} onChange={(id) => setTab(id as SiteTab)} />

      {tab === "overview" ? (
        <div className="space-y-5">
          <section className="ops-panel p-5">
            <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.siteOverviewKicker}</p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                [he.name, site.name],
                [he.sitesAddress, siteAddress || "—"],
                [he.sitesStatus, installationStatusLabel(site.installation_status) || "—"],
                [he.sitesAccessNotes, site.access_notes || "—"],
                [he.siteCreatedLabel, formatDate(site.created_at) || "—"],
              ].map(([label, value]) => (
                <div key={String(label)} className="border-b border-border pb-3">
                  <dt className="text-xs text-fg-muted">{label}</dt>
                  <dd className="mt-1 text-sm text-fg">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {systems.length ? (
            <section className="ops-panel p-5">
              <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.siteSystemsKicker}</p>
              <ul className="mt-4 divide-y divide-border border-y border-border">
                {systems.map((row: SystemOut) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-medium text-fg">{row.name}</p>
                      <p className="text-xs text-fg-muted">{systemTypeLabel(row.type)}</p>
                    </div>
                    <Status label={systemStatusLabel(row.status)} tone={operationalTone(row.status)} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="ops-panel p-5">
            <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.siteRecentKicker}</p>
            {history.length ? (
              <ul className="mt-4 divide-y divide-border border-y border-border">
                {history.slice(0, 5).map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="ltr-meta text-xs text-fg-muted" dir="ltr">
                        {formatDate(row.at)}
                      </p>
                      <p className="mt-1 text-sm text-fg">{row.title}</p>
                    </div>
                    <Status label={row.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-fg-muted">{he.siteHistoryEmpty}</p>
            )}
          </section>

          {editing && canEdit ? (
            <section className="ops-panel p-5">
              <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.siteEditKicker}</p>
              <form
                className="mt-4 grid gap-3"
                onSubmit={(event: FormEvent) => {
                  event.preventDefault();
                  save.mutate();
                }}
              >
                <Input id="site-name" label={he.name} value={name} onChange={(e) => setName(e.target.value)} />
                <Input
                  id="site-address"
                  label={he.sitesAddress}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
                <Select id="site-status" label={he.sitesStatus} value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="planned">{he.installationStatuses.planned}</option>
                  <option value="in_progress">{he.installationStatuses.in_progress}</option>
                  <option value="completed">{he.installationStatuses.completed}</option>
                  <option value="inactive">{he.installationStatuses.inactive}</option>
                </Select>
                <Input
                  id="site-notes"
                  label={he.sitesAccessNotes}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <Button type="submit" loading={save.isPending}>
                  {he.save}
                </Button>
              </form>
            </section>
          ) : null}
        </div>
      ) : null}

      {tab === "systems" ? (
        <section className="ops-panel space-y-4 p-5">
          {canEditSystems ? (
            <form
              className="flex flex-wrap gap-2 border-b border-border pb-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (systemName.trim()) createSystem.mutate();
              }}
            >
              <Input
                id="system-name"
                label={he.systemName}
                value={systemName}
                onChange={(e) => setSystemName(e.target.value)}
              />
              <Select
                id="system-type"
                label={he.systemType}
                value={systemType}
                onChange={(e) => setSystemType(e.target.value)}
              >
                <option value="cctv">{he.systemTypes.cctv}</option>
                <option value="alarm">{he.systemTypes.alarm}</option>
                <option value="access">{he.systemTypes.access}</option>
                <option value="network">{he.systemTypes.network}</option>
                <option value="other">{he.systemTypes.other}</option>
              </Select>
              <Button type="submit" loading={createSystem.isPending}>
                {he.systemAdd}
              </Button>
            </form>
          ) : null}
          <ul className="divide-y divide-border">
            {systems.map((row: SystemOut) => (
              <li key={row.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-fg">{row.name}</p>
                  <p className="text-xs text-fg-muted">
                    {systemTypeLabel(row.type)}
                    {row.manufacturer ? ` · ${row.manufacturer}` : ""}
                    {row.model ? ` ${row.model}` : ""}
                  </p>
                </div>
                <Status label={systemStatusLabel(row.status)} tone={operationalTone(row.status)} />
              </li>
            ))}
            {!systems.length ? <li className="py-6 text-sm text-fg-muted">{he.systemEmpty}</li> : null}
          </ul>
        </section>
      ) : null}

      {tab === "equipment" ? (
        <div className="site-file-devices grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(16rem,0.9fr)]">
          <section className="ops-panel space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.siteDevicesKicker}</p>
                <h2 className="mt-1 text-base font-semibold text-fg">{he.siteTabDevices}</h2>
              </div>
            </div>

            {canEditSystems ? (
              <form
                className="grid gap-2 border-b border-border pb-4 sm:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (equipName.trim()) createEquipment.mutate();
                }}
              >
                <Input
                  id="equip-name"
                  label={he.equipmentName}
                  value={equipName}
                  onChange={(e) => setEquipName(e.target.value)}
                />
                <Input
                  id="equip-serial"
                  label={he.equipmentSerial}
                  value={equipSerial}
                  onChange={(e) => setEquipSerial(e.target.value)}
                />
                <Select
                  id="equip-category"
                  label={he.equipmentCategory}
                  value={equipCategory}
                  onChange={(e) => setEquipCategory(e.target.value)}
                >
                  <option value="camera">{he.equipmentCategories.camera}</option>
                  <option value="nvr">{he.equipmentCategories.nvr}</option>
                  <option value="dvr">{he.equipmentCategories.dvr}</option>
                  <option value="switch">{he.equipmentCategories.switch}</option>
                  <option value="panel">{he.equipmentCategories.panel}</option>
                  <option value="other">{he.equipmentCategories.other}</option>
                </Select>
                <Input
                  id="equip-location"
                  label={he.equipmentLocation}
                  value={equipLocation}
                  onChange={(e) => setEquipLocation(e.target.value)}
                  placeholder={he.equipmentLocationHint}
                />
                <div className="sm:col-span-2">
                  <Button type="submit" loading={createEquipment.isPending}>
                    {he.equipmentAdd}
                  </Button>
                </div>
              </form>
            ) : null}

            {locationGroups.length ? (
              <div className="space-y-5">
                {locationGroups.map((group) => (
                  <div key={group.key}>
                    <p className="public-mono text-[11px] tracking-[0.14em] text-fg-muted">{group.label}</p>
                    <ul className="mt-2 divide-y divide-border border-y border-border">
                      {group.items.map((row) => (
                        <li key={row.id}>
                          <button
                            type="button"
                            className={`flex w-full items-start justify-between gap-3 py-3 text-start transition-colors hover:bg-bg-subtle ${
                              selectedEquipId === row.id ? "site-file-device-row-selected" : ""
                            }`}
                            onClick={() => setSelectedEquipId(row.id)}
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-fg">{row.name}</p>
                              <p className="mt-0.5 text-xs text-fg-muted">
                                {[equipmentCategoryLabel(row.category), row.model, row.serial]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            </div>
                            <Status
                              label={equipmentStatusLabel(row.status)}
                              tone={operationalTone(row.status)}
                            />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-border px-4 py-6">
                <p className="text-sm font-medium text-fg">{he.equipmentEmptyTitle}</p>
                <p className="mt-1 text-sm text-fg-muted">{he.equipmentEmptyBody}</p>
              </div>
            )}
          </section>

          <aside className="ops-panel p-5">
            {selectedEquip ? (
              <DeviceDetail
                device={selectedEquip}
                systems={systems}
                warranties={warranties}
              />
            ) : (
              <div>
                <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.siteTwinKicker}</p>
                <p className="mt-3 text-sm leading-6 text-fg-muted">{he.siteTwinHint}</p>
                <ol className="public-mono mt-6 space-y-2 text-xs tracking-[0.08em] text-fg-muted" dir="ltr">
                  <li>SITE</li>
                  <li>↓ LOCATION</li>
                  <li>↓ SYSTEM</li>
                  <li>↓ DEVICE</li>
                  <li>↓ SERIAL</li>
                  <li>↓ STATUS</li>
                </ol>
              </div>
            )}
          </aside>
        </div>
      ) : null}

      {tab === "service" ? (
        <section className="ops-panel p-5">
          <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.siteServiceKicker}</p>
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {serviceCalls.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-fg">{row.title}</p>
                  <p className="text-xs text-fg-muted">
                    {[row.priority, formatDate(row.updated_at)].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Status label={row.status} />
              </li>
            ))}
            {!serviceCalls.length ? <li className="py-6 text-sm text-fg-muted">{he.serviceEmpty}</li> : null}
          </ul>
          {jobs.length ? (
            <div className="mt-6">
              <p className="text-sm font-semibold text-fg">{he.siteFieldJobs}</p>
              <ul className="mt-2 divide-y divide-border border-y border-border">
                {jobs.map((job) => (
                  <li key={job.id}>
                    <Link
                      to="/app/jobs/$jobId"
                      params={{ jobId: job.id }}
                      className="flex items-center justify-between gap-3 py-3 text-sm hover:text-action"
                    >
                      <span>{job.title}</span>
                      <Status label={job.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "documents" ? (
        <section className="ops-panel space-y-5 p-5">
          {canUpload ? (
            <>
              <input
                ref={fileRef}
                type="file"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) upload.mutate(file);
                }}
              />
              <Button type="button" variant="secondary" loading={upload.isPending} onClick={() => fileRef.current?.click()}>
                {he.sitesUpload}
              </Button>
            </>
          ) : null}

          <div>
            <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.sitePhotosKicker}</p>
            {photos.length ? (
              <ul className="mt-3 divide-y divide-border border-y border-border">
                {photos.map((doc: DocumentOut) => (
                  <li key={doc.id} className="flex items-center gap-2 py-3 text-sm">
                    <Camera className="size-4 text-fg-muted" aria-hidden />
                    <span>{doc.original_filename || doc.id}</span>
                    <span className="ms-auto text-xs text-fg-muted">{formatDate(doc.created_at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-fg-muted">{he.sitePhotosEmpty}</p>
            )}
          </div>

          <div>
            <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.siteDocsKicker}</p>
            <ul className="mt-3 divide-y divide-border border-y border-border">
              {documentsOnly.map((doc) => (
                <li key={doc.id} className="flex items-center gap-2 py-3 text-sm">
                  <FileText className="size-4 text-fg-muted" aria-hidden />
                  <span>{doc.original_filename || doc.id}</span>
                  <span className="ms-auto text-xs text-fg-muted">
                    {[doc.kind, formatDate(doc.created_at)].filter(Boolean).join(" · ")}
                  </span>
                </li>
              ))}
              {!docs.length ? <li className="py-6 text-sm text-fg-muted">{he.sitesNoDocs}</li> : null}
            </ul>
          </div>
        </section>
      ) : null}

      {tab === "history" ? (
        <section className="ops-panel p-5">
          <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.siteHistoryKicker}</p>
          <p className="mt-2 text-sm text-fg-muted">{he.siteHistoryLead}</p>
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {history.map((row) => (
              <li key={row.id} className="py-3">
                <p className="ltr-meta text-xs text-fg-muted" dir="ltr">
                  {formatDate(row.at)}
                </p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  {row.href ? (
                    <Link to={row.href.to} params={row.href.params} className="text-sm font-medium text-fg hover:text-action">
                      {row.title}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium text-fg">{row.title}</p>
                  )}
                  <Status label={row.status} />
                </div>
              </li>
            ))}
            {!history.length ? <li className="py-6 text-sm text-fg-muted">{he.siteHistoryEmpty}</li> : null}
          </ul>
        </section>
      ) : null}

      {tab === "field" ? (
        <section className="ops-panel space-y-4 p-5">
          <p className="text-sm text-fg-muted">{he.siteFieldLead}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {customerQuery.data?.phone ? (
              <a className="site-field-action" href={`tel:${customerQuery.data.phone}`}>
                <Phone className="size-4" aria-hidden />
                {he.siteFieldCall}
              </a>
            ) : null}
            <button type="button" className="site-field-action" onClick={() => setTab("documents")}>
              <Camera className="size-4" aria-hidden />
              {he.siteFieldPhoto}
            </button>
            <button type="button" className="site-field-action" onClick={() => setTab("service")}>
              <Wrench className="size-4" aria-hidden />
              {he.siteFieldService}
            </button>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">{he.siteFieldJobs}</p>
            <ul className="divide-y divide-border">
              {jobs.map((job) => (
                <li key={job.id}>
                  <Link
                    to="/app/jobs/$jobId"
                    params={{ jobId: job.id }}
                    className="flex items-center justify-between gap-3 py-3 text-sm hover:text-action"
                  >
                    <span>{job.title}</span>
                    <Status label={job.status} />
                  </Link>
                </li>
              ))}
              {!jobs.length ? <li className="py-4 text-sm text-fg-muted">{he.siteFieldJobsEmpty}</li> : null}
            </ul>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function DeviceDetail({
  device,
  systems,
  warranties,
}: {
  device: EquipmentOut;
  systems: SystemOut[];
  warranties: WarrantyOut[];
}) {
  const system = systems.find((row) => row.id === device.system_id) ?? null;
  const relatedWarranty =
    warranties.find((row) => row.status === "active" || row.status === "issued") ?? warranties[0] ?? null;
  const warrantyLabel = relatedWarranty
    ? [relatedWarranty.status, formatDate(relatedWarranty.ends_on)].filter(Boolean).join(" · ")
    : "—";

  return (
    <div>
      <p className="public-mono text-[10px] tracking-[0.16em] text-action">DEVICE</p>
      <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-fg">{device.name}</h2>
      <p className="mt-1 text-sm text-fg-muted">
        {[equipmentCategoryLabel(device.category), device.manufacturer, device.model].filter(Boolean).join(" · ")}
      </p>
      <div className="mt-4">
        <Status label={equipmentStatusLabel(device.status)} tone={operationalTone(device.status)} />
      </div>
      <p className="public-mono mt-6 text-[10px] tracking-[0.12em] text-fg-subtle" dir="ltr">
        SITE → {device.location_note?.trim() || "LOCATION"} → {system?.name || "SYSTEM"} → DEVICE
      </p>
      <dl className="mt-4 divide-y divide-border border-y border-border">
        {[
          [he.equipmentLocation, device.location_note || he.siteLocationUnknown],
          [he.equipmentSerial, device.serial || "—"],
          [he.equipmentInstalled, formatDate(device.installed_at) || "—"],
          [he.siteTabSystems, system ? system.name : "—"],
          [he.siteWarrantyLabel, warrantyLabel],
          ["IP", device.ip || "—"],
        ].map(([label, value]) => (
          <div key={String(label)} className="flex justify-between gap-4 py-3">
            <dt className="text-xs text-fg-muted">{label}</dt>
            <dd className="public-mono text-sm text-fg" dir="ltr">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
