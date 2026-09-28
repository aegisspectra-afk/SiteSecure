import { ApiClientError, type ProjectOut } from "@site-secure/api-client";
import { Button, ErrorState, Input, Select, Status } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { he } from "../../i18n/he";
import { can } from "../../lib/can";
import { projectStatusLabel } from "../../lib/customer-profile";
import {
  formatProjectListMeta,
  PROJECT_STATUS_VALUES,
  projectStatusTone,
} from "../../lib/project-workspace";
import { useSession } from "../../lib/session";
import { resolveProjectContext, type ProjectCreateContext } from "../../lib/workflow-context";

export type ProjectsListSearch = ProjectCreateContext;

type ProjectsListPageProps = {
  search?: ProjectsListSearch;
};

export function ProjectsListPage({ search = {} }: ProjectsListPageProps) {
  const { session, api } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const roleKey = membership?.role_key;
  const features = membership?.features ?? [];
  const permissions = membership?.permissions;
  const canCreate = can(roleKey, "projects.create", features, permissions);
  const canCrm = can(roleKey, "crm.view", features, permissions);

  const context = resolveProjectContext(search);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [customerFilter, setCustomerFilter] = useState(context.customerId ?? "");
  const [creating, setCreating] = useState(
    Boolean(canCreate && (context.customerId || context.siteId || context.quoteId)),
  );
  const [name, setName] = useState("");
  const [createCustomerId, setCreateCustomerId] = useState(context.customerId ?? "");
  const [createSiteId, setCreateSiteId] = useState(context.siteId ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (context.customerId) setCustomerFilter(context.customerId);
    if (context.customerId) setCreateCustomerId(context.customerId);
    if (context.siteId) setCreateSiteId(context.siteId);
    if (canCreate && (context.customerId || context.siteId || context.quoteId)) {
      setCreating(true);
    }
  }, [canCreate, context.customerId, context.siteId, context.quoteId]);

  const customersQuery = useQuery({
    queryKey: ["customers-pick", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listCustomers(workspaceId!, { limit: 100 }),
  });

  const sitesQuery = useQuery({
    queryKey: ["sites-pick", workspaceId, createCustomerId],
    enabled: Boolean(workspaceId && createCustomerId && creating),
    queryFn: () => api.listSites(workspaceId!, { customer_id: createCustomerId, limit: 100 }),
  });

  useEffect(() => {
    if (!creating || !createCustomerId || createSiteId || context.siteId) return;
    const sites = sitesQuery.data?.items ?? [];
    if (sites.length === 1) setCreateSiteId(sites[0].id);
  }, [creating, createCustomerId, createSiteId, context.siteId, sitesQuery.data?.items]);

  const listQuery = useQuery({
    queryKey: [
      "projects",
      workspaceId,
      q,
      status,
      customerFilter,
      context.quoteId ?? "",
    ],
    enabled: Boolean(workspaceId),
    queryFn: () =>
      api.listProjects(workspaceId!, {
        q: q.trim() || undefined,
        status: status || undefined,
        customer_id: customerFilter || undefined,
        source_quote_id: context.quoteId || undefined,
        limit: 100,
      }),
  });

  const projects = listQuery.data?.items ?? [];
  const customerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of customersQuery.data?.items ?? []) {
      map.set(row.id, row.display_name);
    }
    return map;
  }, [customersQuery.data?.items]);

  const siteIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of projects) {
      if (row.site_id) ids.add(row.site_id);
    }
    return [...ids].sort();
  }, [projects]);

  const sitesLookupQuery = useQuery({
    queryKey: ["project-list-sites", workspaceId, siteIds.join(",")],
    enabled: Boolean(workspaceId && siteIds.length),
    queryFn: async () => {
      const entries = await Promise.all(
        siteIds.map(async (id) => {
          try {
            const site = await api.getSite(workspaceId!, id);
            return [id, site.name] as const;
          } catch {
            return [id, null] as const;
          }
        }),
      );
      return Object.fromEntries(entries) as Record<string, string | null>;
    },
  });

  const createSites = sitesQuery.data?.items ?? [];
  const filtersActive = Boolean(
    q.trim() || status || customerFilter || context.quoteId,
  );

  const create = useMutation({
    mutationFn: () =>
      api.createProject(workspaceId!, {
        name: name.trim(),
        customer_id: createCustomerId,
        site_id: createSiteId || undefined,
        source_quote_id: context.quoteId || undefined,
      }),
    onSuccess: (project) => {
      setCreating(false);
      setName("");
      setCreateCustomerId(context.customerId ?? "");
      setCreateSiteId(context.siteId ?? "");
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ["projects", workspaceId] });
      void navigate({ to: "/app/projects/$projectId", params: { projectId: project.id } });
    },
    onError: (err) => setFormError(err instanceof ApiClientError ? err.message : he.projectsError),
  });

  function resetFilters() {
    setQ("");
    setStatus("");
    setCustomerFilter("");
  }

  function onCustomerChange(next: string) {
    setCreateCustomerId(next);
    setCreateSiteId("");
  }

  function canSubmitCreate() {
    if (!name.trim() || !createCustomerId) return false;
    if (createSites.length > 0 && !createSiteId) return false;
    return true;
  }

  if (!workspaceId) return <ErrorState title={he.projectsError} />;

  return (
    <div className="projects-list-page" data-testid="projects-list-page">
      <header className="projects-list-header">
        <div>
          <h1 className="projects-list-title">{he.projectsTitle}</h1>
          <p className="projects-list-lead">{he.projectsLead}</p>
        </div>
        {canCreate ? (
          <Button
            type="button"
            variant={creating ? "secondary" : "primary"}
            onClick={() => {
              setCreating((v) => !v);
              setFormError(null);
            }}
            data-testid="projects-create-toggle"
          >
            {creating ? he.cancel : he.projectsCreate}
          </Button>
        ) : null}
      </header>

      {creating && canCreate ? (
        <form
          className="projects-list-create"
          data-testid="projects-create-panel"
          onSubmit={(ev: FormEvent) => {
            ev.preventDefault();
            if (!canSubmitCreate()) return;
            create.mutate();
          }}
        >
          {context.quoteId ? (
            <p className="projects-list-context-hint" data-testid="projects-quote-context">
              {he.projectsFromQuoteHint}
            </p>
          ) : null}
          <Select
            id="project-customer"
            label={he.pickCustomer}
            value={createCustomerId}
            onChange={(ev) => onCustomerChange(ev.target.value)}
          >
            <option value="">{he.pickCustomer}</option>
            {(customersQuery.data?.items ?? []).map((row) => (
              <option key={row.id} value={row.id}>
                {row.display_name}
              </option>
            ))}
          </Select>
          {createCustomerId ? (
            <Select
              id="project-site"
              label={he.pickSite}
              value={createSiteId}
              onChange={(ev) => setCreateSiteId(ev.target.value)}
              required={createSites.length > 0}
            >
              <option value="">
                {createSites.length > 0 ? he.pickSite : he.projectsNoSitesForCustomer}
              </option>
              {createSites.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </Select>
          ) : null}
          {createCustomerId && createSites.length === 0 && !sitesQuery.isLoading ? (
            <p className="text-sm text-fg-muted">{he.projectsCreateNeedsSiteHint}</p>
          ) : null}
          <Input
            id="project-name"
            label={he.name}
            value={name}
            onChange={(ev) => setName(ev.target.value)}
            required
          />
          {formError ? (
            <p className="text-sm text-danger" role="alert">
              {formError}
            </p>
          ) : null}
          <Button type="submit" loading={create.isPending} disabled={!canSubmitCreate() || create.isPending}>
            {he.save}
          </Button>
        </form>
      ) : null}

      <div className="projects-list-filters" data-testid="projects-list-filters">
        <Input
          id="projects-search"
          label={he.projectsSearch}
          value={q}
          onChange={(ev) => setQ(ev.target.value)}
          placeholder={he.projectsSearchPlaceholder}
        />
        <Select
          id="projects-status"
          label={he.projectsFilterStatus}
          value={status}
          onChange={(ev) => setStatus(ev.target.value)}
        >
          <option value="">{he.projectsFilterStatusAll}</option>
          {PROJECT_STATUS_VALUES.map((value) => (
            <option key={value} value={value}>
              {projectStatusLabel(value)}
            </option>
          ))}
        </Select>
        {canCrm ? (
          <Select
            id="projects-customer"
            label={he.projectsFilterCustomer}
            value={customerFilter}
            onChange={(ev) => setCustomerFilter(ev.target.value)}
          >
            <option value="">{he.projectsFilterCustomerAll}</option>
            {(customersQuery.data?.items ?? []).map((row) => (
              <option key={row.id} value={row.id}>
                {row.display_name}
              </option>
            ))}
          </Select>
        ) : null}
        {filtersActive ? (
          <div className="projects-list-filter-reset">
            <Button type="button" variant="secondary" onClick={resetFilters}>
              {he.projectsFilterReset}
            </Button>
          </div>
        ) : null}
      </div>

      {context.quoteId ? (
        <p className="projects-list-active-context" data-testid="projects-source-quote-filter">
          {he.projectsFilteredByQuote}
        </p>
      ) : null}

      {listQuery.isLoading ? (
        <p className="text-sm text-fg-muted">{he.loading}</p>
      ) : listQuery.isError ? (
        <ErrorState
          title={
            listQuery.error instanceof ApiClientError
              ? listQuery.error.message
              : he.projectsError
          }
          action={
            <Button type="button" variant="secondary" onClick={() => void listQuery.refetch()}>
              {he.retry}
            </Button>
          }
        />
      ) : projects.length === 0 && !filtersActive ? (
        <div className="projects-list-empty" data-testid="projects-list-empty">
          <p className="projects-list-empty-title">{he.projectsEmptyTitle}</p>
          <p className="projects-list-empty-body">{he.projectsEmptyBody}</p>
          {canCreate ? (
            <Button
              type="button"
              className="mt-3"
              onClick={() => {
                setCreating(true);
                setFormError(null);
              }}
            >
              {he.projectsCreate}
            </Button>
          ) : null}
        </div>
      ) : projects.length === 0 ? (
        <div className="projects-list-empty" data-testid="projects-list-filtered-empty">
          <p className="projects-list-empty-title">{he.projectsFilteredEmptyTitle}</p>
          <div className="mt-3">
            <Button type="button" variant="secondary" onClick={resetFilters}>
              {he.projectsFilterReset}
            </Button>
          </div>
        </div>
      ) : (
        <ul className="projects-list-rows" data-testid="projects-list-rows">
          {projects.map((row) => (
            <li key={row.id}>
              <ProjectListRow
                project={row}
                customerName={customerNameById.get(row.customer_id)}
                siteName={row.site_id ? sitesLookupQuery.data?.[row.site_id] : null}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProjectListRow({
  project,
  customerName,
  siteName,
}: {
  project: ProjectOut;
  customerName?: string;
  siteName?: string | null;
}) {
  const meta = formatProjectListMeta(project, { customerName, siteName });
  return (
    <Link
      to="/app/projects/$projectId"
      params={{ projectId: project.id }}
      className="project-list-card"
      data-testid="project-list-row"
    >
      <div className="project-list-card-main">
        <p className="project-list-card-title">{project.name}</p>
        <p className="project-list-card-meta" data-testid="project-list-meta">
          {meta}
        </p>
      </div>
      <div className="project-list-card-trailing">
        <Status label={projectStatusLabel(project.status)} tone={projectStatusTone(project.status)} />
        <ChevronLeft className="project-list-card-chevron rtl:rotate-180" aria-hidden />
      </div>
    </Link>
  );
}
