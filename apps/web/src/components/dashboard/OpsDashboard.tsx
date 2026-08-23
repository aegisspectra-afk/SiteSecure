import { EmptyState, PageHeader } from "@site-secure/ui";
import type { DashboardResponse, LeadOut, SecuritySignal, WorkspaceUsage } from "@site-secure/api-client";
import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { can } from "../../lib/can";
import { hasFeature, quickActions } from "../../lib/home";
import { nextBestAction } from "../../lib/next-best-action";
import { hasQuoteRecords } from "../../lib/ux-metrics";
import { liveAdminActions, workspaceSetup } from "../../lib/workspace-setup";
import { NewQuoteButton } from "../quotes/NewQuoteButton";
import { ActiveWork } from "./ActiveWork";
import { ActivityList } from "./ActivityList";
import { BusinessSnapshot } from "./BusinessSnapshot";
import { CommandStatus } from "./CommandStatus";
import { DashboardFreshness } from "./DashboardFreshness";
import { LeadsAttention, filterLeadAttention } from "./LeadsAttention";
import { NextBestAction } from "./NextBestAction";
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
}) {
  const setup = workspaceSetup({ roleKey, features, memberCount });
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

  return (
    <div className="ops-dashboard flex flex-col gap-5">
      <PageHeader
        eyebrow={he.workspaceActive}
        title={he.dashboardTitle}
        description={he.dashboardLead}
        action={
          quoteCta ? (
            <NewQuoteButton />
          ) : invite ? (
            <Link
              to={invite.href}
              className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-action px-4 text-sm font-medium text-action-fg transition-colors duration-200 hover:bg-action-hover"
            >
              {invite.label}
            </Link>
          ) : undefined
        }
      />

      <div className="ops-dashboard-priority grid gap-4 lg:grid-cols-2">
        <CommandStatus attention={data.attention} />
        {action ? <NextBestAction action={action} setupProgress={setupProgress} /> : null}
      </div>

      <LeadsAttention items={leadAttentionItems} />

      {showBusiness && summary ? <BusinessSnapshot summary={summary} /> : null}
      {showPipeline && summary ? <QuotePipeline summary={summary} /> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {showQuotes ? <RecentQuotes quotes={recentQuotes} canCreate={Boolean(quoteCta)} /> : null}
        {usage && showSeats ? (
          <UsageSnapshot usage={usage} canManageTeam={Boolean(invite) || can(roleKey, "users.view", features)} />
        ) : null}
      </div>

      {data.today.items.length > 0 ? <ActiveWork items={data.today.items} /> : null}

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
  const empty =
    data.attention.length === 0 && data.today.items.length === 0 && data.activity.length === 0;
  return (
    <div className="ops-dashboard flex flex-col gap-5">
      <PageHeader eyebrow={he.workspaceActive} title={he.dashboardTitle} description={he.dashboardLead} />
      <CommandStatus attention={data.attention} />
      {showQuotes && data.summary && hasQuoteRecords(data.summary) ? (
        <BusinessSnapshot summary={data.summary} />
      ) : null}
      {showQuotes && data.summary ? <QuotePipeline summary={data.summary} /> : null}
      {showQuotes ? <RecentQuotes quotes={data.recent_quotes ?? []} canCreate={false} /> : null}
      {data.today.items.length > 0 ? <ActiveWork items={data.today.items} /> : null}
      {empty ? (
        <div className="ops-card">
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
