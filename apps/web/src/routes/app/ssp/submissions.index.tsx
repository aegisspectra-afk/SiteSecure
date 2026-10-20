import { Button, Input } from "@site-secure/ui";
import { createFileRoute } from "@tanstack/react-router";
import { Inbox } from "lucide-react";
import { useState } from "react";
import {
  EmptyRows,
  ErrorState,
  ModuleScaffold,
  SimpleEntityTable,
  useQuery,
} from "../../../components/modules/ModuleKit";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/ssp/submissions/")({
  component: SspSubmissionsPage,
});

function SspSubmissionsPage() {
  return (
    <RequirePermission permission="ssp.submissions.view">
      <SspSubmissionsBody />
    </RequirePermission>
  );
}

function SspSubmissionsBody() {
  const { session, api } = useSession();
  const workspaceId = session?.memberships[0]?.workspace_id;
  const [formId, setFormId] = useState("");
  const [fromDate, setFromDate] = useState("");

  const listQuery = useQuery({
    queryKey: ["ssp-submissions", workspaceId, formId, fromDate],
    enabled: Boolean(workspaceId),
    queryFn: () =>
      api.listSspSubmissions(workspaceId!, {
        form_id: formId || undefined,
        from_date: fromDate || undefined,
      }),
    retry: false,
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  return (
    <ModuleScaffold title={he.sspSubmissions}>
      <div className="ss-module-toolbar">
        <Input
          id="ssp-filter-form"
          label="מזהה טופס"
          value={formId}
          onChange={(e) => setFormId(e.target.value)}
        />
        <Input
          id="ssp-filter-from"
          label="מתאריך"
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
        />
      </div>
      {listQuery.isError ? (
        <ErrorState
          title={he.apiUnavailable}
          action={
            <Button type="button" variant="secondary" onClick={() => void listQuery.refetch()}>
              {he.retry}
            </Button>
          }
        />
      ) : null}
      {listQuery.isLoading ? <EmptyRows message={he.loading} /> : null}
      {!listQuery.isLoading && !listQuery.isError && !(listQuery.data?.items.length) ? (
        <div className="ops-card flex flex-col items-start gap-3 p-6">
          <p className="text-base font-semibold text-fg">{he.sspNoSubmissions}</p>
        </div>
      ) : !listQuery.isLoading && !listQuery.isError ? (
        <SimpleEntityTable
          empty={he.sspNoSubmissions}
          leadingIcon={Inbox}
          rows={(listQuery.data?.items ?? []).map((row) => ({
            id: row.id,
            title: `${row.id.slice(0, 8)}…`,
            meta: `${he.sspSubmittedAt}: ${new Date(row.submitted_at).toLocaleString("he-IL")}`,
            status: row.status,
            href: `/app/ssp/submissions/${row.id}`,
          }))}
        />
      ) : null}
    </ModuleScaffold>
  );
}
