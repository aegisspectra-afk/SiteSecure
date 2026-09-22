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
import { DashboardActivity } from "./DashboardActivity";
import { DashboardCommandHero } from "./DashboardCommandHero";
import { DashboardFreshness } from "./DashboardFreshness";
import { RecentQuotes } from "./RecentQuotes";
import { UsageThresholdBanner, usageThresholdMeters } from "./UsageThresholdBanner";

/**
 * Phase 1B.4 — Adaptive daily command center.
 * Uses existing GET /dashboard (+ existing lead/usage probes). No Tasks/Service/Projects/Warranties queries.
 * Sections omit when empty; desktop primary/secondary grids reflow — no reserved blank slots.
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
  const showBusiness =
    showQuotes &&
    Boolean(summary) &&
    hasQuoteRecords(summary) &&
    ((summary?.quotes_open ?? 0) > 0 ||
      (summary?.quotes_open_value ?? 0) > 0 ||
      (summary?.quotes_approved_value ?? 0) > 0);
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
  const showToday = can(roleKey, "jobs.view", features);
  const thresholdMeters = usageThresholdMeters(usage);
  const canManageTeam = Boolean(invite) || can(roleKey, "users.view", features);
  const showUsageBanner = thresholdMeters.length > 0 && roleKey !== "sales" && canManageTeam;

  // Today remains visible (incl. compact empty) whenever jobs are permitted — controlled width, not a giant wall.
  const showTodaySection = showToday;
  // Truthful limited activity (quote events + job completions) — never invent rows.
  const showActivity = activityItems.length > 0;
  // Recent quotes when no activity rows; omit empty recent during activation (Quick Actions + setup own start).
  const showRecentSection = !showActivity && showQuotes && recentQuotes.length > 0 && !showActivation;
  // Attention only when items exist — Hero calm state is enough when quiet.
  const showAttention = !showActivation && attentionTotal > 0;

  const showPrimary = showTodaySection || showAttention;
  const showSecondary = showActivity || showRecentSection || showBusiness;
  const showUtility = showActivation || showUsageBanner;

  /**
   * Low-data desktop: pair Today with Setup/warning rail — never leave a dead sibling column.
   * Active data: Attention|Today then Recent|Commercial; utilities stay compact.
   */
  const isSparseWorkbench = !showAttention && !showSecondary && showTodaySection && showUtility;

  const primaryClass = [
    "ops-command-primary",
    showAttention && showTodaySection ? "has-pair" : "is-solo",
    !showAttention && todayItems.length === 0 ? "is-empty-today" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const secondaryClass = [
    "ops-command-secondary",
    (showActivity || showRecentSection) && showBusiness ? "has-pair" : "is-solo",
  ].join(" ");

  // Quick Actions remain available in low-data workspaces — actionability is the product.
  const showCreateActions =
    canCreateQuote ||
    canCreateCustomer ||
    can(roleKey, "sites.create", features) ||
    can(roleKey, "leads.create", features) ||
    can(roleKey, "jobs.create", features);

  return (
    <div className="ops-dashboard ops-command-center ops-dashboard-v3 ops-dashboard-flagship ops-dashboard-v2 ops-dashboard-daily ops-dashboard-adaptive flex flex-col">
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
            ) : null}

            {showSecondary ? (
              <div className={secondaryClass}>
                {showActivity ? <DashboardActivity items={activityItems} /> : null}
                {showRecentSection ? (
                  <RecentQuotes quotes={recentQuotes} canCreate={Boolean(quoteCta)} />
                ) : null}
                {showBusiness && summary ? (
                  <div className="ops-v3-pulse">
                    <CommercialPulse summary={summary} chart={data.business_chart ?? null} />
                  </div>
                ) : null}
              </div>
            ) : null}

            {showUtility ? (
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
  const activityItems = data.activity ?? [];
  const empty =
    data.attention.length === 0 && data.today.items.length === 0 && activityItems.length === 0 && recentQuotes.length === 0;
  const showToday = data.today.items.length > 0 || can(roleKey, "jobs.view", features);
  const showAttention = attentionTotal > 0;
  const showActivity = activityItems.length > 0;
  const showRecent = !showActivity && showQuotes && recentQuotes.length > 0;
  const showBusiness =
    showQuotes &&
    data.summary &&
    hasQuoteRecords(data.summary) &&
    ((data.summary.quotes_open ?? 0) > 0 ||
      (data.summary.quotes_open_value ?? 0) > 0 ||
      (data.summary.quotes_approved_value ?? 0) > 0);

  const primaryClass = [
    "ops-command-primary",
    showAttention && showToday ? "has-pair" : "is-solo",
    !showAttention && data.today.items.length === 0 ? "is-empty-today" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const secondaryClass = [
    "ops-command-secondary",
    (showActivity || showRecent) && showBusiness ? "has-pair" : "is-solo",
  ].join(" ");

  return (
    <div className="ops-dashboard ops-command-center ops-dashboard-v3 ops-dashboard-flagship ops-dashboard-v2 ops-dashboard-daily ops-dashboard-adaptive flex flex-col">
      <DashboardCommandHero
        displayName={displayName}
        roleKey={roleKey}
        features={features}
        attentionCount={attentionTotal}
        todayCount={data.today.items.length}
        quotesOpen={showQuotes ? (data.summary?.quotes_open ?? 0) : 0}
        showQuotes={showQuotes}
        showToday={showToday}
        showCreate={false}
      />
      <div className="ops-command-body ss-ops-enter ss-ops-enter-3">
        {showAttention || showToday ? (
          <div className={primaryClass}>
            {showAttention ? <CommandStatus attention={data.attention} canCreateProject={false} /> : null}
            {showToday ? <ActiveWork items={data.today.items} compactEmpty /> : null}
          </div>
        ) : null}
        {showActivity || showRecent || showBusiness ? (
          <div className={secondaryClass}>
            {showActivity ? <DashboardActivity items={activityItems} /> : null}
            {showRecent ? <RecentQuotes quotes={recentQuotes} canCreate={false} /> : null}
            {showBusiness && data.summary ? (
              <div className="ops-v3-pulse">
                <CommercialPulse summary={data.summary} chart={data.business_chart ?? null} />
              </div>
            ) : null}
          </div>
        ) : null}
        {empty ? (
          <div className="ops-observe-empty">
            <p className="text-sm font-medium text-fg">{he.dashboardEmptyTitle}</p>
            <p className="mt-1 text-sm text-fg-muted">{he.viewerEmptyBody}</p>
          </div>
        ) : null}
      </div>
      <DashboardFreshness generatedAt={data.generated_at} />
    </div>
  );
}
