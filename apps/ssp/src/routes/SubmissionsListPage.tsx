import { Button, ErrorState, Input, PageHeader } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { RequireSspAccess } from "../components/RequirePermission";
import { he } from "../i18n/he";
import { useSession } from "../lib/session";

export function SubmissionsListPage() {
  return (
    <RequireSspAccess permission="ssp.submissions.view">
      <SubmissionsListBody />
    </RequireSspAccess>
  );
}

function SubmissionsListBody() {
  const { api, workspaceId } = useSession();
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
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={he.sspSubmissions} />
      <div className="flex flex-wrap gap-3">
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
      {!listQuery.isLoading && !(listQuery.data?.items.length) ? (
        <p className="text-sm text-fg-muted">{he.sspNoSubmissions}</p>
      ) : null}
      <ul className="divide-y divide-border rounded-lg border border-border">
        {(listQuery.data?.items ?? []).map((row) => (
          <li key={row.id}>
            <Link
              to="/submissions/$submissionId"
              params={{ submissionId: row.id }}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-bg-subtle"
            >
              <div>
                <div className="text-sm font-medium text-fg">{row.id.slice(0, 8)}…</div>
                <div className="text-xs text-fg-muted">
                  {he.sspSubmittedAt}: {new Date(row.submitted_at).toLocaleString("he-IL")}
                </div>
              </div>
              <span className="text-xs text-fg-muted">{row.status}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
