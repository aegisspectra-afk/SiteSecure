import { EmptyState, PageHeader } from "@site-secure/ui";
import type { DashboardResponse, SecuritySignal, WorkspaceUsage } from "@site-secure/api-client";
import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { can } from "../../lib/can";
import { hasFeature, quickActions } from "../../lib/home";
import { nextBestAction } from "../../lib/next-best-action";
import { hasQuoteRecords, quoteConversion } from "../../lib/ux-metrics";
import { liveAdminActions, workspaceSetup } from "../../lib/workspace-setup";
import { ActiveWork } from "./ActiveWork";
import { ActivityList } from "./ActivityList";
import { BusinessHealth } from "./BusinessHealth";
import { CommandStatus } from "./CommandStatus";
import { DashboardFreshness } from "./DashboardFreshness";
import { NextBestAction } from "./NextBestAction";
import { QuotePipeline } from "./QuotePipeline";
import { SalesSnapshot } from "./SalesSnapshot";
import { SecurityStatus } from "./SecurityStatus";
import { UsageSnapshot } from "./UsageSnapshot";
import { WorkspaceSetup } from "./WorkspaceSetup";

export function OpsDashboard({
  data,
  roleKey,
  features,
  memberCount = null,
  usage = null,
  securitySignals = [],
}: {
  data: DashboardResponse;
  roleKey: string | undefined;
  features: string[];
  memberCount?: number | null;
  usage?: WorkspaceUsage | null;
  workspaceStatus?: string;
  securitySignals?: SecuritySignal[];
}) {
  const setup = workspaceSetup({ roleKey, features, memberCount });
  const summary = data.summary;
  const recentQuotes = data.recent_quotes ?? [];
  const quoteActions = quickActions(roleKey, features);
  const quoteCta = quoteActions[0];
  const invite = liveAdminActions(roleKey, features).find((action) => action.href === "/app/settings/users");
  const showQuotes = Boolean(summary) && can(roleKey, "quotes.view", features) && hasFeature(features, "quotes");
  const showSeats = Boolean(usage) && (can(roleKey, "users.view", features) || can(roleKey, "users.invite", features));
  const quoteVolume = quoteConversion(summary).total;
  const showPipeline = showQuotes && quoteVolume >= 3;
  const showSetup = !setup.complete && setup.total > 0;
  const showBusiness = showQuotes && Boolean(summary) && hasQuoteRecords(summary);
  const action = nextBestAction({
    setup,
    summary: showQuotes ? summary : null,
    attention: data.attention,
    usage,
    canCreateQuote: Boolean(quoteCta),
    canInvite: Boolean(invite),
    canViewQuotes: showQuotes,
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={he.dashboardTitle}
        description={he.dashboardLead}
        action={
          quoteCta ? (
            <Link
              to="/app/quotes/new"
              className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-action px-4 text-sm font-medium text-action-fg hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {he.newQuoteAction}
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
      <div className="grid gap-4 lg:grid-cols-2">
        <CommandStatus attention={data.attention} />
        {action ? <NextBestAction action={action} /> : null}
      </div>
      {showSetup ? (
        <WorkspaceSetup steps={setup.steps} percent={setup.percent} canInvite={Boolean(invite)} />
      ) : null}
      {showBusiness && summary ? <BusinessHealth summary={summary} /> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {showQuotes && summary ? (
          <SalesSnapshot summary={summary} recentQuotes={recentQuotes} canCreate={Boolean(quoteCta)} />
        ) : null}
        {usage && showSeats ? (
          <UsageSnapshot usage={usage} canManageTeam={Boolean(invite) || can(roleKey, "users.view", features)} />
        ) : null}
      </div>
      {data.today.items.length > 0 ? <ActiveWork items={data.today.items} /> : null}
      {showPipeline && summary ? <QuotePipeline summary={summary} /> : null}
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
}: {
  data: DashboardResponse;
  workspaceStatus?: string;
  roleKey?: string;
  features?: string[];
  securitySignals?: SecuritySignal[];
}) {
  const showQuotes = Boolean(data.summary) && can(roleKey, "quotes.view", features) && hasFeature(features, "quotes");
  const quoteVolume = quoteConversion(data.summary).total;
  const empty =
    data.attention.length === 0 && data.today.items.length === 0 && data.activity.length === 0;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={he.dashboardTitle} description={he.dashboardLead} />
      <CommandStatus attention={data.attention} />
      {showQuotes && data.summary && hasQuoteRecords(data.summary) ? <BusinessHealth summary={data.summary} /> : null}
      {showQuotes && data.summary ? (
        <SalesSnapshot summary={data.summary} recentQuotes={data.recent_quotes ?? []} canCreate={false} />
      ) : null}
      {data.today.items.length > 0 ? <ActiveWork items={data.today.items} /> : null}
      {empty ? (
        <div className="ops-card">
          <EmptyState title={he.dashboardEmptyTitle} description={he.viewerEmptyBody} />
        </div>
      ) : null}
      {showQuotes && quoteVolume >= 3 && data.summary ? <QuotePipeline summary={data.summary} /> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <ActivityList items={data.activity} />
        {securitySignals.length ? <SecurityStatus signals={securitySignals} /> : null}
      </div>
      <DashboardFreshness generatedAt={data.generated_at} />
    </div>
  );
}
