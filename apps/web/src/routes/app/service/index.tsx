import { ApiClientError } from "@site-secure/api-client";
import { ActivityRow, Button, Select, Status, type StatusTone } from "@site-secure/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Wrench } from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  CreatePanel,
  EmptyRows,
  ErrorState,
  Input,
  ModuleScaffold,
  SearchCreateBar,
  useMutation,
  useQuery,
} from "../../../components/modules/ModuleKit";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { can } from "../../../lib/can";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/service/")({
  component: ServicePage,
});

function serviceStatusLabel(status: string) {
  return he.serviceCallStatuses[status as keyof typeof he.serviceCallStatuses] ?? status;
}

function serviceStatusTone(status: string): StatusTone {
  switch (status) {
    case "closed":
      return "success";
    case "in_progress":
      return "info";
    case "waiting":
      return "warning";
    case "open":
      return "neutral";
    default:
      return "neutral";
  }
}

function ServicePage() {
  return (
    <RequirePermission permission="service.view">
      <ServiceBody />
    </RequirePermission>
  );
}

function ServiceBody() {
  const { session, api } = useSession();
  const queryClient = useQueryClient();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const features = membership?.features ?? [];
  const roleKey = membership?.role_key;
  const canCreate = can(roleKey, "service.create", features);
  const canCreateJob = can(roleKey, "jobs.create", features);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [priority, setPriority] = useState("normal");
  const [formError, setFormError] = useState<string | null>(null);

  const customersQuery = useQuery({
    queryKey: ["customers-pick", workspaceId],
    enabled: Boolean(workspaceId) && creating,
    queryFn: () => api.listCustomers(workspaceId!, { limit: 100 }),
  });
  const sitesQuery = useQuery({
    queryKey: ["sites-pick", workspaceId, customerId],
    enabled: Boolean(workspaceId) && creating && Boolean(customerId),
    queryFn: () => api.listSites(workspaceId!, { customer_id: customerId, limit: 100 }),
  });
  const listQuery = useQuery({
    queryKey: ["service-calls", workspaceId, q],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listServiceCalls(workspaceId!, { q, limit: 100 }),
  });
  const detailQuery = useQuery({
    queryKey: ["service-call", workspaceId, selectedId],
    enabled: Boolean(workspaceId && selectedId),
    queryFn: () => api.getServiceCall(workspaceId!, selectedId!),
  });

  const create = useMutation({
    mutationFn: () =>
      api.createServiceCall(workspaceId!, {
        title: title.trim(),
        customer_id: customerId,
        site_id: siteId,
        priority,
        description: description.trim() || undefined,
      }),
    onSuccess: (row) => {
      setCreating(false);
      setTitle("");
      setDescription("");
      setCustomerId("");
      setSiteId("");
      setPriority("normal");
      setSelectedId(row.id);
      void queryClient.invalidateQueries({ queryKey: ["service-calls", workspaceId] });
    },
    onError: (err) => setFormError(err instanceof ApiClientError ? err.message : he.serviceError),
  });

  const createJob = useMutation({
    mutationFn: () => api.createJobFromServiceCall(workspaceId!, selectedId!),
    onSuccess: (job) => {
      void queryClient.invalidateQueries({ queryKey: ["service-call", workspaceId, selectedId] });
      void queryClient.invalidateQueries({ queryKey: ["service-calls", workspaceId] });
      setSelectedId(selectedId);
      void job;
    },
    onError: (err) => setFormError(err instanceof ApiClientError ? err.message : he.serviceError),
  });

  if (!workspaceId) return <ErrorState title={he.serviceError} />;
  if (listQuery.isError) return <ErrorState title={he.serviceError} />;

  const detail = detailQuery.data;
  const linked = detail?.linked_jobs ?? [];
  const items = listQuery.data?.items ?? [];

  return (
    <ModuleScaffold title={he.serviceTitle} lead={he.serviceLead}>
      <SearchCreateBar
        query={q}
        onQuery={setQ}
        canCreate={canCreate}
        creating={creating}
        onToggleCreate={() => setCreating((v) => !v)}
        createLabel={he.serviceCreate}
      />
      <CreatePanel
        open={creating}
        pending={create.isPending}
        error={formError}
        onSubmit={(ev: FormEvent) => {
          ev.preventDefault();
          if (!title.trim() || !customerId || !siteId) return;
          create.mutate();
        }}
      >
        <Input id="svc-title" label={he.titleField} value={title} onChange={(ev) => setTitle(ev.target.value)} required />
        <label className="block text-xs text-fg-muted" htmlFor="svc-desc">
          {he.descriptionField}
          <textarea
            id="svc-desc"
            className="field-notes"
            rows={3}
            value={description}
            onChange={(ev) => setDescription(ev.target.value)}
          />
        </label>
        <Select
          id="svc-priority"
          label={he.jobPriority.normal}
          value={priority}
          onChange={(ev) => setPriority(ev.target.value)}
        >
          {(["low", "normal", "high", "critical"] as const).map((key) => (
            <option key={key} value={key}>
              {he.jobPriority[key]}
            </option>
          ))}
        </Select>
        <Select
          id="svc-customer"
          label={he.pickCustomer}
          value={customerId}
          onChange={(ev) => {
            setCustomerId(ev.target.value);
            setSiteId("");
          }}
        >
          <option value="">{he.pickCustomer}</option>
          {(customersQuery.data?.items ?? []).map((row) => (
            <option key={row.id} value={row.id}>
              {row.display_name}
            </option>
          ))}
        </Select>
        <Select id="svc-site" label={he.pickSite} value={siteId} onChange={(ev) => setSiteId(ev.target.value)}>
          <option value="">{he.pickSite}</option>
          {(sitesQuery.data?.items ?? []).map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </Select>
      </CreatePanel>

      <div className="ss-service-layout">
        <div className="ss-service-list-panel">
          {listQuery.isLoading ? (
            <EmptyRows message={he.loading} />
          ) : !items.length ? (
            <div className="ss-module-empty">
              <p className="ss-module-empty-title">{he.serviceEmpty}</p>
              <p className="ss-module-empty-body">{he.serviceLead}</p>
              {canCreate ? (
                <Button
                  type="button"
                  className="mt-4"
                  onClick={() => {
                    setCreating(true);
                    setFormError(null);
                  }}
                >
                  {he.serviceCreate}
                </Button>
              ) : null}
            </div>
          ) : (
            <ul className="ss-service-list">
              {items.map((row) => {
                const selected = selectedId === row.id;
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      className={`ss-service-row${selected ? " is-selected" : ""}`}
                      aria-pressed={selected}
                      onClick={() => setSelectedId(row.id)}
                    >
                      <ActivityRow
                        leading={<Wrench aria-hidden />}
                        title={row.title}
                        subtitle={[row.customer_name, row.site_name].filter(Boolean).join(" · ") || undefined}
                        meta={
                          <>
                            {row.number ? (
                              <span className="ltr-meta" dir="ltr">
                                {row.number}
                              </span>
                            ) : null}
                            {row.priority ? (
                              <span>{he.jobPriority[row.priority as keyof typeof he.jobPriority] ?? row.priority}</span>
                            ) : null}
                          </>
                        }
                        trailing={
                          <Status label={serviceStatusLabel(row.status)} tone={serviceStatusTone(row.status)} />
                        }
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <aside className="ss-service-detail" aria-label={he.serviceCallDetail}>
          <p className="ss-service-detail-kicker">{he.serviceCallDetail}</p>
          {!selectedId ? (
            <p className="mt-3 text-sm text-fg-muted">{he.serviceEmpty}</p>
          ) : detailQuery.isLoading ? (
            <p className="mt-3 text-sm text-fg-muted">{he.loading}</p>
          ) : detail ? (
            <div className="ss-service-detail-body">
              {detail.number ? (
                <p className="public-mono text-xs text-fg-muted" dir="ltr">
                  {detail.number}
                </p>
              ) : null}
              <h2 className="ss-service-detail-title">{detail.title}</h2>
              <div className="flex flex-wrap gap-2">
                <Status label={serviceStatusLabel(detail.status)} tone={serviceStatusTone(detail.status)} />
                <Status
                  label={he.jobPriority[detail.priority as keyof typeof he.jobPriority] ?? detail.priority}
                  tone="neutral"
                />
              </div>
              {detail.customer_name || detail.site_name ? (
                <p className="text-sm text-fg-muted">
                  {[detail.customer_name, detail.site_name].filter(Boolean).join(" · ")}
                </p>
              ) : null}
              {detail.description ? <p className="text-sm text-fg-muted">{detail.description}</p> : null}
              <div>
                <p className="text-xs text-fg-muted">{he.linkedJobs}</p>
                <ul className="mt-2 space-y-2">
                  {linked.map((job) => (
                    <li key={job.id}>
                      <Link
                        to="/app/jobs/$jobId"
                        params={{ jobId: job.id }}
                        className="text-sm text-fg underline-offset-2 hover:underline"
                      >
                        {he.fieldJobNumber} {job.number} · {job.title}
                      </Link>
                    </li>
                  ))}
                  {!linked.length ? <li className="text-sm text-fg-muted">—</li> : null}
                </ul>
              </div>
              {canCreateJob ? (
                <Button type="button" loading={createJob.isPending} onClick={() => createJob.mutate()}>
                  {he.createFieldJob}
                </Button>
              ) : null}
              {linked[0] ? (
                <Link to="/app/jobs/$jobId" params={{ jobId: linked[0].id }} className="block text-sm text-fg-muted">
                  {he.openLinkedJob}
                </Link>
              ) : null}
              {formError ? <p className="text-sm text-danger">{formError}</p> : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-fg-muted">{he.serviceError}</p>
          )}
        </aside>
      </div>
    </ModuleScaffold>
  );
}
