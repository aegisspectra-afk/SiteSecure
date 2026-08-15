import { ErrorState, PageHeader, Status, type StatusTone } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
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
  if (query.isLoading) return <p className="text-sm text-fg-muted">{he.loading}</p>;
  if (query.isError || !query.data) return <ErrorState title={he.securityError} />;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={he.securityTitle} description={he.securityLead} />
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
