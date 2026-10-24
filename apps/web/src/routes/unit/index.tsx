import { Button, Card, LoadingBlock } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ErrorState, ModuleScaffold } from "../../components/modules/ModuleKit";
import { SspFormFields } from "../../components/ssp/SspFormFields";
import { ApiClientError } from "@site-secure/api-client";
import { he } from "../../i18n/he";
import { useSession } from "../../lib/session";
import { clearUnitSession, loadUnitSession } from "../../lib/unit-session";

export const Route = createFileRoute("/unit/")({
  component: UnitFormsPage,
});

function UnitFormsPage() {
  const { api } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const stored = loadUnitSession();
  const [fillId, setFillId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const inbox = useQuery({
    queryKey: ["ssp-unit-forms", stored?.siteId],
    enabled: Boolean(stored?.token),
    queryFn: () => api.listSspUnitForms(stored!.token),
    retry: false,
  });
  const fillDetail = useQuery({
    queryKey: ["ssp-unit-assignment", fillId],
    enabled: Boolean(stored?.token && fillId),
    queryFn: () => api.getSspUnitAssignment(stored!.token, fillId!),
    retry: false,
  });
  const submit = useMutation({
    mutationFn: () => api.submitSspUnitAssignment(stored!.token, fillId!, { answers }),
    onSuccess: async () => {
      setMsg(he.sspSubmitSuccess);
      setFillId(null);
      setAnswers({});
      await qc.invalidateQueries({ queryKey: ["ssp-unit-forms"] });
    },
    onError: (e: unknown) => setMsg(e instanceof Error ? e.message : he.sspSubmitFail),
  });

  if (inbox.isError) {
    const status = inbox.error instanceof ApiClientError ? inbox.error.status : 0;
    if (status === 401) {
      clearUnitSession();
      void navigate({ to: "/login" });
    }
  }

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
  const pending = items.filter(
    (i) => i.fill_status === "available" || i.fill_status === "overdue" || i.fill_status === "upcoming",
  );
  const submitted = items.filter((i) => i.fill_status === "submitted" || i.submission_id);

  return (
    <div data-testid="ssp-unit-forms">
      <ModuleScaffold title={he.sspNavMyForms} lead={he.sspUnitFormsLead}>
        {msg ? <p className="text-sm text-fg-muted">{msg}</p> : null}
        {fillId ? (
          <Card className="flex flex-col gap-3" data-testid="ssp-unit-form-fill">
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
                <li key={item.assignment_id} className="flex items-center justify-between gap-2">
                  <span>{item.form_title || item.assignment_id}</span>
                  <Button type="button" onClick={() => setFillId(item.assignment_id)}>
                    {he.sspOpenForm}
                  </Button>
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
            <ul className="flex flex-col gap-2">
              {submitted.map((item) => (
                <li key={item.assignment_id}>{item.form_title || item.assignment_id}</li>
              ))}
            </ul>
          )}
        </Card>
      </ModuleScaffold>
    </div>
  );
}
