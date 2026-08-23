import { ApiClientError } from "@site-secure/api-client";
import { Select } from "@site-secure/ui";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  addressLine,
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

export const Route = createFileRoute("/app/sites/")({
  component: SitesPage,
});

function SitesPage() {
  return (
    <RequirePermission permission="sites.view">
      <SitesBody />
    </RequirePermission>
  );
}

function SitesBody() {
  const { session, api } = useSession();
  const navigate = useNavigate();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const features = membership?.features ?? [];
  const canCreate = can(membership?.role_key, "sites.create", features);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const customersQuery = useQuery({
    queryKey: ["customers-pick", workspaceId],
    enabled: Boolean(workspaceId) && creating,
    queryFn: () => api.listCustomers(workspaceId!, { limit: 100 }),
  });
  const listQuery = useQuery({
    queryKey: ["sites", workspaceId, q],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSites(workspaceId!, { q, limit: 100 }),
  });

  const create = useMutation({
    mutationFn: () =>
      api.createSite(workspaceId!, {
        customer_id: customerId,
        name: name.trim(),
        address: address.trim() ? { line: address.trim() } : undefined,
      }),
    onSuccess: (row) => {
      setCreating(false);
      setName("");
      setAddress("");
      setCustomerId("");
      void navigate({ to: "/app/sites/$siteId", params: { siteId: row.id } });
    },
    onError: (err) => setFormError(err instanceof ApiClientError ? err.message : he.sitesError),
  });

  if (!workspaceId) return <ErrorState title={he.sitesError} />;
  if (listQuery.isError) return <ErrorState title={he.sitesError} />;

  return (
    <ModuleScaffold title={he.sitesTitle} lead={he.sitesLead}>
      <SearchCreateBar
        query={q}
        onQuery={setQ}
        canCreate={canCreate}
        creating={creating}
        onToggleCreate={() => setCreating((v) => !v)}
        createLabel={he.sitesCreate}
      />
      <CreatePanel
        open={creating}
        pending={create.isPending}
        error={formError}
        onSubmit={(ev: FormEvent) => {
          ev.preventDefault();
          if (!customerId || !name.trim()) return;
          create.mutate();
        }}
      >
        <Select
          id="site-customer"
          label={he.pickCustomer}
          value={customerId}
          onChange={(ev) => setCustomerId(ev.target.value)}
          required
        >
          <option value="">{he.pickCustomer}</option>
          {(customersQuery.data?.items ?? []).map((row) => (
            <option key={row.id} value={row.id}>
              {row.display_name}
            </option>
          ))}
        </Select>
        <Input id="site-name" label={he.name} value={name} onChange={(ev) => setName(ev.target.value)} required />
        <Input id="site-address" label={he.sitesAddress} value={address} onChange={(ev) => setAddress(ev.target.value)} />
      </CreatePanel>
      {listQuery.isLoading ? (
        <EmptyRows message={he.loading} />
      ) : (
        <SimpleEntityTable
          empty={he.sitesEmpty}
          rows={(listQuery.data?.items ?? []).map((row) => ({
            id: row.id,
            title: row.name,
            meta: [row.code, addressLine(row.address)].filter(Boolean).join(" · "),
            status: row.installation_status,
            href: `/app/sites/${row.id}`,
          }))}
        />
      )}
    </ModuleScaffold>
  );
}
