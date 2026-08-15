import { EmptyState, PageHeader } from "@site-secure/ui";
import type { DashboardResponse, SecurityCenter, WorkspaceUsage } from "@site-secure/api-client";
import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { liveAdminActions, workspaceSetup } from "../../lib/workspace-setup";
import { ActivityList } from "./ActivityList";
import { AttentionList } from "./AttentionList";
import { CommandStatus } from "./CommandStatus";
import { SecuritySnapshot } from "./SecuritySnapshot";
import { TodayList } from "./TodayList";
import { UsageSnapshot } from "./UsageSnapshot";
import { WorkspaceSetup } from "./WorkspaceSetup";

export function OpsDashboard({
  data,
  roleKey,
  features,
  memberCount = null,
  usage = null,
  security = null,
  workspaceStatus,
}: {
  data: DashboardResponse;
  roleKey: string | undefined;
  features: string[];
  memberCount?: number | null;
  usage?: WorkspaceUsage | null;
  security?: SecurityCenter | null;
  workspaceStatus?: string;
}) {
  const setup = workspaceSetup({ roleKey, features, memberCount });
  const actions = liveAdminActions(roleKey, features);
  const invite = actions.find((action) => action.href === "/app/settings/users");
  const empty =
    data.attention.length === 0 && data.today.items.length === 0 && data.activity.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={he.dashboardTitle}
        description={he.dashboardLead}
        action={
          invite ? (
            <Link
              to={invite.href}
              className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-action px-4 text-sm font-medium text-action-fg hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {invite.label}
            </Link>
          ) : undefined
        }
      />
      <CommandStatus
        workspaceStatus={workspaceStatus}
        setupComplete={setup.complete}
        security={security}
      />
      {!setup.complete ? <WorkspaceSetup steps={setup.steps} /> : null}
      {usage ? <UsageSnapshot usage={usage} /> : null}
      {empty ? (
        <div className="ops-card">
          <EmptyState
            title={he.dashboardEmptyTitle}
            description={he.dashboardEmptyBody}
            action={
              invite ? (
                <Link
                  to={invite.href}
                  className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] border border-border bg-bg px-4 text-sm font-medium text-fg hover:bg-bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  {invite.label}
                </Link>
              ) : undefined
            }
          />
          <p className="public-mono pb-6 text-center text-[10px] tracking-[0.16em] text-fg-muted">
            {he.dashboardEmptyKicker}
          </p>
        </div>
      ) : (
        <>
          <AttentionList groups={data.attention} />
          <TodayList items={data.today.items} />
        </>
      )}
      {security ? <SecuritySnapshot data={security} /> : null}
      <ActivityList items={data.activity} />
    </div>
  );
}

export function ObserveDashboard({
  data,
  security = null,
  workspaceStatus,
}: {
  data: DashboardResponse;
  security?: SecurityCenter | null;
  workspaceStatus?: string;
}) {
  const empty =
    data.attention.length === 0 && data.today.items.length === 0 && data.activity.length === 0;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={he.dashboardTitle} description={he.dashboardLead} />
      <CommandStatus workspaceStatus={workspaceStatus} setupComplete security={security} />
      {empty ? (
        <div className="ops-card">
          <EmptyState title={he.dashboardEmptyTitle} description={he.viewerEmptyBody} />
        </div>
      ) : (
        <>
          <AttentionList groups={data.attention} />
          <TodayList items={data.today.items} />
        </>
      )}
      {security ? <SecuritySnapshot data={security} /> : null}
      <ActivityList items={data.activity} />
    </div>
  );
}
