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
  attentionQueue,
  filterLeadAttention,
  leadsToAttentionGroups,
} from "../../lib/attention-queue";
import { can } from "../../lib/can";
import { hasFeature } from "../../lib/home";
import { hasQuoteRecords } from "../../lib/ux-metrics";
import { liveAdminActions, workspaceSetup } from "../../lib/workspace-setup";
import { ActivationCard } from "./ActivationCard";
import { ActiveWork } from "./ActiveWork";
import { CommercialPulse } from "./CommercialPulse";
import { CommandStatus } from "./CommandStatus";
import { DashboardCommandHeader } from "./DashboardCommandHeader";
import { DashboardFreshness } from "./DashboardFreshness";
import { DashboardSignalStrip } from "./DashboardSignalStrip";
import { RecentQuotes } from "./RecentQuotes";
import { UsageSnapshot } from "./UsageSnapshot";
import { UsageThresholdBanner, usageThresholdMeters } from "./UsageThresholdBanner";

export function OpsDashboard({
  data,
  roleKey,
  features,
  memberCount = null,
  usage = null,
  leadAttention: _leadAttention = null,
  leadAttentionItems = [],
  displayName = null,
  customerCount = null,
  countsReady = true,
  workspaceId = null,
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
  workspaceId?: string | null;
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
  const attentionQuoteIds = new Set(
    attentionQueue(attentionGroups)
      .filter((row) => row.item.entity_type === "quote")
      .map((row) => row.item.entity_id),
  );
  const recentQuotes = (data.recent_quotes ?? []).filter((quote) => !attentionQuoteIds.has(quote.id));

  const setupProgress =
    !setup.complete && setup.total > 0
      ? { percent: setup.percent, done: setup.done, total: setup.total }
      : null;
  const todayItems = data.today.items;
  const showToday = can(roleKey, "jobs.view", features);
  const thresholdMeters = usageThresholdMeters(usage).filter((meter) => {
    // Interruptive banner only at/over limit; near-limit lives in Workspace Status.
    const ratio = meter.limit > 0 ? meter.current / meter.limit : 0;
    return ratio >= 1;
  });
  const canManageTeam = Boolean(invite) || can(roleKey, "users.view", features);
  const showUsageBanner = thresholdMeters.length > 0 && roleKey !== "sales" && canManageTeam;
  const showUsagePanel = Boolean(usage) && roleKey !== "sales" && canManageTeam;

  return (
    <div className="ops-dashboard ops-command-center ops-dashboard-v3 flex flex-col gap-4">
      <DashboardCommandHeader
        displayName={displayName}
        roleKey={roleKey}
        features={features}
        attentionCount={attentionTotal}
        showCreate={!showActivation}
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

      {!showActivation ? (
        <DashboardSignalStrip
          attentionCount={attentionTotal}
          todayCount={todayItems.length}
          quotesOpen={showQuotes ? (summary?.quotes_open ?? 0) : 0}
          pipelineValue={showQuotes ? (summary?.quotes_open_value ?? null) : null}
          showQuotes={showQuotes}
          showToday={showToday}
        />
      ) : null}

      {showActivation ? (
        <ActivationCard
          activation={activation}
          setupProgress={setupProgress}
          canCreateQuote={canCreateQuote}
          canCreateCustomer={canCreateCustomer}
        />
      ) : null}

      <div className="ops-v3-ops-grid">
        {!showActivation ? (
          <CommandStatus
            attention={attentionGroups}
            canCreateProject={canCreateProject}
            viewAllTo={showQuotes ? "/app/quotes" : "/app/today"}
            workspaceId={workspaceId}
          />
        ) : null}

        {showToday ? <ActiveWork items={todayItems} compactEmpty /> : null}
      </div>

      {showUsageBanner ? (
        <UsageThresholdBanner meters={thresholdMeters} canManageTeam={canManageTeam} />
      ) : null}

      {showBusiness && summary ? (
        <div className="ops-v3-pulse">
          <CommercialPulse summary={summary} chart={data.business_chart ?? null} />
        </div>
      ) : null}

      <div className="ops-v3-secondary-grid">
        {showQuotes ? <RecentQuotes quotes={recentQuotes} canCreate={Boolean(quoteCta)} /> : null}
        {showUsagePanel && usage ? (
          <UsageSnapshot usage={usage} canManageTeam={canManageTeam} compact />
        ) : null}
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
  const attentionQuoteIds = new Set(
    attentionQueue(data.attention)
      .filter((row) => row.item.entity_type === "quote")
      .map((row) => row.item.entity_id),
  );
  const recentQuotes = (data.recent_quotes ?? []).filter((quote) => !attentionQuoteIds.has(quote.id));
  const empty =
    data.attention.length === 0 && data.today.items.length === 0 && data.activity.length === 0;

  return (
    <div className="ops-dashboard ops-command-center ops-dashboard-v3 flex flex-col gap-4">
      <DashboardCommandHeader
        displayName={displayName}
        roleKey={roleKey}
        features={features}
        attentionCount={attentionTotal}
        showCreate={false}
      />
      <DashboardSignalStrip
        attentionCount={attentionTotal}
        todayCount={data.today.items.length}
        quotesOpen={showQuotes ? (data.summary?.quotes_open ?? 0) : 0}
        pipelineValue={showQuotes ? (data.summary?.quotes_open_value ?? null) : null}
        showQuotes={showQuotes}
        showToday={data.today.items.length > 0 || can(roleKey, "jobs.view", features)}
      />
      <div className="ops-v3-ops-grid">
        <CommandStatus attention={data.attention} canCreateProject={false} />
        {data.today.items.length > 0 ? <ActiveWork items={data.today.items} /> : null}
      </div>
      {showQuotes && data.summary && hasQuoteRecords(data.summary) ? (
        <div className="ops-v3-pulse">
          <CommercialPulse summary={data.summary} chart={data.business_chart ?? null} />
        </div>
      ) : null}
      {showQuotes ? <RecentQuotes quotes={recentQuotes} canCreate={false} /> : null}
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
