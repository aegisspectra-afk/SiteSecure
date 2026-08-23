import { ApiClientError } from "@site-secure/api-client";
import { Button, ErrorState, PageHeader, Status } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, FileText } from "lucide-react";
import type { ReactNode } from "react";
import { addressLine } from "../../../components/modules/ModuleKit";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { projectStatusLabel } from "../../../lib/customer-profile";
import { formatDay } from "../../../lib/quotes";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/projects/$projectId")({
  component: ProjectDetailPage,
});

function ProjectDetailPage() {
  return (
    <RequirePermission permission="projects.view">
      <ProjectDetailBody />
    </RequirePermission>
  );
}

function ProjectDetailBody() {
  const { projectId } = Route.useParams();
  const { session, api } = useSession();
  const navigate = useNavigate();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;

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

  const quoteQuery = useQuery({
    queryKey: ["quote", workspaceId, quoteId],
    enabled: Boolean(workspaceId && quoteId),
    queryFn: () => api.getQuote(workspaceId!, quoteId!),
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
  const customerName = customerQuery.data?.display_name ?? "—";
  const siteName = siteQuery.data?.name ?? "—";
  const siteAddress = siteQuery.data ? addressLine(siteQuery.data.address) : "";
  const quoteNumber = quoteQuery.data?.number;

  return (
    <div className="project-detail space-y-4">
      <Link
        to="/app/projects"
        search={{ quoteId: undefined, customerId: undefined, siteId: undefined }}
        className="customer-360-back inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {he.projectBack}
      </Link>

      <PageHeader
        title={project.name}
        description={
          quoteNumber ? he.projectCreatedFromQuote(quoteNumber) : he.projectsLead
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Status label={projectStatusLabel(project.status)} />
            {quoteId ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => void navigate({ to: "/app/quotes/$quoteId", params: { quoteId } })}
              >
                <FileText className="size-4" aria-hidden />
                {he.projectSourceQuoteLabel}
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="ops-card grid gap-3 p-4 text-sm sm:grid-cols-2">
        <div>
          <p className="text-fg-muted">{he.navCustomers}</p>
          {customerId ? (
            <Link
              to="/app/customers/$customerId"
              params={{ customerId }}
              className="font-medium text-fg hover:underline"
            >
              {customerName}
            </Link>
          ) : (
            <p className="font-medium text-fg">{customerName}</p>
          )}
        </div>
        <div>
          <p className="text-fg-muted">{he.navSiteFiles}</p>
          {siteId ? (
            <Link to="/app/sites/$siteId" params={{ siteId }} className="font-medium text-fg hover:underline">
              {siteName}
            </Link>
          ) : (
            <p className="font-medium text-fg">{siteName}</p>
          )}
          {siteAddress ? <p className="mt-0.5 text-xs text-fg-muted">{siteAddress}</p> : null}
        </div>
      </div>

      <section className="ops-card p-4 sm:p-5">
        <h2 className="mb-4 text-base font-semibold text-fg">{he.projectDetailTitle}</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Detail label={he.navCustomers} value={customerName} />
          <Detail label={he.navSiteFiles} value={siteName} />
          <Detail
            label={he.projectSourceQuote}
            value={
              quoteId && quoteNumber ? (
                <Link to="/app/quotes/$quoteId" params={{ quoteId }} className="font-medium hover:underline">
                  #{quoteNumber}
                </Link>
              ) : (
                "—"
              )
            }
          />
          <Detail label={he.projectCreatedAt} value={formatDay(project.created_at) || "—"} />
          <Detail label={he.status} value={projectStatusLabel(project.status)} />
        </dl>
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="text-sm text-fg">{value}</dd>
    </div>
  );
}
