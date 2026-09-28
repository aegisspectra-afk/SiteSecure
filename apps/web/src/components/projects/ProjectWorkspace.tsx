import { ApiClientError } from "@site-secure/api-client";
import type { CreateInstalledAssetsPreviewOut } from "@site-secure/api-client";
import { Button, ErrorState, Select, Status } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, FileText } from "lucide-react";
import { useState, type ReactNode } from "react";
import { addressLine } from "../modules/ModuleKit";
import { he } from "../../i18n/he";
import { can } from "../../lib/can";
import { projectStatusLabel } from "../../lib/customer-profile";
import { formatDay } from "../../lib/quotes";
import {
  deriveProjectJobSummary,
  formatProjectJobSummary,
  PROJECT_STATUS_VALUES,
  projectStatusTone,
} from "../../lib/project-workspace";
import { useSession } from "../../lib/session";
import { CreateInstalledAssetsConfirm } from "./CreateInstalledAssetsConfirm";
import { ProjectJobCard } from "./ProjectJobCard";
import { ProjectPlannedScope } from "./ProjectPlannedScope";

type ProjectWorkspaceProps = {
  projectId: string;
};

export function ProjectWorkspace({ projectId }: ProjectWorkspaceProps) {
  const { session, api } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const roleKey = membership?.role_key;
  const features = membership?.features ?? [];
  const permissions = membership?.permissions;
  const canJobsView = can(roleKey, "jobs.view", features, permissions);
  const canJobsCreate = can(roleKey, "jobs.create", features, permissions);
  const canQuotesView = can(roleKey, "quotes.view", features, permissions);
  const canCustomersView = can(roleKey, "crm.view", features, permissions);
  const canSitesView = can(roleKey, "sites.view", features, permissions);
  const canProjectsEdit = can(roleKey, "projects.edit", features, permissions);
  const canSystemsEdit = can(roleKey, "systems.edit", features, permissions);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [createAssetsOpen, setCreateAssetsOpen] = useState(false);
  const [createAssetsPreview, setCreateAssetsPreview] = useState<CreateInstalledAssetsPreviewOut | null>(null);
  const [createAssetsError, setCreateAssetsError] = useState<string | null>(null);
  const [createAssetsResultMsg, setCreateAssetsResultMsg] = useState<string | null>(null);

  const projectQuery = useQuery({
    queryKey: ["project", workspaceId, projectId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getProject(workspaceId!, projectId),
  });

  const customerId = projectQuery.data?.customer_id;
  const siteId = projectQuery.data?.site_id ?? undefined;
  const quoteId = projectQuery.data?.source_quote_id ?? undefined;

  const customerQuery = useQuery({
    queryKey: ["customer", workspaceId, customerId],
    enabled: Boolean(workspaceId && customerId),
    queryFn: () => api.getCustomer(workspaceId!, customerId!),
  });

  const siteQuery = useQuery({
    queryKey: ["site", workspaceId, siteId],
    enabled: Boolean(workspaceId && siteId),
    queryFn: () => api.getSite(workspaceId!, siteId!),
  });

  const jobsQuery = useQuery({
    queryKey: ["project-jobs", workspaceId, projectId],
    enabled: Boolean(workspaceId && canJobsView),
    queryFn: () => api.listJobs(workspaceId!, { project_id: projectId, limit: 100 }),
  });

  const quoteQuery = useQuery({
    queryKey: ["quote", workspaceId, quoteId],
    enabled: Boolean(workspaceId && quoteId && canQuotesView),
    queryFn: () => api.getQuote(workspaceId!, quoteId!),
    retry: false,
  });

  const canProjectsView = can(roleKey, "projects.view", features, permissions);
  const plannedScopeQuery = useQuery({
    queryKey: ["project-planned-items", workspaceId, projectId],
    enabled: Boolean(workspaceId && canProjectsView),
    queryFn: () => api.listProjectPlannedItems(workspaceId!, projectId),
    retry: false,
  });

  const startInstall = useMutation({
    mutationFn: () =>
      api.createJob(workspaceId!, {
        title: he.installationJobTitle(projectQuery.data?.name ?? siteQuery.data?.name ?? ""),
        customer_id: customerId!,
        site_id: siteId!,
        kind: "installation",
        project_id: projectId,
      }),
    onSuccess: (job) => {
      void queryClient.invalidateQueries({ queryKey: ["project-jobs", workspaceId, projectId] });
      void queryClient.invalidateQueries({ queryKey: ["site-jobs", workspaceId, siteId] });
      void queryClient.invalidateQueries({ queryKey: ["jobs-list"] });
      void navigate({
        to: "/app/jobs/$jobId",
        params: { jobId: job.id },
        search: { from: "project", projectId },
      });
    },
  });

  const patchStatus = useMutation({
    mutationFn: (nextStatus: string) => api.patchProject(workspaceId!, projectId, { status: nextStatus }),
    onSuccess: () => {
      setStatusError(null);
      void queryClient.invalidateQueries({ queryKey: ["project", workspaceId, projectId] });
      void queryClient.invalidateQueries({ queryKey: ["projects", workspaceId] });
    },
    onError: (err) => {
      setStatusError(err instanceof ApiClientError ? err.message : he.projectStatusUpdateError);
    },
  });

  const openCreateAssets = async () => {
    if (!workspaceId) return;
    setCreateAssetsError(null);
    try {
      const preview = await api.previewCreateInstalledAssets(workspaceId, projectId);
      setCreateAssetsPreview(preview);
      setCreateAssetsOpen(true);
    } catch (err) {
      setCreateAssetsError(
        err instanceof ApiClientError ? err.message : he.projectCreateInstalledAssetsError,
      );
      setCreateAssetsPreview(null);
      setCreateAssetsOpen(true);
    }
  };

  const createInstalledAssets = useMutation({
    mutationFn: () => api.createInstalledAssets(workspaceId!, projectId),
    onSuccess: (result) => {
      setCreateAssetsError(null);
      setCreateAssetsOpen(false);
      setCreateAssetsResultMsg(
        result.created > 0
          ? he.projectCreateInstalledAssetsSuccess(result.created)
          : result.message || he.projectCreateInstalledAssetsAlready,
      );
      void queryClient.invalidateQueries({ queryKey: ["project-planned-items", workspaceId, projectId] });
      void queryClient.invalidateQueries({ queryKey: ["site-equipment", workspaceId, siteId] });
      void queryClient.invalidateQueries({ queryKey: ["equipment", workspaceId] });
    },
    onError: (err) => {
      setCreateAssetsError(
        err instanceof ApiClientError ? err.message : he.projectCreateInstalledAssetsError,
      );
    },
  });

  if (!workspaceId) return <ErrorState title={he.projectLoadError} />;
  if (projectQuery.isError) {
    const msg =
      projectQuery.error instanceof ApiClientError ? projectQuery.error.message : he.projectLoadError;
    return <ErrorState title={msg} />;
  }
  if (projectQuery.isLoading || !projectQuery.data) {
    return <p className="text-sm text-fg-muted">{he.loading}</p>;
  }

  const project = projectQuery.data;
  const customerPending = Boolean(customerId) && (customerQuery.isLoading || customerQuery.isFetching);
  const sitePending = Boolean(siteId) && (siteQuery.isLoading || siteQuery.isFetching);
  const customerName = customerPending
    ? he.loading
    : customerQuery.data?.display_name?.trim() || he.projectNotDefined;
  const hasSite = Boolean(siteId);
  const siteName = !hasSite
    ? he.projectNotDefined
    : sitePending
      ? he.loading
      : siteQuery.data?.name?.trim() || he.projectNotDefined;
  const siteAddress = siteQuery.data ? addressLine(siteQuery.data.address) : "";
  const jobs = jobsQuery.data?.items ?? [];
  const summary = deriveProjectJobSummary(jobs);
  const summaryLabel = formatProjectJobSummary(summary);

  const quoteForbidden =
    quoteQuery.isError &&
    quoteQuery.error instanceof ApiClientError &&
    (quoteQuery.error.status === 403 || quoteQuery.error.status === 401);
  const quoteNumber = canQuotesView && !quoteForbidden ? quoteQuery.data?.number : undefined;
  // Prefer frozen pin on the project — live quote.version would follow later revises.
  const pinnedVersion = projectQuery.data?.source_quote_version ?? null;
  const quoteVersion =
    pinnedVersion != null && pinnedVersion > 0
      ? pinnedVersion
      : undefined;
  const showSourceQuote = Boolean(quoteId && canQuotesView && !quoteForbidden && quoteNumber);
  const sourceQuoteLabel =
    quoteNumber != null ? he.projectSourceQuoteValue(quoteNumber, quoteVersion) : null;

  const canStartInstall = Boolean(canJobsCreate && customerId && siteId);
  const jobsError =
    jobsQuery.isError &&
    (jobsQuery.error instanceof ApiClientError ? jobsQuery.error.message : he.projectJobsError);

  return (
    <div className="project-workspace" data-testid="project-workspace">
      <Link
        to="/app/projects"
        search={{ quoteId: undefined, customerId: undefined, siteId: undefined }}
        className="project-workspace-back inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
      >
        <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
        {he.projectBackToList}
      </Link>

      <header className="project-workspace-header">
        <div className="project-workspace-header-main">
          <h1 className="project-workspace-title">{project.name}</h1>
          <p className="project-workspace-context" data-testid="project-context">
            <span data-testid="project-customer-label">{customerName}</span>
            <span className="project-workspace-context-sep" aria-hidden>
              ·
            </span>
            <span data-testid="project-site-label">{siteName}</span>
          </p>
          <div className="project-workspace-status-row">
            {canProjectsEdit ? (
              <div className="project-workspace-status-edit" data-testid="project-status-edit">
                <Select
                  id="project-status"
                  label={he.status}
                  value={project.status}
                  disabled={patchStatus.isPending}
                  onChange={(ev) => {
                    const next = ev.target.value;
                    if (!next || next === project.status) return;
                    patchStatus.mutate(next);
                  }}
                >
                  {!PROJECT_STATUS_VALUES.includes(
                    project.status as (typeof PROJECT_STATUS_VALUES)[number],
                  ) ? (
                    <option value={project.status}>{projectStatusLabel(project.status)}</option>
                  ) : null}
                  {PROJECT_STATUS_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {projectStatusLabel(value)}
                    </option>
                  ))}
                </Select>
                {statusError ? (
                  <p className="mt-1 text-sm text-danger" role="alert">
                    {statusError}
                  </p>
                ) : null}
              </div>
            ) : (
              <Status label={projectStatusLabel(project.status)} tone={projectStatusTone(project.status)} />
            )}
          </div>
          {canJobsView && !jobsQuery.isLoading && !jobsQuery.isError ? (
            <p className="project-workspace-summary" data-testid="project-ops-summary">
              {summaryLabel}
            </p>
          ) : null}
        </div>
        <div className="project-workspace-header-actions">
          {showSourceQuote && quoteId ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => void navigate({ to: "/app/quotes/$quoteId", params: { quoteId } })}
              data-testid="project-source-quote"
            >
              <FileText className="size-4" aria-hidden />
              {sourceQuoteLabel ?? he.projectSourceQuoteLabel}
            </Button>
          ) : null}
          {canStartInstall ? (
            <Button
              type="button"
              loading={startInstall.isPending}
              disabled={startInstall.isPending}
              onClick={() => startInstall.mutate()}
              data-testid="project-start-install"
            >
              {he.projectStartInstallation}
            </Button>
          ) : null}
        </div>
      </header>

      {startInstall.isError ? (
        <p className="text-sm text-danger" role="alert">
          {startInstall.error instanceof ApiClientError
            ? startInstall.error.message
            : he.projectJobsCreateError}
        </p>
      ) : null}

      <div className="project-workspace-layout">
        <section className="project-workspace-jobs" aria-labelledby="project-jobs-heading">
          <div className="project-workspace-jobs-head">
            <h2 id="project-jobs-heading" className="project-workspace-section-title">
              {he.projectJobsTitle}
            </h2>
          </div>

          {!canJobsView ? (
            <p className="text-sm text-fg-muted">{he.projectJobsDenied}</p>
          ) : jobsQuery.isLoading ? (
            <p className="text-sm text-fg-muted">{he.loading}</p>
          ) : jobsError ? (
            <ErrorState title={jobsError} />
          ) : jobs.length === 0 ? (
            <div className="project-workspace-empty" data-testid="project-jobs-empty">
              <p className="project-workspace-empty-title">{he.projectJobsEmptyTitle}</p>
              <p className="project-workspace-empty-body">{he.projectJobsEmptyBody}</p>
              {!hasSite ? (
                <p className="mt-2 text-sm text-fg-muted">{he.projectJobsEmptyNeedsSite}</p>
              ) : null}
              {canStartInstall ? (
                <div className="mt-4">
                  <Button
                    type="button"
                    loading={startInstall.isPending}
                    disabled={startInstall.isPending}
                    onClick={() => startInstall.mutate()}
                  >
                    {he.projectStartInstallation}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <ul className="project-job-list">
              {jobs.map((job) => (
                <li key={job.id}>
                  <ProjectJobCard job={job} projectId={projectId} />
                </li>
              ))}
            </ul>
          )}

          {canProjectsView ? (
            <div className="mt-6">
              <ProjectPlannedScope
                items={plannedScopeQuery.data?.items ?? []}
                loading={plannedScopeQuery.isLoading}
                error={
                  plannedScopeQuery.isError
                    ? plannedScopeQuery.error instanceof ApiClientError
                      ? plannedScopeQuery.error.message
                      : he.projectPlannedScopeError
                    : null
                }
                sourceVersion={project.source_quote_version ?? null}
                canCreateInstalled={Boolean(canSystemsEdit && siteId)}
                onCreateInstalled={() => void openCreateAssets()}
                createResultMessage={createAssetsResultMsg}
                siteId={siteId}
              />
            </div>
          ) : null}
        </section>

        <CreateInstalledAssetsConfirm
          open={createAssetsOpen}
          onClose={() => {
            if (!createInstalledAssets.isPending) {
              setCreateAssetsOpen(false);
              setCreateAssetsError(null);
            }
          }}
          onConfirm={() => createInstalledAssets.mutate()}
          pending={createInstalledAssets.isPending}
          preview={createAssetsPreview}
          error={createAssetsError}
        />

        <aside className="project-workspace-details" aria-labelledby="project-details-heading">
          <h2 id="project-details-heading" className="project-workspace-section-title">
            {he.projectDetailTitle}
          </h2>
          <dl className="project-details-list">
            <Detail
              label={he.navCustomers}
              value={
                customerId && canCustomersView ? (
                  <Link
                    to="/app/customers/$customerId"
                    params={{ customerId }}
                    className="font-medium text-fg hover:underline"
                  >
                    {customerName}
                  </Link>
                ) : (
                  customerName
                )
              }
            />
            <Detail
              label={he.navSiteFiles}
              value={
                <>
                  {siteId && canSitesView ? (
                    <Link
                      to="/app/sites/$siteId"
                      params={{ siteId }}
                      className="font-medium text-fg hover:underline"
                    >
                      {siteName}
                    </Link>
                  ) : (
                    <span className="font-medium text-fg">{siteName}</span>
                  )}
                  {siteAddress ? <p className="mt-0.5 text-xs text-fg-muted">{siteAddress}</p> : null}
                </>
              }
            />
            {showSourceQuote && quoteId && sourceQuoteLabel ? (
              <Detail
                label={he.projectSourceQuote}
                value={
                  <Link
                    to="/app/quotes/$quoteId"
                    params={{ quoteId }}
                    className="font-medium hover:underline"
                    data-testid="project-source-quote-link"
                  >
                    {sourceQuoteLabel}
                  </Link>
                }
              />
            ) : null}
            <Detail
              label={he.status}
              value={
                <Status
                  label={projectStatusLabel(project.status)}
                  tone={projectStatusTone(project.status)}
                />
              }
            />
            <Detail label={he.projectCreatedAt} value={formatDay(project.created_at) || "—"} />
            <Detail
              label={he.projectUpdatedAt}
              value={formatDay(project.updated_at) || "—"}
            />
          </dl>
        </aside>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="project-details-item">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="mt-1 text-sm text-fg">{value}</dd>
    </div>
  );
}
