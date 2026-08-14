import { Button, ErrorState } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { Navigate, createFileRoute } from "@tanstack/react-router";
import { ObserveDashboard, OpsDashboard } from "../../components/dashboard/OpsDashboard";
import { DashboardSkeleton } from "../../components/dashboard/DashboardSkeleton";
import { he } from "../../i18n/he";
import { can } from "../../lib/can";
import { homeVariant } from "../../lib/home";
import { useSession } from "../../lib/session";

export const Route = createFileRoute("/app/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { session, api } = useSession();
  const membership = session?.memberships[0];
  const variant = homeVariant(membership?.role_key);
  const workspaceId = membership?.workspace_id;

  if (variant === "today") return <Navigate to="/app/today" />;
  if (!can(membership?.role_key, "dashboard.view", membership?.features ?? [])) {
    return <ErrorState title={he.noDashboardPermission} />;
  }

  return <DashboardBody workspaceId={workspaceId} roleKey={membership?.role_key} features={membership?.features ?? []} variant={variant} api={api} />;
}

function DashboardBody({
  workspaceId,
  roleKey,
  features,
  variant,
  api,
}: {
  workspaceId: string | undefined;
  roleKey: string | undefined;
  features: string[];
  variant: "ops" | "sales" | "observe" | "today";
  api: ReturnType<typeof useSession>["api"];
}) {
  const query = useQuery({
    queryKey: ["dashboard", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getDashboard(workspaceId!),
  });

  if (!workspaceId) return <ErrorState title={he.dashboardError} />;
  if (query.isLoading) return <DashboardSkeleton />;
  if (query.isError || !query.data) {
    return (
      <ErrorState
        title={he.dashboardError}
        action={
          <Button variant="secondary" onClick={() => void query.refetch()}>
            {he.retry}
          </Button>
        }
      />
    );
  }

  if (variant === "observe") return <ObserveDashboard data={query.data} />;
  return <OpsDashboard data={query.data} roleKey={roleKey} features={features} />;
}
