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

export const Route = createFileRoute("/app/warranties/")({
  component: WarrantiesPage,
});

function WarrantiesPage() {
  return (
    <RequirePermission permission="warranties.view">
      <WarrantiesBody />
    </RequirePermission>
  );
}

function WarrantiesBody() {
  const { session, api } = useSession();
  const queryClient = useQueryClient();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const features = membership?.features ?? [];
  const canCreate = can(membership?.role_key, "warranties.issue", features);
  const [creating, setCreating] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
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
    queryKey: ["warranties", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listWarranties(workspaceId!, { limit: 100 }),
  });

  const create = useMutation({
    mutationFn: () =>
      api.createWarranty(workspaceId!, {
        customer_id: customerId,
        site_id: siteId,
        starts_on: startsOn,
        ends_on: endsOn,
      }),
    onSuccess: () => {
      setCreating(false);
      setCustomerId("");
      setSiteId("");
      setStartsOn("");
      setEndsOn("");
      void queryClient.invalidateQueries({ queryKey: ["warranties", workspaceId] });
    },
    onError: (err) => setFormError(err instanceof ApiClientError ? err.message : he.warrantiesError),
  });

  if (!workspaceId) return <ErrorState title={he.warrantiesError} />;
  if (listQuery.isError) return <ErrorState title={he.warrantiesError} />;

  return (
    <ModuleScaffold title={he.warrantiesTitle} lead={he.warrantiesLead}>
      <SearchCreateBar
        query=""
        onQuery={() => undefined}
        canCreate={canCreate}
        creating={creating}
        onToggleCreate={() => setCreating((v) => !v)}
        createLabel={he.warrantiesCreate}
      />
      <CreatePanel
        open={creating}
        pending={create.isPending}
        error={formError}
        onSubmit={(ev: FormEvent) => {
          ev.preventDefault();
          if (!customerId || !siteId || !startsOn || !endsOn) return;
          create.mutate();
        }}
      >
        <Select
          id="w-customer"
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
        <Select id="w-site" label={he.pickSite} value={siteId} onChange={(ev) => setSiteId(ev.target.value)}>
          <option value="">{he.pickSite}</option>
          {(sitesQuery.data?.items ?? []).map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </Select>
        <Input id="w-start" label={he.startsOn} type="date" value={startsOn} onChange={(ev) => setStartsOn(ev.target.value)} />
        <Input id="w-end" label={he.endsOn} type="date" value={endsOn} onChange={(ev) => setEndsOn(ev.target.value)} />
      </CreatePanel>
      {listQuery.isLoading ? (
        <EmptyRows message={he.loading} />
      ) : (
        <SimpleEntityTable
          empty={he.warrantiesEmpty}
          rows={(listQuery.data?.items ?? []).map((row) => ({
            id: row.id,
            title: row.number,
            meta: `${row.starts_on} → ${row.ends_on}`,
            status: row.status,
          }))}
        />
      )}
    </ModuleScaffold>
  );
}
