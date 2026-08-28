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

  const start = useMutation({
    mutationFn: (jobId: string) => api.startJob(workspaceId!, jobId),
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
      onStart={(id) => {
        setBusyId(id);
        start.mutate(id);
      }}
      onComplete={(id) => {
        // Field Job owns completion notes / checklist — do not silent-complete from Today.
        void navigate({ to: "/app/jobs/$jobId", params: { jobId: id } });
      }}
    />
  );
}
