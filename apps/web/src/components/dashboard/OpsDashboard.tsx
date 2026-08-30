import type { DashboardResponse, LeadOut, SecuritySignal, WorkspaceUsage } from "@site-secure/api-client";
import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import {
  deriveActivation,
  quoteCountFromSummary,
  shouldShowActivationCard,
} from "../../lib/activation";
import { can } from "../../lib/can";
import { hasFeature } from "../../lib/home";
import { attentionCount, nextBestAction } from "../../lib/next-best-action";
import { hasQuoteRecords } from "../../lib/ux-metrics";
import { liveAdminActions, workspaceSetup } from "../../lib/workspace-setup";
import { ActivationCard } from "./ActivationCard";
import { ActiveWork } from "./ActiveWork";
import { BusinessSnapshot } from "./BusinessSnapshot";
import { CommandStatus } from "./CommandStatus";
import { DashboardFreshness } from "./DashboardFreshness";
import { DashboardKpiRow } from "./DashboardKpiRow";
import { LeadsAttention } from "./LeadsAttention";
import { NextBestAction } from "./NextBestAction";
import { OpsDashHero } from "./OpsHero";
import { RecentQuotes } from "./RecentQuotes";
import { SecurityStatusBar } from "./SecurityStatus";
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
  customerCount = null,
  countsReady = true,
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
  customerCount?: number | null;
  countsReady?: boolean;
}) {
  const quoteCount = quoteCountFromSummary(data.summary);
  const activation = deriveActivation({
    customerCount,
    quoteCount,
    countsReady,
  });
  const setup = workspaceSetup({
    roleKey,
    features,
    customerCount: countsReady ? (customerCount ?? 0) : null,
    quoteCount: countsReady ? quoteCount : null,
    memberCount,
    pendingInvites: usage?.pending_invites,
  });
  const summary = data.summary;
  const recentQuotes = data.recent_quotes ?? [];
  const canCreateQuote = can(roleKey, "quotes.create", features) && hasFeature(features, "quotes");
  const canCreateCustomer = can(roleKey, "crm.create", features) && hasFeature(features, "crm");
  const quoteCta = canCreateQuote;
  const invite = liveAdminActions(roleKey, features).find((action) => action.href === "/app/settings/users");
  const showQuotes = Boolean(summary) && can(roleKey, "quotes.view", features) && hasFeature(features, "quotes");
  const showSeats = Boolean(usage) && (can(roleKey, "users.view", features) || can(roleKey, "users.invite", features));
  const showBusiness = showQuotes && Boolean(summary) && hasQuoteRecords(summary);
  const showActivation = shouldShowActivationCard({
    activation,
    canCreateQuote,
    canCreateCustomer,
  });
  const action = nextBestAction({
    setup,
    summary: showQuotes ? summary : null,
    attention: data.attention,
    usage,
    canCreateQuote,
    canInvite: Boolean(invite),
    canViewQuotes: showQuotes,
    canCreateProject: can(roleKey, "projects.create", features),
    leadAttention: showActivation ? null : leadAttention,
  });
  const setupProgress =
    !setup.complete && setup.total > 0
      ? { percent: setup.percent, done: setup.done, total: setup.total }
      : null;
  const attentionTotal = attentionCount(data.attention);
  const todayItems = data.today.items;
  const fieldTodayCount = todayItems.filter((item) => item.entity_type === "job").length;
  const showNextAction = !showActivation && Boolean(action) && attentionTotal === 0;

  return (
    <div className="ops-dashboard flex flex-col gap-4">
      <OpsDashHero
        displayName={displayName}
        workspaceName={workspaceName}
        quoteAction={Boolean(quoteCta)}
        fieldTodayCount={fieldTodayCount}
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

      {showActivation ? (
        <ActivationCard
          activation={activation}
          setupProgress={setupProgress}
          canCreateQuote={canCreateQuote}
          canCreateCustomer={canCreateCustomer}
        />
      ) : null}

      {summary ? (
        <DashboardKpiRow summary={summary} attention={data.attention} showQuotes={showQuotes} />
      ) : null}

      <CommandStatus attention={data.attention} />

      {showNextAction && action ? <NextBestAction action={action} setupProgress={null} /> : null}

      {!showActivation ? <LeadsAttention items={leadAttentionItems} /> : null}

      {todayItems.length > 0 ? <ActiveWork items={todayItems} /> : null}

      <div className="ops-dashboard-main">
        {showBusiness && summary ? (
          <BusinessSnapshot summary={summary} chart={data.business_chart ?? null} />
        ) : null}
        {showQuotes ? <RecentQuotes quotes={recentQuotes} canCreate={Boolean(quoteCta)} /> : null}
        {usage && showSeats ? (
          <UsageSnapshot
            usage={usage}
            canManageTeam={Boolean(invite) || can(roleKey, "users.view", features)}
            compact
          />
        ) : null}
      </div>

      {securitySignals.length ? (
        <SecurityStatusBar signals={securitySignals} updatedAt={data.generated_at} />
      ) : null}
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

  return (
    <div className="ops-dashboard flex flex-col gap-4">
      <OpsDashHero displayName={displayName} workspaceName={workspaceName} />
      {data.summary ? (
        <DashboardKpiRow summary={data.summary} attention={data.attention} showQuotes={showQuotes} />
      ) : null}
      <CommandStatus attention={data.attention} />
      <div className="ops-dashboard-main">
        {showQuotes && data.summary && hasQuoteRecords(data.summary) ? (
          <BusinessSnapshot summary={data.summary} chart={data.business_chart ?? null} />
        ) : null}
        {showQuotes ? <RecentQuotes quotes={data.recent_quotes ?? []} canCreate={false} /> : null}
      </div>
      {data.today.items.length > 0 ? <ActiveWork items={data.today.items} /> : null}
      {empty ? (
        <div className="ops-panel p-4">
          <p className="text-sm font-medium text-fg">{he.dashboardEmptyTitle}</p>
          <p className="mt-1 text-sm text-fg-muted">{he.viewerEmptyBody}</p>
        </div>
      ) : null}
      {securitySignals.length ? (
        <SecurityStatusBar signals={securitySignals} updatedAt={data.generated_at} />
      ) : null}
      <DashboardFreshness generatedAt={data.generated_at} />
    </div>
  );
}
