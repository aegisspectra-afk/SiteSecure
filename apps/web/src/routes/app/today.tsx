import { Button, ErrorState } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { DashboardSkeleton } from "../../components/dashboard/DashboardSkeleton";
import { TodayHome } from "../../components/dashboard/TodayHome";
import { he } from "../../i18n/he";
import { can } from "../../lib/can";
import { homeVariant } from "../../lib/home";
import { useSession } from "../../lib/session";

export const Route = createFileRoute("/app/today")({
  component: TodayPage,
});

function TodayPage() {
  const { session, api } = useSession();
  const navigate = useNavigate();
  const membership = session?.memberships[0];
  const variant = homeVariant(membership?.role_key);
  const workspaceId = membership?.workspace_id;
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const allowed = can(membership?.role_key, "dashboard.view", membership?.features ?? []);

  const query = useQuery({
    queryKey: ["dashboard", workspaceId],
    enabled: Boolean(workspaceId) && variant === "today" && allowed,
    queryFn: () => api.getDashboard(workspaceId!),
  });

  const action = useMutation({
    mutationFn: async ({ jobId, kind }: { jobId: string; kind: string }) => {
      if (kind === "en_route") return api.enRouteJob(workspaceId!, jobId);
      if (kind === "arrived") return api.arrivedJob(workspaceId!, jobId);
      if (kind === "start") return api.startJob(workspaceId!, jobId);
      if (kind === "complete") {
        await navigate({ to: "/app/jobs/$jobId", params: { jobId } });
        return null;
      }
      return null;
    },
    onSettled: () => {
      setBusyId(null);
      void queryClient.invalidateQueries({ queryKey: ["dashboard", workspaceId] });
    },
  });

  if (variant !== "today") return <Navigate to="/app/dashboard" />;
  if (!allowed) return <ErrorState title={he.noDashboardPermission} />;
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

  return (
    <TodayHome
      data={query.data}
      busyId={busyId}
      onAction={(id, kind) => {
        if (kind === "complete") {
          void navigate({ to: "/app/jobs/$jobId", params: { jobId: id } });
          return;
        }
        setBusyId(id);
        action.mutate({ jobId: id, kind });
      }}
    />
  );
}
