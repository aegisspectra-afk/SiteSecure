import { ApiClientError, type EquipmentOut, type SystemOut } from "@site-secure/api-client";
import { Button, ErrorState, Input, PageHeader, Select, Status, Tabs } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Camera, FileText, Phone, Wrench } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { addressLine } from "../modules/ModuleKit";
import { he } from "../../i18n/he";
import { can } from "../../lib/can";
import { installationStatusLabel } from "../../lib/customer-profile";
import { quoteCreateSearch } from "../../lib/workflow-context";
import { useSession } from "../../lib/session";

type SiteTab = "overview" | "systems" | "equipment" | "service" | "documents" | "field";

function systemTypeLabel(type: string): string {
  return he.systemTypes[type as keyof typeof he.systemTypes] ?? type;
}

function systemStatusLabel(status: string): string {
  return he.systemStatuses[status as keyof typeof he.systemStatuses] ?? status;
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

  const [tab, setTab] = useState<SiteTab>("overview");
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
    enabled: Boolean(workspaceId) && can(roleKey, "jobs.view", features),
    queryFn: () => api.listJobs(workspaceId!, { site_id: siteId, limit: 50 }),
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
      void queryClient.invalidateQueries({ queryKey: ["site", workspaceId, siteId] });
      void queryClient.invalidateQueries({ queryKey: ["sites", workspaceId] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : he.sitesError),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const intent = await api.createDocumentUpload(workspaceId!, {
        entity_type: "site",
        entity_id: siteId,
        kind: "document",
        mime_type: file.type || undefined,
        original_filename: file.name,
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
    onError: (err) => setError(err instanceof Error ? err.message : he.sitesError),
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
        category: "camera",
      }),
    onSuccess: () => {
      setEquipName("");
      setEquipSerial("");
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

  if (!workspaceId) return <ErrorState title={he.sitesError} />;
  if (siteQuery.isError) return <ErrorState title={he.sitesError} />;
  if (siteQuery.isLoading || !siteQuery.data) return <p className="text-sm text-fg-muted">{he.loading}</p>;

  const site = siteQuery.data;
  const systems = systemsQuery.data?.items ?? [];
  const equipment = equipmentQuery.data?.items ?? [];
  const serviceCalls = serviceQuery.data?.items ?? [];
  const jobs = jobsQuery.data?.items ?? [];
  const docs = docsQuery.data?.items ?? [];

  const tabs = [
    { id: "overview", label: he.siteTabOverview },
    { id: "systems", label: he.siteTabSystems, count: systems.length },
    { id: "equipment", label: he.siteTabEquipment, count: equipment.length },
    { id: "service", label: he.siteTabService, count: serviceCalls.length },
    { id: "documents", label: he.siteTabDocuments, count: docs.length },
    { id: "field", label: he.siteTabField },
  ];

  return (
    <div className="site-dossier space-y-5">
      <Link to="/app/sites" className="customer-360-back text-sm text-fg-muted hover:text-fg">
        ← {he.navSiteFiles}
      </Link>

      <PageHeader
        title={site.name}
        description={addressLine(site.address) || he.sitesLead}
        action={
          <div className="flex flex-wrap gap-2">
            <Status label={installationStatusLabel(site.installation_status) || site.installation_status || "—"} />
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
            {canJobs ? (
              <Button type="button" loading={startInstall.isPending} onClick={() => startInstall.mutate()}>
                {he.installationStart}
              </Button>
            ) : null}
          </div>
        }
      />

      {customerQuery.data ? (
        <Link
          to="/app/customers/$customerId"
          params={{ customerId: customerQuery.data.id }}
          className="inline-flex rounded-[var(--radius-control)] border border-border bg-bg-1 px-3 py-2 text-sm text-fg hover:border-border-strong"
        >
          {customerQuery.data.display_name}
        </Link>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Tabs tabs={tabs} value={tab} onChange={(id) => setTab(id as SiteTab)} />

      {tab === "overview" ? (
        <section className="ops-card space-y-4 p-4">
          <p className="text-sm text-fg-muted">{he.siteOverviewLead}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[var(--radius-control)] bg-bg-subtle p-3">
              <p className="text-xs text-fg-muted">{he.siteTabSystems}</p>
              <p className="mt-1 text-xl font-semibold">{systems.length}</p>
            </div>
            <div className="rounded-[var(--radius-control)] bg-bg-subtle p-3">
              <p className="text-xs text-fg-muted">{he.siteTabEquipment}</p>
              <p className="mt-1 text-xl font-semibold">{equipment.length}</p>
            </div>
            <div className="rounded-[var(--radius-control)] bg-bg-subtle p-3">
              <p className="text-xs text-fg-muted">{he.siteTabService}</p>
              <p className="mt-1 text-xl font-semibold">{serviceCalls.length}</p>
            </div>
          </div>
          <form
            className="grid gap-3"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              if (canEdit) save.mutate();
            }}
          >
            <Input id="site-name" label={he.name} value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />
            <Input
              id="site-address"
              label={he.sitesAddress}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={!canEdit}
            />
            <Select
              id="site-status"
              label={he.sitesStatus}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={!canEdit}
            >
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
              disabled={!canEdit}
            />
            {canEdit ? (
              <Button type="submit" loading={save.isPending}>
                {he.save}
              </Button>
            ) : null}
          </form>
        </section>
      ) : null}

      {tab === "systems" ? (
        <section className="ops-card space-y-4 p-4">
          {canEditSystems ? (
            <form
              className="flex flex-wrap gap-2"
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
                <Status label={systemStatusLabel(row.status)} />
              </li>
            ))}
            {!systems.length ? <li className="py-6 text-sm text-fg-muted">{he.systemEmpty}</li> : null}
          </ul>
        </section>
      ) : null}

      {tab === "equipment" ? (
        <section className="ops-card space-y-4 p-4">
          {canEditSystems ? (
            <form
              className="flex flex-wrap gap-2"
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
              <Button type="submit" loading={createEquipment.isPending}>
                {he.equipmentAdd}
              </Button>
            </form>
          ) : null}
          <ul className="divide-y divide-border">
            {equipment.map((row: EquipmentOut) => (
              <li key={row.id} className="py-3">
                <p className="font-medium text-fg">{row.name}</p>
                <p className="text-xs text-fg-muted">
                  {[row.serial, row.model, row.ip].filter(Boolean).join(" · ") || row.category}
                </p>
              </li>
            ))}
            {!equipment.length ? <li className="py-6 text-sm text-fg-muted">{he.equipmentEmpty}</li> : null}
          </ul>
        </section>
      ) : null}

      {tab === "service" ? (
        <section className="ops-card p-4">
          <ul className="divide-y divide-border">
            {serviceCalls.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{row.title}</p>
                  <p className="text-xs text-fg-muted">{row.priority}</p>
                </div>
                <Status label={row.status} />
              </li>
            ))}
            {!serviceCalls.length ? <li className="py-6 text-sm text-fg-muted">{he.serviceEmpty}</li> : null}
          </ul>
        </section>
      ) : null}

      {tab === "documents" ? (
        <section className="ops-card space-y-4 p-4">
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
          <ul className="divide-y divide-border">
            {docs.map((doc) => (
              <li key={doc.id} className="flex items-center gap-2 py-3 text-sm">
                <FileText className="size-4 text-fg-muted" aria-hidden />
                <span>{doc.original_filename || doc.id}</span>
              </li>
            ))}
            {!docs.length ? <li className="py-6 text-sm text-fg-muted">{he.sitesNoDocs}</li> : null}
          </ul>
        </section>
      ) : null}

      {tab === "field" ? (
        <section className="ops-card space-y-4 p-4">
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
