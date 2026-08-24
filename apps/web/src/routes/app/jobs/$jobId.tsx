import { ApiClientError } from "@site-secure/api-client";
import { Button, ErrorState, PageHeader, Status } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/jobs/$jobId")({
  component: JobDetailPage,
});

function JobDetailPage() {
  return (
    <RequirePermission permission="jobs.view">
      <JobDetailBody />
    </RequirePermission>
  );
}

function JobDetailBody() {
  const { jobId } = Route.useParams();
  const { session, api } = useSession();
  const queryClient = useQueryClient();
  const workspaceId = session?.memberships[0]?.workspace_id;

  const jobQuery = useQuery({
    queryKey: ["job", workspaceId, jobId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getJob(workspaceId!, jobId),
  });

  const checklistQuery = useQuery({
    queryKey: ["job-checklist", workspaceId, jobId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listJobChecklist(workspaceId!, jobId),
  });

  const start = useMutation({
    mutationFn: () => api.startJob(workspaceId!, jobId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["job", workspaceId, jobId] });
    },
  });

  const complete = useMutation({
    mutationFn: () => api.completeJob(workspaceId!, jobId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["job", workspaceId, jobId] });
      if (jobQuery.data?.site_id) {
        void queryClient.invalidateQueries({ queryKey: ["site", workspaceId, jobQuery.data.site_id] });
      }
    },
  });

  const toggleItem = useMutation({
    mutationFn: (input: { itemId: string; completed: boolean }) =>
      api.patchJobChecklistItem(workspaceId!, jobId, input.itemId, { completed: input.completed }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["job-checklist", workspaceId, jobId] });
    },
  });

  if (!workspaceId) return <ErrorState title={he.jobLoadError} />;
  if (jobQuery.isError) {
    const msg = jobQuery.error instanceof ApiClientError ? jobQuery.error.message : he.jobLoadError;
    return <ErrorState title={msg} />;
  }
  if (jobQuery.isLoading || !jobQuery.data) return <p className="text-sm text-fg-muted">{he.loading}</p>;

  const job = jobQuery.data;
  const items = checklistQuery.data ?? [];
  const done = items.filter((item) => item.completed).length;

  return (
    <div className="space-y-5">
      {job.site_id ? (
        <Link to="/app/sites/$siteId" params={{ siteId: job.site_id }} className="text-sm text-fg-muted hover:text-fg">
          ← {he.sitesDetail}
        </Link>
      ) : null}

      <PageHeader
        title={job.title}
        description={
          job.kind === "installation"
            ? he.installationWorkflowLead
            : `${job.number}${job.kind ? ` · ${job.kind}` : ""}`
        }
        action={<Status label={job.status} />}
      />

      <div className="flex flex-wrap gap-2">
        {job.status === "scheduled" || job.status === "en_route" ? (
          <Button type="button" loading={start.isPending} onClick={() => start.mutate()}>
            {he.startJob}
          </Button>
        ) : null}
        {job.status === "in_progress" ? (
          <Button type="button" loading={complete.isPending} onClick={() => complete.mutate()}>
            {he.completeJob}
          </Button>
        ) : null}
      </div>

      {job.kind === "installation" ? (
        <section className="ops-card space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">{he.installationChecklist}</h2>
            <p className="text-xs text-fg-muted">
              {done}/{items.length}
            </p>
          </div>
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="flex min-h-12 items-center gap-3 py-2">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={Boolean(item.completed)}
                  disabled={toggleItem.isPending || job.status === "completed"}
                  onChange={(event) =>
                    toggleItem.mutate({ itemId: item.id, completed: event.target.checked })
                  }
                  aria-label={item.label_he}
                />
                <span className={item.completed ? "text-fg-muted line-through" : "text-fg"}>{item.label_he}</span>
              </li>
            ))}
            {!items.length ? <li className="py-4 text-sm text-fg-muted">{he.installationChecklistEmpty}</li> : null}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
