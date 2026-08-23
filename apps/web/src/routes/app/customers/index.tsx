import { ApiClientError } from "@site-secure/api-client";
import { Button, ErrorState } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import {
  CustomerCreateForm,
  CustomerDirectoryFilters,
  CustomerDirectoryHeader,
  CustomerDirectoryList,
  CustomerDirectoryMetrics,
  CustomerDirectorySearch,
  useCustomerDirectorySearch,
  useCustomerDirectoryView,
} from "../../../components/customers/CustomerDirectory";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { NextActionDialog } from "../../../components/workflow/NextActionDialog";
import { he } from "../../../i18n/he";
import { can } from "../../../lib/can";
import { buildCustomerDirectoryRows, type CustomerDirectoryFilter } from "../../../lib/customer-directory";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/customers/")({
  component: CustomersPage,
});

function CustomersPage() {
  return (
    <RequirePermission permission="crm.view">
      <CustomersBody />
    </RequirePermission>
  );
}

function CustomersBody() {
  const { session, api } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const features = membership?.features ?? [];
  const canCreate = can(membership?.role_key, "crm.create", features);
  const canCreateQuote = can(membership?.role_key, "quotes.create", features);
  const canViewLeads = can(membership?.role_key, "leads.view", features);
  const canViewQuotes = can(membership?.role_key, "quotes.view", features);
  const canViewProjects = can(membership?.role_key, "projects.view", features);
  const canViewService = can(membership?.role_key, "service.view", features);
  const canViewSites = can(membership?.role_key, "sites.view", features);

  const { query, setQuery, debouncedQuery } = useCustomerDirectorySearch();
  const [filter, setFilter] = useState<CustomerDirectoryFilter>({});
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [createdCustomerId, setCreatedCustomerId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["customers", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listCustomers(workspaceId!, { limit: 100 }),
  });

  const sitesQuery = useQuery({
    queryKey: ["directory-sites", workspaceId],
    enabled: Boolean(workspaceId) && canViewSites,
    queryFn: () => api.listSites(workspaceId!, { limit: 100 }),
  });

  const quotesQuery = useQuery({
    queryKey: ["directory-quotes", workspaceId],
    enabled: Boolean(workspaceId) && canViewQuotes,
    queryFn: () => api.listQuotes(workspaceId!, { limit: 100 }),
  });

  const projectsQuery = useQuery({
    queryKey: ["directory-projects", workspaceId],
    enabled: Boolean(workspaceId) && canViewProjects,
    queryFn: () => api.listProjects(workspaceId!, { limit: 100 }),
  });

  const serviceQuery = useQuery({
    queryKey: ["directory-service", workspaceId],
    enabled: Boolean(workspaceId) && canViewService,
    queryFn: () => api.listServiceCalls(workspaceId!, { limit: 100 }),
  });

  const leadsQuery = useQuery({
    queryKey: ["directory-leads", workspaceId],
    enabled: Boolean(workspaceId) && canViewLeads,
    queryFn: () => api.listLeads(workspaceId!, { limit: 100 }),
  });

  const rows = useMemo(
    () =>
      buildCustomerDirectoryRows({
        customers: listQuery.data?.items ?? [],
        sites: sitesQuery.data?.items ?? [],
        quotes: quotesQuery.data?.items ?? [],
        projects: projectsQuery.data?.items ?? [],
        serviceCalls: serviceQuery.data?.items ?? [],
        leads: leadsQuery.data?.items ?? [],
      }),
    [
      listQuery.data?.items,
      sitesQuery.data?.items,
      quotesQuery.data?.items,
      projectsQuery.data?.items,
      serviceQuery.data?.items,
      leadsQuery.data?.items,
    ],
  );

  const { filtered, summary } = useCustomerDirectoryView(rows, filter, {
    query: debouncedQuery,
    sites: sitesQuery.data?.items ?? [],
  });

  const create = useMutation({
    mutationFn: () =>
      api.createCustomer(workspaceId!, {
        display_name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      }),
    onSuccess: (row) => {
      setCreating(false);
      setName("");
      setEmail("");
      setPhone("");
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ["customers", workspaceId] });
      if (canCreateQuote) {
        setCreatedCustomerId(row.id);
      } else {
        void navigate({ to: "/app/customers/$customerId", params: { customerId: row.id } });
      }
    },
    onError: (err) => {
      setFormError(err instanceof ApiClientError ? err.message : he.customersError);
    },
  });

  if (!workspaceId) return <ErrorState title={he.customersError} />;
  if (listQuery.isError) {
    return (
      <ErrorState
        title={he.customersError}
        action={
          <Button type="button" variant="secondary" onClick={() => void listQuery.refetch()}>
            {he.retry}
          </Button>
        }
      />
    );
  }

  return (
    <div className="customer-dir space-y-5">
      <CustomerDirectoryHeader
        canCreate={canCreate}
        creating={creating}
        onToggleCreate={() => {
          setCreating((v) => !v);
          setFormError(null);
        }}
      />

      {!listQuery.isLoading ? <CustomerDirectoryMetrics summary={summary} /> : null}

      <div className="customer-dir-toolbar">
        <CustomerDirectorySearch
          value={query}
          onChange={setQuery}
          onClear={() => {
            setQuery("");
            setFilter({});
          }}
        />
        <CustomerDirectoryFilters filter={filter} onChange={setFilter} />
      </div>

      <CustomerCreateForm
        open={creating}
        pending={create.isPending}
        error={formError}
        name={name}
        email={email}
        phone={phone}
        onName={setName}
        onEmail={setEmail}
        onPhone={setPhone}
        onSubmit={(ev: FormEvent) => {
          ev.preventDefault();
          if (!name.trim()) return;
          create.mutate();
        }}
      />

      <CustomerDirectoryList
        rows={filtered}
        loading={listQuery.isLoading}
        query={debouncedQuery}
        filter={filter}
        canCreate={canCreate}
        onCreate={() => setCreating(true)}
        onClearSearch={() => {
          setQuery("");
          setFilter({});
        }}
      />

      {createdCustomerId ? (
        <NextActionDialog
          open
          onClose={() => {
            const id = createdCustomerId;
            setCreatedCustomerId(null);
            void navigate({ to: "/app/customers/$customerId", params: { customerId: id } });
          }}
          title={he.workflowNextCustomerTitle}
          body={he.workflowNextCustomerBody}
          customerId={createdCustomerId}
        />
      ) : null}
    </div>
  );
}
