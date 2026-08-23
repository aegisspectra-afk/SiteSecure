import { ApiClientError } from "@site-secure/api-client";
import { Select } from "@site-secure/ui";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  CreatePanel,
  EmptyRows,
  ErrorState,
  Input,
  ModuleScaffold,
  SearchCreateBar,
  SimpleEntityTable,
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
  const canCreate = can(membership?.role_key, "service.create", features);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [siteId, setSiteId] = useState("");
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

  const create = useMutation({
    mutationFn: () =>
      api.createServiceCall(workspaceId!, {
        title: title.trim(),
        customer_id: customerId,
        site_id: siteId,
      }),
    onSuccess: () => {
      setCreating(false);
      setTitle("");
      setCustomerId("");
      setSiteId("");
      void queryClient.invalidateQueries({ queryKey: ["service-calls", workspaceId] });
    },
    onError: (err) => setFormError(err instanceof ApiClientError ? err.message : he.serviceError),
  });

  if (!workspaceId) return <ErrorState title={he.serviceError} />;
  if (listQuery.isError) return <ErrorState title={he.serviceError} />;

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
      {listQuery.isLoading ? (
        <EmptyRows message={he.loading} />
      ) : (
        <SimpleEntityTable
          empty={he.serviceEmpty}
          rows={(listQuery.data?.items ?? []).map((row) => ({
            id: row.id,
            title: row.title,
            meta: row.priority,
            status: row.status,
          }))}
        />
      )}
    </ModuleScaffold>
  );
}
