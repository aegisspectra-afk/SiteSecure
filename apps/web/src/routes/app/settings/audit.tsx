import { Button, EmptyState, ErrorState, PageHeader, Table, TBody, TD, TH, THead, TR } from "@site-secure/ui";
import { ApiClientError } from "@site-secure/api-client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/settings/audit")({
  component: AuditPage,
});

function AuditPage() {
  return (
    <RequirePermission permission="audit.view">
      <AuditBody />
    </RequirePermission>
  );
}

function AuditBody() {
  const { session, api } = useSession();
  const workspaceId = session?.memberships[0]?.workspace_id;
  const query = useQuery({
    queryKey: ["audit", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listAudit(workspaceId!),
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;
  if (query.isLoading) return <p className="text-sm text-fg-muted">{he.loading}</p>;
  if (query.isError) {
    const locked =
      query.error instanceof ApiClientError && query.error.code === "FEATURE_NOT_INCLUDED";
    return (
      <ErrorState
        title={locked ? he.auditLockedTitle : he.auditError}
        description={locked ? he.auditLockedBody : undefined}
        action={
          locked ? undefined : (
            <Button variant="secondary" onClick={() => void query.refetch()}>
              {he.retry}
            </Button>
          )
        }
      />
    );
  }
  if (!query.data?.length) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title={he.auditTitle} description={he.auditLead} />
        <EmptyState title={he.auditEmpty} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={he.auditTitle} description={he.auditLead} />
      <Table>
        <THead>
          <TR>
            <TH>{he.auditAction}</TH>
            <TH>{he.auditResult}</TH>
            <TH>{he.auditTime}</TH>
          </TR>
        </THead>
        <TBody>
          {query.data.map((row) => (
            <TR key={row.id}>
              <TD className="ltr-meta">{row.action}</TD>
              <TD>{typeof row.metadata.result === "string" ? String(row.metadata.result) : "—"}</TD>
              <TD className="ltr-meta">{row.created_at}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
