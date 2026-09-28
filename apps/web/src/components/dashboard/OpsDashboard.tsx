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
import { hasFeature, homeVariant } from "../../lib/home";
import { liveAdminActions, workspaceSetup } from "../../lib/workspace-setup";
import { ActivationCard } from "./ActivationCard";
import { ActiveWork } from "./ActiveWork";
import { CommandStatus } from "./CommandStatus";
import { DashboardActivity } from "./DashboardActivity";
import { buildCreateActions } from "./DashboardCreateMenu";
import { DashboardCommandHero } from "./DashboardCommandHero";
import { DashboardFreshness } from "./DashboardFreshness";
import { DashboardZone } from "./DashboardZone";
import { QuotePipeline } from "./QuotePipeline";
import { RecentQuotes } from "./RecentQuotes";
import { UsageThresholdBanner, usageThresholdMeters } from "./UsageThresholdBanner";

/**
 * Premium daily command center — hero balance + quick actions + zoned ops/commercial.
 */
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
  const activityItems = data.activity ?? [];

  const setupProgress =
    !setup.complete && setup.total > 0
      ? { percent: setup.percent, done: setup.done, total: setup.total }
      : null;
  const todayItems = data.today.items;
  // Sales API returns empty today jobs by design — hide the empty Today tile (no /app/today ping-pong).
  const showToday =
    can(roleKey, "jobs.view", features) && homeVariant(roleKey) !== "sales";
  const thresholdMeters = usageThresholdMeters(usage);
  const canManageTeam = Boolean(invite) || can(roleKey, "users.view", features);
  const showUsageBanner = thresholdMeters.length > 0 && roleKey !== "sales" && canManageTeam;

  const showTodaySection = showToday;
  const showActivity = activityItems.length > 0;
  const showAttention = !showActivation && attentionTotal > 0;
  const showCommercial = showQuotes && Boolean(summary) && !showActivation;
  const showUtility = showActivation || showUsageBanner;

  const showPrimary = showTodaySection || showAttention;
  const showSecondary = showActivity || showCommercial;

  const isSparseWorkbench = !showAttention && !showSecondary && showTodaySection && showUtility;

  const primaryClass = [
    "ops-command-primary",
    "is-dash-final",
    showAttention && showTodaySection ? "has-pair" : "is-solo",
    !showAttention && todayItems.length === 0 ? "is-empty-today" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const secondaryClass = [
    "ops-command-secondary",
    "is-dash-final",
    showActivity && showCommercial ? "has-pair" : "is-solo",
  ].join(" ");

  const showCreateActions = buildCreateActions(roleKey, features).length > 0;

  return (
    <div className="ops-dashboard ops-command-center ops-dashboard-v3 ops-dashboard-flagship ops-dashboard-v2 ops-dashboard-daily ops-dashboard-adaptive ops-dashboard-dash12 ops-dashboard-final flex flex-col">
      <DashboardCommandHero
        displayName={displayName}
        roleKey={roleKey}
        features={features}
        attentionCount={attentionTotal}
        todayCount={todayItems.length}
        quotesOpen={showQuotes ? (summary?.quotes_open ?? 0) : 0}
        showQuotes={showQuotes}
        showToday={showToday}
        showCreate={showCreateActions}
        activationMode={showActivation}
        summary={showQuotes ? summary : null}
        chart={data.business_chart ?? null}
        secondaryAction={
          !quoteCta && invite ? (
            <Link to={invite.href} className="ops-command-hero-invite">
              {invite.label}
            </Link>
          ) : undefined
        }
      />

      <div className="ops-command-body ss-ops-enter ss-ops-enter-3">
        {isSparseWorkbench ? (
          <div className="ops-command-workbench is-low-data">
            {showTodaySection ? <ActiveWork items={todayItems} compactEmpty /> : null}
            <div className="ops-command-rail">
              {showActivation ? (
                <ActivationCard
                  activation={activation}
                  setupProgress={setupProgress}
                  canCreateQuote={canCreateQuote}
                  canCreateCustomer={canCreateCustomer}
                  compact
                  panel
                />
              ) : null}
              {showUsageBanner ? (
                <UsageThresholdBanner meters={thresholdMeters} canManageTeam={canManageTeam} />
              ) : null}
            </div>
          </div>
        ) : (
          <>
            {showPrimary ? (
              <DashboardZone id="ops" label={he.dashZoneOps} className="is-ops">
                <div className={primaryClass}>
                  {showAttention ? (
                    <CommandStatus
                      attention={attentionGroups}
                      canCreateProject={canCreateProject}
                      viewAllTo={showQuotes ? "/app/quotes" : "/app/today"}
                      workspaceId={workspaceId}
                    />
                  ) : null}
                  {showTodaySection ? <ActiveWork items={todayItems} compactEmpty /> : null}
                </div>
              </DashboardZone>
            ) : null}

            {showSecondary ? (
              <DashboardZone id="commercial" label={he.dashZoneCommercial} className="is-commercial">
                <div className={secondaryClass}>
                  {showActivity ? <DashboardActivity items={activityItems} /> : null}
                  {showCommercial && summary ? <QuotePipeline summary={summary} /> : null}
                  {showCommercial ? (
                    <RecentQuotes quotes={recentQuotes} canCreate={Boolean(quoteCta)} />
                  ) : null}
                </div>
              </DashboardZone>
            ) : null}

            {showUtility ? (
              <DashboardZone id="utility" label={he.dashZoneUtility} className="is-utility">
                <div className="ops-home-utility">
                  {showActivation ? (
                    <ActivationCard
                      activation={activation}
                      setupProgress={setupProgress}
                      canCreateQuote={canCreateQuote}
                      canCreateCustomer={canCreateCustomer}
                      compact
                    />
                  ) : null}
                  {showUsageBanner ? (
                    <UsageThresholdBanner meters={thresholdMeters} canManageTeam={canManageTeam} />
                  ) : null}
                </div>
              </DashboardZone>
            ) : null}
          </>
        )}
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
  leadAttentionItems = [],
}: {
  data: DashboardResponse;
  workspaceStatus?: string;
  roleKey?: string;
  features?: string[];
  displayName?: string | null;
  workspaceName?: string | null;
  leadAttentionItems?: LeadOut[];
}) {
  const showQuotes = Boolean(data.summary) && can(roleKey, "quotes.view", features) && hasFeature(features, "quotes");
  const leadRows = filterLeadAttention(leadAttentionItems);
  const attentionGroups = [...data.attention, ...leadsToAttentionGroups(leadRows)];
  const attentionTotal = attentionEntityCount(attentionGroups);
  const attentionQuoteIds = new Set(
    attentionQueue(attentionGroups)
      .filter((row) => row.item.entity_type === "quote")
      .map((row) => row.item.entity_id),
  );
  const showToday = data.today.items.length > 0;
  const showAttention = attentionTotal > 0;
  const recentQuotes = (data.recent_quotes ?? []).filter((quote) => !attentionQuoteIds.has(quote.id));
  const activityItems = data.activity ?? [];
  const showActivity = activityItems.length > 0;
  const empty =
    attentionTotal === 0 && data.today.items.length === 0 && activityItems.length === 0 && recentQuotes.length === 0;

  const primaryClass = [
    "ops-command-primary",
    "is-dash-final",
    showAttention && showToday ? "has-pair" : "is-solo",
    !showAttention && data.today.items.length === 0 ? "is-empty-today" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const secondaryClass = [
    "ops-command-secondary",
    "is-dash-final",
    showActivity && showQuotes ? "has-pair" : "is-solo",
  ].join(" ");

  return (
    <div className="ops-dashboard ops-command-center ops-dashboard-v3 ops-dashboard-flagship ops-dashboard-v2 ops-dashboard-daily ops-dashboard-adaptive ops-dashboard-dash12 ops-dashboard-final flex flex-col">
      <DashboardCommandHero
        displayName={displayName}
        roleKey={roleKey}
        features={features}
        attentionCount={attentionTotal}
        todayCount={data.today.items.length}
        quotesOpen={showQuotes ? (data.summary?.quotes_open ?? 0) : 0}
        showQuotes={showQuotes}
        showToday={showToday || can(roleKey, "jobs.view", features)}
        showCreate={false}
        summary={showQuotes ? data.summary : null}
        chart={data.business_chart ?? null}
      />

      <div className="ops-command-body ss-ops-enter ss-ops-enter-3">
        {showAttention || showToday ? (
          <DashboardZone id="ops" label={he.dashZoneOps} className="is-ops">
            <div className={primaryClass}>
              {showAttention ? <CommandStatus attention={attentionGroups} canCreateProject={false} /> : null}
              {showToday ? <ActiveWork items={data.today.items} compactEmpty /> : null}
            </div>
          </DashboardZone>
        ) : null}

        {showActivity || showQuotes ? (
          <DashboardZone id="commercial" label={he.dashZoneCommercial} className="is-commercial">
            <div className={secondaryClass}>
              {showActivity ? <DashboardActivity items={activityItems} /> : null}
              {showQuotes && data.summary ? <QuotePipeline summary={data.summary} linked={false} /> : null}
              {showQuotes ? <RecentQuotes quotes={recentQuotes} canCreate={false} /> : null}
            </div>
          </DashboardZone>
        ) : null}

        {empty ? (
          <div className="ops-panel p-4">
            <p className="text-sm font-medium text-fg">{he.dashboardEmptyTitle}</p>
            <p className="mt-1 text-sm text-fg-muted">{he.viewerEmptyBody}</p>
          </div>
        ) : null}
      </div>

      <DashboardFreshness generatedAt={data.generated_at} />
    </div>
  );
}
