import { Button, ErrorState } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { Navigate, createFileRoute } from "@tanstack/react-router";
import { ObserveDashboard, OpsDashboard } from "../../components/dashboard/OpsDashboard";
import { DashboardSkeleton } from "../../components/dashboard/DashboardSkeleton";
import { he } from "../../i18n/he";
import { can, canAny } from "../../lib/can";
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
      api={api}
    />
  );
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
  const canTeam = can(roleKey, "users.view", features);
  const canSecurity = canAny(roleKey, ["settings.general", "workspace.edit"], features);

  const query = useQuery({
    queryKey: ["dashboard", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getDashboard(workspaceId!),
  });
  const members = useQuery({
    queryKey: ["members", workspaceId],
    enabled: Boolean(workspaceId) && canTeam,
    queryFn: () => api.listMembers(workspaceId!),
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

  const memberCount = canTeam ? (members.data?.length ?? null) : null;
  const securityData = canSecurity ? (security.data ?? null) : null;

  if (variant === "observe") {
    return <ObserveDashboard data={query.data} security={securityData} />;
  }
  return (
    <OpsDashboard
      data={query.data}
      roleKey={roleKey}
      features={features}
      memberCount={memberCount}
      security={securityData}
    />
  );
}
