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
  const features = membership?.features ?? [];
  const roleKey = membership?.role_key;

  if (variant === "today") return <Navigate to="/app/today" />;
  if (!can(roleKey, "dashboard.view", features)) {
    return <ErrorState title={he.noDashboardPermission} />;
  }

  return (
    <DashboardBody
      workspaceId={workspaceId}
      roleKey={roleKey}
      features={features}
      variant={variant}
      workspaceStatus={membership?.workspace_status}
      api={api}
    />
  );
}

function DashboardBody({
  workspaceId,
  roleKey,
  features,
  variant,
  workspaceStatus,
  api,
}: {
  workspaceId: string | undefined;
  roleKey: string | undefined;
  features: string[];
  variant: "ops" | "sales" | "observe" | "today";
  workspaceStatus?: string;
  api: ReturnType<typeof useSession>["api"];
}) {
  const canTeam = can(roleKey, "users.view", features) || can(roleKey, "workspace.billing", features);
  const canSecurity = can(roleKey, "settings.general", features) || can(roleKey, "workspace.edit", features);

  const query = useQuery({
    queryKey: ["dashboard", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getDashboard(workspaceId!),
  });
  const usage = useQuery({
    queryKey: ["usage", workspaceId],
    enabled: Boolean(workspaceId) && canTeam,
    queryFn: () => api.getUsage(workspaceId!),
  });
  const security = useQuery({
    queryKey: ["security", workspaceId],
    enabled: Boolean(workspaceId) && canSecurity,
    queryFn: () => api.getSecurityCenter(workspaceId!),
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

  const memberCount = canTeam ? (usage.data?.active_members ?? null) : null;
  const usageData = canTeam ? (usage.data ?? null) : null;

  if (variant === "observe") {
    return (
      <ObserveDashboard
        data={query.data}
        workspaceStatus={workspaceStatus}
        roleKey={roleKey}
        features={features}
        securitySignals={security.data?.signals ?? []}
      />
    );
  }
  return (
    <OpsDashboard
      data={query.data}
      roleKey={roleKey}
      features={features}
      memberCount={memberCount}
      usage={usageData}
      workspaceStatus={workspaceStatus}
      securitySignals={security.data?.signals ?? []}
    />
  );
}
