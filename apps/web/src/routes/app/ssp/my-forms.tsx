import { Button, Card, LoadingBlock } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ErrorState, ModuleScaffold } from "../../../components/modules/ModuleKit";
import { SspFormFields } from "../../../components/ssp/SspFormFields";
import { useSspWorkspace } from "../../../components/ssp/useSspWorkspace";
import { he } from "../../../i18n/he";

export const Route = createFileRoute("/app/ssp/my-forms")({
  component: SspMyFormsPage,
});

function statusLabel(status: string) {
  if (status === "submitted") return he.sspFillSubmitted;
  if (status === "overdue") return he.sspFillOverdue;
  if (status === "upcoming") return he.sspFillInProgress;
  if (status === "paused" || status === "completed") return status;
  return he.sspFillPending;
}

function SspMyFormsPage() {
  const { api, workspaceId } = useSspWorkspace();
  const qc = useQueryClient();
  const [fillId, setFillId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const inbox = useQuery({
    queryKey: ["ssp-my-forms", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspMyForms(workspaceId!),
    retry: false,
  });
  const fillDetail = useQuery({
    queryKey: ["ssp-site-assignment", workspaceId, fillId],
    enabled: Boolean(workspaceId && fillId),
    queryFn: () => api.getSspSiteAssignment(workspaceId!, fillId!),
    retry: false,
  });
  const submit = useMutation({
    mutationFn: () => api.submitSspSiteAssignment(workspaceId!, fillId!, { answers }),
    onSuccess: async () => {
      setMsg(he.sspSubmitSuccess);
      setFillId(null);
      setAnswers({});
      await qc.invalidateQueries({ queryKey: ["ssp-my-forms", workspaceId] });
    },
    onError: (e: unknown) => setMsg(e instanceof Error ? e.message : he.sspSubmitFail),
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;
  if (inbox.isLoading) return <LoadingBlock label={he.loading} />;
  if (inbox.isError) {
    return (
      <ErrorState
        title={he.apiUnavailable}
        action={
          <Button type="button" variant="secondary" onClick={() => void inbox.refetch()}>
            {he.retry}
          </Button>
        }
      />
    );
  }

  const items = inbox.data?.items ?? [];
  const pending = items.filter((i) => i.fill_status === "available" || i.fill_status === "overdue" || i.fill_status === "upcoming");
  const submitted = items.filter((i) => i.fill_status === "submitted" || i.submission_id);

  return (
    <div data-testid="ssp-my-forms">
      <ModuleScaffold title={he.sspNavMyForms} lead={he.sspMyFormsLead}>
        {msg ? <p className="text-sm text-fg-muted">{msg}</p> : null}
        {fillId ? (
          <Card className="flex flex-col gap-3" data-testid="ssp-my-form-fill">
            <h2 className="text-base font-semibold text-fg">{he.sspOpenForm}</h2>
            {fillDetail.isLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
            {fillDetail.isError ? <ErrorState title={he.apiUnavailable} /> : null}
            <SspFormFields
              fields={fillDetail.data?.definition_snapshot?.fields ?? []}
              answers={answers}
              onChange={setAnswers}
              disabled={submit.isPending}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => {
                  const missing = (fillDetail.data?.definition_snapshot?.fields ?? []).some((field) => {
                    if (!field.required || field.type === "heading") return false;
                    const value = answers[field.id];
                    if (field.type === "yes_no" || field.type === "checkbox" || field.type === "consent") {
                      return value !== true && value !== "true";
                    }
                    return value == null || value === "" || (Array.isArray(value) && !value.length);
                  });
                  if (missing) {
                    setMsg(he.sspFillMissing);
                    return;
                  }
                  submit.mutate();
                }}
                disabled={submit.isPending || !fillDetail.data}
              >
                {he.sspSubmit}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setFillId(null)}>
                {he.sspCancelFill}
              </Button>
            </div>
          </Card>
        ) : null}
        <Card className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-fg">{he.sspFillPending}</h2>
          {!pending.length ? (
            <p className="ss-module-empty-text">{he.sspNoPendingFill}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {pending.map((item) => (
                <li
                  key={item.assignment_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] bg-bg-subtle px-3 py-2 text-sm"
                >
                  <span>
                    <span className="font-medium text-fg">{item.form_title || item.form_id}</span>
                    <span className="text-xs text-fg-muted">
                      {" · "}
                      {item.site_name} · {statusLabel(item.fill_status)}
                      {item.due_at ? ` · ${item.due_at.slice(0, 10)}` : ""}
                    </span>
                  </span>
                  {item.status === "active" ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setFillId(item.assignment_id);
                        setAnswers({});
                        setMsg(null);
                      }}
                    >
                      {he.sspOpenForm}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-fg">{he.sspFillSubmitted}</h2>
          {!submitted.length ? (
            <p className="ss-module-empty-text">{he.sspNoSubmissions}</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {submitted.map((item) => (
                <li key={item.assignment_id} className="flex justify-between gap-2 py-2">
                  <span>
                    {item.form_title || item.form_id} · {item.site_name}
                  </span>
                  {item.submission_id ? (
                    <Link
                      to="/app/ssp/submissions/$submissionId"
                      params={{ submissionId: item.submission_id }}
                      className="underline"
                    >
                      {item.submitted_at ? new Date(item.submitted_at).toLocaleString("he-IL") : he.sspFillSubmitted}
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </ModuleScaffold>
    </div>
  );
}
