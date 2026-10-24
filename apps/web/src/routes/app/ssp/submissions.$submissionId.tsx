import { Button, Card, LoadingBlock, Status } from "@site-secure/ui";
import { createFileRoute } from "@tanstack/react-router";
import { ErrorState, ModuleScaffold, useQuery } from "../../../components/modules/ModuleKit";
import { useSspWorkspace } from "../../../components/ssp/useSspWorkspace";
import { he } from "../../../i18n/he";

export const Route = createFileRoute("/app/ssp/submissions/$submissionId")({
  component: SspSubmissionDetailPage,
});

function SspSubmissionDetailPage() {
  const { canViewSubmissions } = useSspWorkspace();
  if (!canViewSubmissions) {
    return <ErrorState title={he.forbiddenTitle} description={he.forbiddenBody} />;
  }
  return <SspSubmissionDetailBody />;
}

function SspSubmissionDetailBody() {
  const { submissionId } = Route.useParams();
  const { api, workspaceId } = useSspWorkspace();

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
        title={row.form_title || he.sspViewSubmission}
        lead={`${he.sspSubmittedAt}: ${new Date(row.submitted_at).toLocaleString("he-IL")}`}
      >
        <Card className="flex flex-col gap-3">
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs text-fg-muted">סטטוס</dt>
              <dd className="mt-0.5">
                <Status label={row.status} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-fg-muted">{he.sspForms}</dt>
              <dd className="mt-0.5 font-medium text-fg">{row.form_title || row.form_id.slice(0, 8)}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-muted">{he.sspFormVersion}</dt>
              <dd className="mt-0.5 font-medium text-fg">
                {row.form_version != null ? `v${row.form_version}` : row.form_version_id.slice(0, 8)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-fg-muted">{he.sspSubmittedBy}</dt>
              <dd className="mt-0.5 font-medium text-fg">{row.submitted_by_name || row.submitted_by || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-muted">{he.sspAssignOffice}</dt>
              <dd className="mt-0.5 font-medium text-fg">{row.site_name || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-muted">{he.sspAssignmentTarget}</dt>
              <dd className="mt-0.5 font-mono text-xs text-fg">
                {(row.site_assignment_id || row.assignment_id || "").slice(0, 8) || "—"}
              </dd>
            </div>
          </dl>
        </Card>
        <Card className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-fg">תשובות</h2>
          {fields.map((field) => {
            const value = row.answers[field.id];
            const optionLabel = (id: string) =>
              (field.options ?? []).find((opt) => opt.id === id)?.label || id;
            let display = "—";
            if (value === true) display = "כן";
            else if (value === false) display = "לא";
            else if (Array.isArray(value)) display = value.map((item) => optionLabel(String(item))).join(", ");
            else if (field.type === "single_choice" && value != null && value !== "") display = optionLabel(String(value));
            else if (value != null && value !== "") display = String(value);
            return (
              <div key={field.id} className="border-b border-border pb-2 last:border-0">
                <div className="text-sm font-medium text-fg">{field.label}</div>
                <div className="text-sm text-fg-muted">{display}</div>
              </div>
            );
          })}
          {!fields.length ? <p className="ss-module-empty-text">{he.sspNoItems}</p> : null}
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
