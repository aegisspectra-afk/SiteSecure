import { EmptyState, PageHeader } from "@site-secure/ui";
import type { DashboardResponse, SecurityCenter, WorkspaceUsage } from "@site-secure/api-client";
import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { can } from "../../lib/can";
import { hasFeature, quickActions } from "../../lib/home";
import { liveAdminActions, workspaceSetup } from "../../lib/workspace-setup";
import { ActivityList } from "./ActivityList";
import { AttentionList } from "./AttentionList";
import { CommandStatus } from "./CommandStatus";
import { OpsMetrics } from "./OpsMetrics";
import { QuotePipeline } from "./QuotePipeline";
import { RecentQuotes } from "./RecentQuotes";
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
  const quoteActions = quickActions(roleKey, features);
  const quoteCta = quoteActions[0];
  const invite = liveAdminActions(roleKey, features).find((action) => action.href === "/app/settings/users");
  const showQuotes = Boolean(data.summary) && can(roleKey, "quotes.view", features) && hasFeature(features, "quotes");
  const showJobs = data.home_variant === "ops" && can(roleKey, "jobs.view", features);
  const empty =
    data.attention.length === 0 &&
    data.today.items.length === 0 &&
    data.activity.length === 0 &&
    data.recent_quotes.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={he.dashboardTitle}
        description={he.dashboardLead}
        action={
          quoteCta ? (
            <Link
              to="/app/quotes/new"
              className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-action px-4 text-sm font-medium text-action-fg hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {quoteCta.label}
            </Link>
          ) : invite ? (
            <Link
              to={invite.href}
              className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-action px-4 text-sm font-medium text-action-fg hover:bg-action-hover"
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
      {data.summary ? <OpsMetrics summary={data.summary} showJobs={showJobs} showQuotes={showQuotes} /> : null}
      {empty ? (
        <div className="ops-card">
          <EmptyState
            title={he.dashboardEmptyTitle}
            description={quoteCta ? he.dashboardEmptyQuotes : he.dashboardEmptyBody}
            action={
              quoteCta ? (
                <Link
                  to="/app/quotes/new"
                  className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-action px-4 text-sm font-medium text-action-fg"
                >
                  {quoteCta.label}
                </Link>
              ) : invite ? (
                <Link to={invite.href} className="inline-flex min-h-11 items-center text-sm font-medium text-action">
                  {invite.label}
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <AttentionList groups={data.attention} />
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="ops-card p-5" aria-labelledby="active-work-heading">
          <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">ACTIVE WORK</p>
          <h2 id="active-work-heading" className="mt-1 text-base font-semibold text-fg">
            {he.activeWorkTitle}
          </h2>
          {data.today.items.length ? (
            <TodayList items={data.today.items} />
          ) : (
            <p className="mt-4 text-sm text-fg-muted">{he.activeWorkEmpty}</p>
          )}
        </section>
        {showQuotes ? <QuotePipeline summary={data.summary} /> : null}
      </div>
      {showQuotes ? <RecentQuotes quotes={data.recent_quotes} canCreate={Boolean(quoteCta)} /> : null}
      {usage ? <UsageSnapshot usage={usage} /> : null}
      {security ? <SecuritySnapshot data={security} /> : null}
      <ActivityList items={data.activity} />
    </div>
  );
}

export function ObserveDashboard({
  data,
  security = null,
  workspaceStatus,
  roleKey,
  features = [],
}: {
  data: DashboardResponse;
  security?: SecurityCenter | null;
  workspaceStatus?: string;
  roleKey?: string;
  features?: string[];
}) {
  const showQuotes = can(roleKey, "quotes.view", features) && hasFeature(features, "quotes");
  const empty =
    data.attention.length === 0 && data.today.items.length === 0 && data.activity.length === 0;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={he.dashboardTitle} description={he.dashboardLead} />
      <CommandStatus workspaceStatus={workspaceStatus} setupComplete security={security} />
      {data.summary ? (
        <OpsMetrics summary={data.summary} showJobs={false} showQuotes={showQuotes} />
      ) : null}
      {empty ? (
        <div className="ops-card">
          <EmptyState title={he.dashboardEmptyTitle} description={he.viewerEmptyBody} />
        </div>
      ) : (
        <AttentionList groups={data.attention} />
      )}
      {showQuotes ? <RecentQuotes quotes={data.recent_quotes} canCreate={false} /> : null}
      {security ? <SecuritySnapshot data={security} /> : null}
      <ActivityList items={data.activity} />
    </div>
  );
}
