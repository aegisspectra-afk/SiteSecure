import { EmptyState } from "@site-secure/ui";
import type { DashboardResponse, LeadOut, SecuritySignal, WorkspaceUsage } from "@site-secure/api-client";
import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { can } from "../../lib/can";
import { hasFeature, quickActions } from "../../lib/home";
import { attentionCount, nextBestAction } from "../../lib/next-best-action";
import { hasQuoteRecords } from "../../lib/ux-metrics";
import { liveAdminActions, workspaceSetup } from "../../lib/workspace-setup";
import { ActiveWork } from "./ActiveWork";
import { ActivityList } from "./ActivityList";
import { BusinessSnapshot } from "./BusinessSnapshot";
import { CommandStatus } from "./CommandStatus";
import { DashboardFreshness } from "./DashboardFreshness";
import { LeadsAttention } from "./LeadsAttention";
import { NextBestAction } from "./NextBestAction";
import { OpsDashHero, OperationsHealth, SiteOpsPanel } from "./OpsHero";
import { QuotePipeline } from "./QuotePipeline";
import { RecentQuotes } from "./RecentQuotes";
import { SecurityStatus } from "./SecurityStatus";
import { UsageSnapshot } from "./UsageSnapshot";

export function OpsDashboard({
  data,
  roleKey,
  features,
  memberCount = null,
  usage = null,
  securitySignals = [],
  leadAttention = null,
  leadAttentionItems = [],
  displayName = null,
  workspaceName = null,
}: {
  data: DashboardResponse;
  roleKey: string | undefined;
  features: string[];
  memberCount?: number | null;
  usage?: WorkspaceUsage | null;
  workspaceStatus?: string;
  securitySignals?: SecuritySignal[];
  leadAttention?: LeadOut | null;
  leadAttentionItems?: LeadOut[];
  displayName?: string | null;
  workspaceName?: string | null;
}) {
  const setup = workspaceSetup({
    roleKey,
    features,
    memberCount,
    pendingInvites: usage?.pending_invites,
  });
  const summary = data.summary;
  const recentQuotes = data.recent_quotes ?? [];
  const quoteActions = quickActions(roleKey, features);
  const quoteCta = quoteActions[0];
  const invite = liveAdminActions(roleKey, features).find((action) => action.href === "/app/settings/users");
  const showQuotes = Boolean(summary) && can(roleKey, "quotes.view", features) && hasFeature(features, "quotes");
  const showSeats = Boolean(usage) && (can(roleKey, "users.view", features) || can(roleKey, "users.invite", features));
  const showBusiness = showQuotes && Boolean(summary) && hasQuoteRecords(summary);
  const showPipeline = showQuotes && Boolean(summary);
  const action = nextBestAction({
    setup,
    summary: showQuotes ? summary : null,
    attention: data.attention,
    usage,
    canCreateQuote: Boolean(quoteCta),
    canInvite: Boolean(invite),
    canViewQuotes: showQuotes,
    canCreateProject: can(roleKey, "projects.create", features),
    leadAttention,
  });
  const setupProgress =
    !setup.complete && setup.total > 0
      ? { percent: setup.percent, done: setup.steps.filter((step) => step.done).length, total: setup.total }
      : null;
  const attentionTotal = attentionCount(data.attention);
  const siteNames = data.today.items.map((item) => item.site_name).filter((name): name is string => Boolean(name));

  return (
    <div className="ops-dashboard flex flex-col gap-6">
      <OpsDashHero
        displayName={displayName}
        workspaceName={workspaceName}
        quoteAction={Boolean(quoteCta)}
        secondaryAction={
          !quoteCta && invite ? (
            <Link
              to={invite.href}
              className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-action px-4 text-sm font-medium text-action-fg transition-colors duration-200 hover:bg-action-hover"
            >
              {invite.label}
            </Link>
          ) : can(roleKey, "jobs.view", features) ? (
            <Link
              to="/app/today"
              className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] border border-border px-4 text-sm font-medium text-fg-muted transition-colors duration-200 hover:bg-bg-subtle hover:text-fg"
            >
              {he.todayViewAll}
            </Link>
          ) : undefined
        }
      />

      {summary ? (
        <OperationsHealth
          jobsOpen={summary.jobs_open}
          jobsOverdue={summary.jobs_overdue}
          quotesOpen={showQuotes ? summary.quotes_open : 0}
          attentionCount={attentionTotal}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <CommandStatus attention={data.attention} />
        {action ? <NextBestAction action={action} setupProgress={setupProgress} /> : null}
      </div>

      <LeadsAttention items={leadAttentionItems} />

      <ActiveWork items={data.today.items} />

      {can(roleKey, "sites.view", features) ? <SiteOpsPanel siteNames={siteNames} /> : null}

      {showBusiness && summary ? <BusinessSnapshot summary={summary} /> : null}
      {showPipeline && summary ? <QuotePipeline summary={summary} /> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {showQuotes ? <RecentQuotes quotes={recentQuotes} canCreate={Boolean(quoteCta)} /> : null}
        {usage && showSeats ? (
          <UsageSnapshot usage={usage} canManageTeam={Boolean(invite) || can(roleKey, "users.view", features)} />
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ActivityList items={data.activity} />
        {securitySignals.length ? <SecurityStatus signals={securitySignals} /> : null}
      </div>
      <DashboardFreshness generatedAt={data.generated_at} />
    </div>
  );
}

export function ObserveDashboard({
  data,
  roleKey,
  features = [],
  securitySignals = [],
  displayName = null,
  workspaceName = null,
}: {
  data: DashboardResponse;
  workspaceStatus?: string;
  roleKey?: string;
  features?: string[];
  securitySignals?: SecuritySignal[];
  displayName?: string | null;
  workspaceName?: string | null;
}) {
  const showQuotes = Boolean(data.summary) && can(roleKey, "quotes.view", features) && hasFeature(features, "quotes");
  const empty =
    data.attention.length === 0 && data.today.items.length === 0 && data.activity.length === 0;
  const attentionTotal = attentionCount(data.attention);

  return (
    <div className="ops-dashboard flex flex-col gap-6">
      <OpsDashHero displayName={displayName} workspaceName={workspaceName} />
      {data.summary ? (
        <OperationsHealth
          jobsOpen={data.summary.jobs_open}
          jobsOverdue={data.summary.jobs_overdue}
          quotesOpen={showQuotes ? data.summary.quotes_open : 0}
          attentionCount={attentionTotal}
        />
      ) : null}
      <CommandStatus attention={data.attention} />
      {showQuotes && data.summary && hasQuoteRecords(data.summary) ? (
        <BusinessSnapshot summary={data.summary} />
      ) : null}
      {showQuotes && data.summary ? <QuotePipeline summary={data.summary} /> : null}
      {showQuotes ? <RecentQuotes quotes={data.recent_quotes ?? []} canCreate={false} /> : null}
      <ActiveWork items={data.today.items} />
      {empty ? (
        <div className="ops-panel p-5">
          <EmptyState title={he.dashboardEmptyTitle} description={he.viewerEmptyBody} />
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <ActivityList items={data.activity} />
        {securitySignals.length ? <SecurityStatus signals={securitySignals} /> : null}
      </div>
      <DashboardFreshness generatedAt={data.generated_at} />
    </div>
  );
}
