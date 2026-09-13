import { ApiClientError } from "@site-secure/api-client";
import { Button, Select, Status } from "@site-secure/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
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
      }),
    onSuccess: (row) => {
      setCreating(false);
      setTitle("");
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
        <div>
          {listQuery.isLoading ? (
            <EmptyRows message={he.loading} />
          ) : (
            <ul className="divide-y divide-border border border-border">
              {(listQuery.data?.items ?? []).map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className={`flex w-full items-start justify-between gap-3 px-3 py-3 text-start ${
                      selectedId === row.id ? "bg-bg-muted" : "hover:bg-bg-muted/60"
                    }`}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg">{row.title}</p>
                      <p className="mt-1 text-xs text-fg-muted">
                        {he.jobPriority[row.priority as keyof typeof he.jobPriority] ?? row.priority}
                      </p>
                    </div>
                    <Status label={row.status} />
                  </button>
                </li>
              ))}
              {!listQuery.data?.items.length ? (
                <li className="px-3 py-6 text-sm text-fg-muted">{he.serviceEmpty}</li>
              ) : null}
            </ul>
          )}
        </div>

        <aside className="border border-border p-4">
          <p className="public-mono text-[10px] tracking-[0.14em] text-fg-subtle">{he.serviceCallDetail}</p>
          {!selectedId ? (
            <p className="mt-3 text-sm text-fg-muted">{he.serviceEmpty}</p>
          ) : detailQuery.isLoading ? (
            <p className="mt-3 text-sm text-fg-muted">{he.loading}</p>
          ) : detail ? (
            <div className="mt-3 space-y-3">
              <h2 className="text-base font-semibold text-fg">{detail.title}</h2>
              <div className="flex flex-wrap gap-2">
                <Status label={detail.status} />
                <Status
                  label={he.jobPriority[detail.priority as keyof typeof he.jobPriority] ?? detail.priority}
                  tone="neutral"
                />
              </div>
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
                        {job.number} · {job.title}
                      </Link>
                    </li>
                  ))}
                  {!linked.length ? <li className="text-sm text-fg-muted">—</li> : null}
                </ul>
              </div>
              {canCreateJob ? (
                <Button
                  type="button"
                  loading={createJob.isPending}
                  onClick={() => createJob.mutate()}
                >
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
