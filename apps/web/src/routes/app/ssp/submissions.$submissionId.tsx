import { Button, Card, LoadingBlock, Status } from "@site-secure/ui";
import { createFileRoute } from "@tanstack/react-router";
import { ErrorState, ModuleScaffold, useQuery } from "../../../components/modules/ModuleKit";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/ssp/submissions/$submissionId")({
  component: SspSubmissionDetailPage,
});

function SspSubmissionDetailPage() {
  return (
    <RequirePermission permission="ssp.submissions.view">
      <SspSubmissionDetailBody />
    </RequirePermission>
  );
}

function SspSubmissionDetailBody() {
  const { submissionId } = Route.useParams();
  const { session, api } = useSession();
  const workspaceId = session?.memberships[0]?.workspace_id;

  const detail = useQuery({
    queryKey: ["ssp-submission", workspaceId, submissionId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getSspSubmission(workspaceId!, submissionId),
    retry: false,
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;
  if (detail.isLoading) return <LoadingBlock label={he.loading} />;
  if (detail.isError || !detail.data) {
    return (
      <ErrorState
        title={he.apiUnavailable}
        action={
          <Button type="button" variant="secondary" onClick={() => void detail.refetch()}>
            {he.retry}
          </Button>
        }
      />
    );
  }

  const row = detail.data;
  const fields = row.definition_snapshot?.fields ?? [];

  return (
    <div data-testid="ssp-submission-detail">
      <ModuleScaffold
        title={he.sspViewSubmission}
        lead={`${he.sspSubmittedAt}: ${new Date(row.submitted_at).toLocaleString("he-IL")}`}
      >
        <Card className="flex flex-col gap-3">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-fg-muted">סטטוס</dt>
              <dd className="mt-0.5">
                <Status label={row.status} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-fg-muted">טופס</dt>
              <dd className="mt-0.5 font-mono text-xs text-fg">{row.form_id}</dd>
            </div>
          </dl>
        </Card>
        <Card className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-fg">תשובות</h2>
          {fields.map((field) => {
            const value = row.answers[field.id];
            let display = "—";
            if (value === true) display = "כן";
            else if (value === false) display = "לא";
            else if (Array.isArray(value)) display = value.join(", ");
            else if (value != null && value !== "") display = String(value);
            return (
              <div key={field.id} className="border-b border-border pb-2 last:border-0">
                <div className="text-sm font-medium text-fg">{field.label}</div>
                <div className="text-sm text-fg-muted">{display}</div>
              </div>
            );
          })}
        </Card>
        {row.consent?.length ? (
          <Card className="flex flex-col gap-3 text-sm">
            <h2 className="text-base font-semibold text-fg">הסכמות</h2>
            {row.consent.map((c) => (
              <div key={c.field_id}>
                <div className="text-fg-muted">{c.consent_wording}</div>
                <div className="mt-0.5 font-medium text-fg">{c.accepted ? "אושר" : "לא אושר"}</div>
              </div>
            ))}
          </Card>
        ) : null}
      </ModuleScaffold>
    </div>
  );
}
