import { Button, ErrorState, PageHeader } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { RequireSspAccess } from "../components/RequirePermission";
import { he } from "../i18n/he";
import { useSession } from "../lib/session";

export function SubmissionDetailPage() {
  return (
    <RequireSspAccess permission="ssp.submissions.view">
      <SubmissionDetailBody />
    </RequireSspAccess>
  );
}

function SubmissionDetailBody() {
  const { submissionId } = useParams({ from: "/authenticated/submissions/$submissionId" });
  const { api, workspaceId } = useSession();

  const detail = useQuery({
    queryKey: ["ssp-submission", workspaceId, submissionId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getSspSubmission(workspaceId!, submissionId),
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;
  if (detail.isLoading) return <p className="text-sm text-fg-muted">{he.loading}</p>;
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
    <div className="flex flex-col gap-4" data-testid="ssp-submission-detail">
      <PageHeader
        title={he.sspViewSubmission}
        description={`${he.sspSubmittedAt}: ${new Date(row.submitted_at).toLocaleString("he-IL")}`}
      />
      <dl className="grid gap-2 text-sm">
        <div>
          <dt className="text-fg-muted">סטטוס</dt>
          <dd>{row.status}</dd>
        </div>
        <div>
          <dt className="text-fg-muted">טופס</dt>
          <dd className="font-mono text-xs">{row.form_id}</dd>
        </div>
      </dl>
      <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <h2 className="font-semibold">תשובות</h2>
        {fields.map((field) => {
          const value = row.answers[field.id];
          let display = "—";
          if (value === true) display = "כן";
          else if (value === false) display = "לא";
          else if (Array.isArray(value)) display = value.join(", ");
          else if (value != null && value !== "") display = String(value);
          return (
            <div key={field.id} className="border-b border-border pb-2 last:border-0">
              <div className="text-sm font-medium">{field.label}</div>
              <div className="text-sm text-fg-muted">{display}</div>
            </div>
          );
        })}
      </section>
      {row.consent?.length ? (
        <section className="rounded-lg border border-border p-4 text-sm">
          <h2 className="mb-2 font-semibold">הסכמות</h2>
          {row.consent.map((c) => (
            <div key={c.field_id} className="mb-2">
              <div className="text-fg-muted">{c.consent_wording}</div>
              <div>{c.accepted ? "אושר" : "לא אושר"}</div>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
