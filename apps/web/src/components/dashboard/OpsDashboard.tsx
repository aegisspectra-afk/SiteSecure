import type { DashboardResponse, LeadOut, WorkspaceUsage } from "@site-secure/api-client";
import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import {
  deriveActivation,
  quoteCountFromSummary,
  shouldShowActivationCard,
} from "../../lib/activation";
import {
  attentionEntityCount,
  filterLeadAttention,
  leadsToAttentionGroups,
} from "../../lib/attention-queue";
import { can } from "../../lib/can";
import { hasFeature } from "../../lib/home";
import { nextBestAction } from "../../lib/next-best-action";
import { hasQuoteRecords } from "../../lib/ux-metrics";
import { liveAdminActions, workspaceSetup } from "../../lib/workspace-setup";
import { ActivationCard } from "./ActivationCard";
import { ActiveWork } from "./ActiveWork";
import { CommercialPulse } from "./CommercialPulse";
import { CommandStatus } from "./CommandStatus";
import { DashboardFreshness } from "./DashboardFreshness";
import { NextBestAction } from "./NextBestAction";
import { OpsDashHero } from "./OpsHero";
import { RecentQuotes } from "./RecentQuotes";
import { UsageThresholdBanner, usageThresholdMeters } from "./UsageThresholdBanner";

export function OpsDashboard({
  data,
  roleKey,
  features,
  memberCount = null,
  usage = null,
  leadAttention = null,
  leadAttentionItems = [],
  displayName = null,
  customerCount = null,
  countsReady = true,
}: {
  data: DashboardResponse;
  roleKey: string | undefined;
  features: string[];
  memberCount?: number | null;
  usage?: WorkspaceUsage | null;
  workspaceStatus?: string;
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
  const canCreateProject = can(roleKey, "projects.create", features);
  const quoteCta = canCreateQuote;
  const invite = liveAdminActions(roleKey, features).find((action) => action.href === "/app/settings/users");
  const showQuotes = Boolean(summary) && can(roleKey, "quotes.view", features) && hasFeature(features, "quotes");
  const showBusiness = showQuotes && Boolean(summary) && hasQuoteRecords(summary);
  const showActivation = shouldShowActivationCard({
    activation,
    canCreateQuote,
    canCreateCustomer,
  });

  const leadRows = showActivation ? [] : filterLeadAttention(leadAttentionItems);
  const attentionGroups = [
    ...data.attention,
    ...(showActivation ? [] : leadsToAttentionGroups(leadRows)),
  ];
  const attentionTotal = attentionEntityCount(attentionGroups);

  const action = nextBestAction({
    setup,
    summary: showQuotes ? summary : null,
    attention: data.attention,
    usage,
    canCreateQuote,
    canInvite: Boolean(invite),
    canViewQuotes: showQuotes,
    canCreateProject,
    leadAttention: showActivation || attentionTotal > 0 ? null : leadAttention,
  });
  const setupProgress =
    !setup.complete && setup.total > 0
      ? { percent: setup.percent, done: setup.done, total: setup.total }
      : null;
  const todayItems = data.today.items;
  const fieldTodayCount = todayItems.filter((item) => item.entity_type === "job").length;
  const showNextAction = !showActivation && Boolean(action) && attentionTotal === 0;
  const showToday = can(roleKey, "jobs.view", features);
  const thresholdMeters = usageThresholdMeters(usage);
  const canManageTeam = Boolean(invite) || can(roleKey, "users.view", features);

  return (
    <div className="ops-dashboard ops-command-center flex flex-col gap-4">
      <OpsDashHero
        displayName={displayName}
        quoteAction={Boolean(quoteCta)}
        attentionCount={attentionTotal}
        fieldTodayCount={fieldTodayCount}
        quotesOpen={showQuotes ? (summary?.quotes_open ?? 0) : 0}
        pipelineValue={showQuotes ? (summary?.quotes_open_value ?? null) : null}
        secondaryAction={
          !quoteCta && invite ? (
            <Link
              to={invite.href}
              className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-action px-4 text-sm font-medium text-action-fg transition-colors duration-200 hover:bg-action-hover"
            >
              {invite.label}
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

      {!showActivation ? (
        <CommandStatus
          attention={attentionGroups}
          canCreateProject={canCreateProject}
          viewAllTo={showQuotes ? "/app/quotes" : "/app/today"}
        />
      ) : null}

      {showToday ? <ActiveWork items={todayItems} compactEmpty /> : null}

      {showNextAction && action ? <NextBestAction action={action} setupProgress={null} /> : null}

      {thresholdMeters.length ? (
        <UsageThresholdBanner meters={thresholdMeters} canManageTeam={canManageTeam} />
      ) : null}

      <div className="ops-dashboard-main">
        {showBusiness && summary ? (
          <CommercialPulse summary={summary} chart={data.business_chart ?? null} />
        ) : null}
        {showQuotes ? <RecentQuotes quotes={recentQuotes} canCreate={Boolean(quoteCta)} /> : null}
      </div>

      <DashboardFreshness generatedAt={data.generated_at} />
    </div>
  );
}

export function ObserveDashboard({
  data,
  roleKey,
  features = [],
  displayName = null,
}: {
  data: DashboardResponse;
  workspaceStatus?: string;
  roleKey?: string;
  features?: string[];
  displayName?: string | null;
  workspaceName?: string | null;
}) {
  const showQuotes = Boolean(data.summary) && can(roleKey, "quotes.view", features) && hasFeature(features, "quotes");
  const attentionTotal = attentionEntityCount(data.attention);
  const empty =
    data.attention.length === 0 && data.today.items.length === 0 && data.activity.length === 0;

  return (
    <div className="ops-dashboard ops-command-center flex flex-col gap-4">
      <OpsDashHero
        displayName={displayName}
        attentionCount={attentionTotal}
        fieldTodayCount={data.today.items.filter((i) => i.entity_type === "job").length}
        quotesOpen={showQuotes ? (data.summary?.quotes_open ?? 0) : 0}
        pipelineValue={showQuotes ? (data.summary?.quotes_open_value ?? null) : null}
      />
      <CommandStatus attention={data.attention} canCreateProject={false} />
      {data.today.items.length > 0 ? <ActiveWork items={data.today.items} /> : null}
      <div className="ops-dashboard-main">
        {showQuotes && data.summary && hasQuoteRecords(data.summary) ? (
          <CommercialPulse summary={data.summary} chart={data.business_chart ?? null} />
        ) : null}
        {showQuotes ? <RecentQuotes quotes={data.recent_quotes ?? []} canCreate={false} /> : null}
      </div>
      {empty ? (
        <div className="ops-panel p-4">
          <p className="text-sm font-medium text-fg">{he.dashboardEmptyTitle}</p>
          <p className="mt-1 text-sm text-fg-muted">{he.viewerEmptyBody}</p>
        </div>
      ) : null}
      <DashboardFreshness generatedAt={data.generated_at} />
    </div>
  );
}
