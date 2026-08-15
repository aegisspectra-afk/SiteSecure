import { EmptyState, PageHeader } from "@site-secure/ui";
import type { DashboardResponse, SecurityCenter } from "@site-secure/api-client";
import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { liveAdminActions, workspaceSetup } from "../../lib/workspace-setup";
import { ActivityList } from "./ActivityList";
import { AttentionList } from "./AttentionList";
import { SecuritySnapshot } from "./SecuritySnapshot";
import { TodayList } from "./TodayList";
import { WorkspaceSetup } from "./WorkspaceSetup";

export function OpsDashboard({
  data,
  roleKey,
  features,
  memberCount = null,
  security = null,
}: {
  data: DashboardResponse;
  roleKey: string | undefined;
  features: string[];
  memberCount?: number | null;
  security?: SecurityCenter | null;
}) {
  const setup = workspaceSetup({ roleKey, features, memberCount });
  const actions = liveAdminActions(roleKey, features);
  const empty =
    data.attention.length === 0 && data.today.items.length === 0 && data.activity.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={he.overviewTitle} description={he.overviewKicker} />
      {!setup.complete ? <WorkspaceSetup steps={setup.steps} /> : null}
      {empty ? (
        <div className="ops-card">
          <EmptyState
            title={he.dashboardEmptyTitle}
            description={he.dashboardEmptyBody}
            action={
              actions.length ? (
                <div className="flex flex-wrap justify-center gap-2">
                  {actions.slice(0, 3).map((action) => (
                    <Link
                      key={action.href}
                      to={action.href}
                      className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] border border-border bg-bg px-4 text-sm font-medium text-fg hover:bg-bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    >
                      {action.label}
                    </Link>
                  ))}
                </div>
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
}: {
  data: DashboardResponse;
  security?: SecurityCenter | null;
}) {
  const empty =
    data.attention.length === 0 && data.today.items.length === 0 && data.activity.length === 0;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={he.overviewTitle} description={he.overviewKicker} />
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
