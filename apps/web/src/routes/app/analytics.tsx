import { Button, ErrorState, PageHeader } from "@site-secure/ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, Navigate, createFileRoute } from "@tanstack/react-router";
import { AnalyticsWorkspace } from "../../components/dashboard/AnalyticsWorkspace";
import { RequirePermission } from "../../components/settings/RequirePermission";
import { he } from "../../i18n/he";
import { can } from "../../lib/can";
import { hasFeature, homeVariant } from "../../lib/home";
import { hasQuoteRecords } from "../../lib/ux-metrics";
import { useSession } from "../../lib/session";

export const Route = createFileRoute("/app/analytics")({
  component: AnalyticsPage,
});

export function AnalyticsPage() {
  return (
    <RequirePermission permission="dashboard.view">
      <AnalyticsBody />
    </RequirePermission>
  );
}

function AnalyticsBody() {
  const { session, api } = useSession();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const features = membership?.features ?? [];
  const roleKey = membership?.role_key;
  const fieldHome = homeVariant(roleKey) === "today";
  const canQuotes = can(roleKey, "quotes.view", features) && hasFeature(features, "quotes");

  const query = useQuery({
    queryKey: ["dashboard", workspaceId, "analytics"],
    enabled: Boolean(workspaceId) && canQuotes && !fieldHome,
    queryFn: () => api.getDashboard(workspaceId!),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  if (fieldHome) {
    return <Navigate to="/app/today" />;
  }

  if (!workspaceId) {
    return <ErrorState title={he.analyticsError} />;
  }

  if (!canQuotes) {
    return (
      <div className="ss-analytics" data-testid="analytics-page">
        <PageHeader title={he.analyticsTitle} description={he.analyticsLead} />
        <ErrorState title={he.analyticsNoQuotesPermission} />
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className="ss-analytics" data-testid="analytics-page" aria-busy="true">
        <PageHeader title={he.analyticsTitle} description={he.analyticsLead} />
        <p className="ss-analytics-loading">{he.analyticsLoading}</p>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="ss-analytics" data-testid="analytics-page">
        <PageHeader title={he.analyticsTitle} description={he.analyticsLead} />
        <ErrorState
          title={he.analyticsError}
          action={
            <Button type="button" variant="secondary" onClick={() => void query.refetch()}>
              {he.retry}
            </Button>
          }
        />
      </div>
    );
  }

  const summary = query.data.summary;
  const chart = query.data.business_chart ?? null;
  const hasCommercial = Boolean(summary) && hasQuoteRecords(summary);

  return (
    <div className="ss-analytics" data-testid="analytics-page">
      <PageHeader
        title={he.analyticsTitle}
        description={he.analyticsLead}
        action={
          <div className="ss-analytics-header-actions">
            <Link to="/app/dashboard" className="ops-section-link">
              {he.analyticsBackDashboard}
            </Link>
            <Link to="/app/quotes" className="ops-section-link">
              {he.analyticsOpenQuotes}
            </Link>
          </div>
        }
      />

      {hasCommercial && summary ? (
        <AnalyticsWorkspace
          summary={summary}
          chart={chart}
          attention={query.data.attention ?? []}
          recentQuotes={query.data.recent_quotes ?? []}
        />
      ) : (
        <div className="ss-analytics-empty" data-testid="analytics-empty">
          <p className="ss-analytics-empty-title">{he.analyticsEmptyTitle}</p>
          <p className="ss-analytics-empty-body">{he.analyticsEmptyBody}</p>
          <Link to="/app/quotes" className="ops-section-link">
            {he.analyticsOpenQuotes}
          </Link>
        </div>
      )}
    </div>
  );
}
