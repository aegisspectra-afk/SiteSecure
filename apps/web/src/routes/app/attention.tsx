import type { DashboardItem } from "@site-secure/api-client";
import { Button, ErrorState } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AttentionList } from "../../components/dashboard/AttentionList";
import { DashboardCreateProjectDialog } from "../../components/dashboard/DashboardCreateProjectDialog";
import { DashboardSkeleton } from "../../components/dashboard/DashboardSkeleton";
import { he } from "../../i18n/he";
import { activeMembership } from "../../lib/active-membership";
import { attentionEntityCount, filterLeadAttention, leadsToAttentionGroups } from "../../lib/attention-queue";
import { can } from "../../lib/can";
import { useSession } from "../../lib/session";

export const Route = createFileRoute("/app/attention")({
  component: AttentionPage,
});

/** "הצג הכל" from the dashboard: every item that needs attention, quotes, jobs and leads together. */
export function AttentionPage() {
  const { session, api } = useSession();
  const membership = activeMembership(session);
  const workspaceId = membership?.workspace_id;
  const roleKey = membership?.role_key;
  const features = membership?.features ?? [];
  const allowed = can(roleKey, "dashboard.view", features);
  const canLeads = can(roleKey, "leads.view", features);
  const canCreateProject = can(roleKey, "projects.create", features);
  const [projectItem, setProjectItem] = useState<DashboardItem | null>(null);

  const query = useQuery({
    queryKey: ["dashboard-attention-full", workspaceId],
    enabled: Boolean(workspaceId) && allowed,
    queryFn: () => api.getDashboard(workspaceId!, { attention: "full" }),
    staleTime: 30_000,
  });
  const leads = useQuery({
    queryKey: ["dashboard-lead-next", workspaceId],
    enabled: Boolean(workspaceId) && allowed && canLeads,
    queryFn: () => api.listLeads(workspaceId!, { limit: 20 }),
    staleTime: 30_000,
  });

  if (!allowed) return <ErrorState title={he.noDashboardPermission} />;
  if (!workspaceId) return <ErrorState title={he.dashboardError} />;
  if (query.isLoading) return <DashboardSkeleton />;
  if (query.isError || !query.data) {
    return (
      <ErrorState
        title={he.attentionPageError}
        action={
          <Button variant="secondary" onClick={() => void query.refetch()}>
            {he.retry}
          </Button>
        }
      />
    );
  }

  const groups = [...query.data.attention, ...leadsToAttentionGroups(filterLeadAttention(leads.data?.items ?? []))];
  const count = attentionEntityCount(groups);

  return (
    <div className="ops-dashboard ops-command-center ops-dashboard-adaptive ops-dashboard-dash12 ops-dashboard-final flex flex-col gap-4" data-testid="attention-page">
      <div className="ops-attention-head">
        <h1 className="ops-section-title is-hero">{he.attentionPageTitle(count)}</h1>
        <Link to="/app/dashboard" className="ops-section-link">
          {he.attentionPageBack}
        </Link>
      </div>
      {count === 0 ? (
        <section className="ops-attention-calm" data-testid="attention-page-empty">
          <p className="ops-attention-calm-body" role="status">
            {he.commandQuietBody}
          </p>
        </section>
      ) : (
        <section className="ops-attention-card is-hero is-active" aria-label={he.attentionPageTitle(count)}>
          <AttentionList
            groups={groups}
            framed={false}
            canCreateProject={canCreateProject}
            limit={Number.MAX_SAFE_INTEGER}
            onCreateProject={canCreateProject ? (item) => setProjectItem(item) : undefined}
          />
        </section>
      )}
      {leads.isError ? (
        <p className="text-sm text-fg-muted" role="status">
          {he.attentionPageLeadsError}
        </p>
      ) : null}
      {projectItem ? (
        <DashboardCreateProjectDialog item={projectItem} workspaceId={workspaceId} onClose={() => setProjectItem(null)} />
      ) : null}
    </div>
  );
}
