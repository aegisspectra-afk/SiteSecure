import { ErrorState, PageHeader, Status, type StatusTone } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { LottieAnimation } from "../../../components/lottie";
import { RequireAnyPermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/settings/security")({
  component: SecurityPage,
});

function SecurityPage() {
  return (
    <RequireAnyPermission permissions={["settings.general", "workspace.edit"]}>
      <SecurityBody />
    </RequireAnyPermission>
  );
}

function SecurityBody() {
  const { session, api } = useSession();
  const workspaceId = session?.memberships[0]?.workspace_id;
  const query = useQuery({
    queryKey: ["security", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getSecurityCenter(workspaceId!),
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;
  if (query.isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <LottieAnimation name="scan" size={80} />
        <p className="text-sm text-fg-muted" role="status">
          {he.loading}
        </p>
      </div>
    );
  }
  if (query.isError || !query.data) return <ErrorState title={he.securityError} />;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start gap-4">
        <LottieAnimation name="securityShield" size={48} className="mt-1 shrink-0" />
        <div className="min-w-0 flex-1">
          <PageHeader title={he.securityTitle} description={he.securityLead} />
        </div>
      </div>
      <ul className="flex flex-col gap-4">
        {query.data.signals.map((signal) => (
          <li key={signal.key} className="flex flex-col gap-1 border-b border-border pb-4">
            <Status label={signal.label_he} tone={toneFor(signal.status)} />
            <p className="text-sm text-fg-muted">{signal.detail_he}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function toneFor(status: "healthy" | "not_in_plan" | "not_built"): StatusTone {
  if (status === "healthy") return "success";
  if (status === "not_in_plan") return "warning";
  return "neutral";
}
