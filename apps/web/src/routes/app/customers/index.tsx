import { ApiClientError } from "@site-secure/api-client";
import { Button, ErrorState } from "@site-secure/ui";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import {
  CustomerCreateForm,
  CustomerDirectoryHeader,
  CustomerDirectoryList,
  CustomerDirectoryMetrics,
  CustomerDirectoryToolbar,
  useCustomerDirectorySearch,
  useCustomerDirectoryView,
} from "../../../components/customers/CustomerDirectory";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { NextActionDialog } from "../../../components/workflow/NextActionDialog";
import { he } from "../../../i18n/he";
import { can } from "../../../lib/can";
import { buildCustomerDirectoryRows, type CustomerDirectoryFilter } from "../../../lib/customer-directory";
import { downloadCsv } from "../../../lib/download-blob";
import { planQuotaMessage } from "../../../lib/plan-quota";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/customers/")({
  component: CustomersPage,
});

export function CustomersPage() {
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
  const grants = membership?.permissions ?? null;
  const canCreate = can(membership?.role_key, "crm.create", features, grants);
  const canExport = can(membership?.role_key, "crm.export", features, grants);
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
  const [exportError, setExportError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importCsvText, setImportCsvText] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<{
    rows: {
      row: number;
      display_name: string;
      phone?: string | null;
      email?: string | null;
      issues: string[];
      importable: boolean;
    }[];
    valid_count: number;
    error_count: number;
    errors: string[];
  } | null>(null);

  const listQuery = useInfiniteQuery({
    queryKey: ["customers", workspaceId, debouncedQuery, filter.status],
    enabled: Boolean(workspaceId),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      api.listCustomers(workspaceId!, {
        limit: 50,
        q: debouncedQuery || undefined,
        status: filter.status,
        cursor: pageParam,
      }),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    staleTime: 30_000,
  });
  const customerItems = listQuery.data?.pages.flatMap((page) => page.items) ?? [];

  // Enrichment loads after the directory list so first paint is not blocked by 5 extra round-trips.
  const enrichEnabled = Boolean(workspaceId) && listQuery.isSuccess;

  const sitesQuery = useQuery({
    queryKey: ["directory-sites", workspaceId],
    enabled: enrichEnabled && canViewSites,
    queryFn: () => api.listSites(workspaceId!, { limit: 50 }),
    staleTime: 60_000,
  });

  const quotesQuery = useQuery({
    queryKey: ["directory-quotes", workspaceId],
    enabled: enrichEnabled && canViewQuotes,
    queryFn: () => api.listQuotes(workspaceId!, { limit: 50 }),
    staleTime: 60_000,
  });

  const projectsQuery = useQuery({
    queryKey: ["directory-projects", workspaceId],
    enabled: enrichEnabled && canViewProjects,
    queryFn: () => api.listProjects(workspaceId!, { limit: 50 }),
    staleTime: 60_000,
  });

  const serviceQuery = useQuery({
    queryKey: ["directory-service", workspaceId],
    enabled: enrichEnabled && canViewService,
    queryFn: () => api.listServiceCalls(workspaceId!, { limit: 50 }),
    staleTime: 60_000,
  });

  const leadsQuery = useQuery({
    queryKey: ["directory-leads", workspaceId],
    enabled: enrichEnabled && canViewLeads,
    queryFn: () => api.listLeads(workspaceId!, { limit: 50 }),
    staleTime: 60_000,
  });
  const rows = useMemo(
    () =>
      buildCustomerDirectoryRows({
        customers: customerItems,
        sites: sitesQuery.data?.items ?? [],
        quotes: quotesQuery.data?.items ?? [],
        projects: projectsQuery.data?.items ?? [],
        serviceCalls: serviceQuery.data?.items ?? [],
        leads: leadsQuery.data?.items ?? [],
      }),
    [
      customerItems,
      sitesQuery.data?.items,
      quotesQuery.data?.items,
      projectsQuery.data?.items,
      serviceQuery.data?.items,
      leadsQuery.data?.items,
    ],
  );

  const { filtered, summary } = useCustomerDirectoryView(rows, { ...filter, status: undefined }, {
    query,
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
      void queryClient.invalidateQueries({ queryKey: ["activation-customers", workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ["usage", workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", workspaceId] });
      if (canCreateQuote) {
        setCreatedCustomerId(row.id);
      } else {
        void navigate({ to: "/app/customers/$customerId", params: { customerId: row.id } });
      }
    },
    onError: (err) => {
      setFormError(planQuotaMessage(err) ?? (err instanceof ApiClientError ? err.message : he.customersError));
    },
  });

  const exportCsv = useMutation({
    mutationFn: async () => {
      if (!workspaceId) return;
      const { blob, filename } = await api.exportCustomersCsv(workspaceId, {
        q: debouncedQuery,
        status: filter.status,
      });
      downloadCsv(blob, filename);
    },
    onError: () => setExportError(he.exportCsvError),
    onSuccess: () => setExportError(null),
  });

  const previewCsv = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const preview = await api.previewCustomersCsv(workspaceId!, text);
      return { text, preview };
    },
    onSuccess: ({ text, preview }) => {
      setImportCsvText(text);
      setImportPreview(preview);
      setImportMessage(null);
    },
    onError: (err) => {
      setImportPreview(null);
      setImportCsvText(null);
      setImportMessage(planQuotaMessage(err) ?? (err instanceof ApiClientError ? err.message : he.customersError));
    },
  });

  const importCsv = useMutation({
    mutationFn: async (text: string) => api.importCustomersCsv(workspaceId!, text),
    onSuccess: (result) => {
      setImportMessage(he.customersImportResult(result.created, result.skipped));
      if (result.errors.length) {
        setImportMessage(`${he.customersImportResult(result.created, result.skipped)}. ${result.errors.slice(0, 5).join(" · ")}`);
      }
      setImportPreview(null);
      setImportCsvText(null);
      void queryClient.invalidateQueries({ queryKey: ["customers", workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ["usage", workspaceId] });
    },
    onError: (err) => {
      setImportMessage(planQuotaMessage(err) ?? (err instanceof ApiClientError ? err.message : he.customersError));
    },
  });

  if (!workspaceId) return <ErrorState title={he.customersError} />;
  if (listQuery.isError) {
    return (
      <ErrorState
        title={he.customersError}
        action={
          <Button
            type="button"
            variant="secondary"
            data-testid="customers-retry"
            onClick={() => void listQuery.refetch()}
          >
            {he.retry}
          </Button>
        }
      />
    );
  }

  return (
    <div className="customer-dir space-y-4">
      <CustomerDirectoryHeader summary={listQuery.isLoading ? null : summary} />

      {!listQuery.isLoading ? <CustomerDirectoryMetrics summary={summary} /> : null}

      <CustomerDirectoryToolbar
        query={query}
        onQueryChange={setQuery}
        onClearSearch={() => {
          setQuery("");
          setFilter({});
        }}
        filter={filter}
        onFilterChange={setFilter}
        canCreate={canCreate}
        creating={creating}
        onToggleCreate={() => {
          setCreating((v) => !v);
          setFormError(null);
        }}
        canExport={canExport}
        exportBusy={exportCsv.isPending}
        onExport={canExport ? () => exportCsv.mutate() : undefined}
        canImport={canCreate}
        importBusy={previewCsv.isPending || importCsv.isPending}
        onImportFile={canCreate ? (file) => previewCsv.mutate(file) : undefined}
      />
      {exportError ? <p className="text-sm text-danger">{exportError}</p> : null}
      {importMessage ? (
        <p className="text-sm text-fg-muted" data-testid="customers-import-message">
          {importMessage}
        </p>
      ) : null}
      {importPreview ? (
        <section
          className="ops-card space-y-3 p-4"
          data-testid="customers-import-preview"
          aria-label={he.customersImportPreviewTitle}
        >
          <h2 className="text-sm font-semibold text-fg">{he.customersImportPreviewTitle}</h2>
          <p className="text-sm text-fg-muted">{he.customersImportHint}</p>
          <p className="text-sm text-fg">
            {he.customersImportValid(importPreview.valid_count)}
            {importPreview.error_count ? ` · ${he.customersImportBlocked(importPreview.error_count)}` : ""}
          </p>
          <ul className="max-h-48 space-y-1 overflow-auto text-sm">
            {importPreview.rows.slice(0, 20).map((row) => (
              <li key={row.row} className={row.importable ? "text-fg" : "text-danger"}>
                {row.row}. {row.display_name || "—"}
                {row.phone ? ` · ${row.phone}` : ""}
                {row.email ? ` · ${row.email}` : ""}
                {row.issues.length ? ` — ${row.issues.join(" · ")}` : ""}
              </li>
            ))}
          </ul>
          {importPreview.errors.length ? (
            <div data-testid="customers-import-errors">
              <p className="text-sm font-medium text-fg">{he.customersImportErrors}</p>
              <ul className="mt-1 list-disc pe-5 text-sm text-danger">
                {importPreview.errors.slice(0, 10).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              data-testid="customers-import-confirm"
              disabled={!importPreview.valid_count || !importCsvText}
              loading={importCsv.isPending}
              onClick={() => importCsvText && importCsv.mutate(importCsvText)}
            >
              {he.customersImportConfirm}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setImportPreview(null);
                setImportCsvText(null);
              }}
            >
              {he.customersImportCancel}
            </Button>
          </div>
        </section>
      ) : null}

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
      {listQuery.hasNextPage ? (
        <Button
          type="button"
          variant="secondary"
          data-testid="customers-load-more"
          loading={listQuery.isFetchingNextPage}
          onClick={() => void listQuery.fetchNextPage()}
        >
          {he.customersLoadMore}
        </Button>
      ) : null}

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
