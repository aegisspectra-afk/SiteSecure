import { Button, ErrorState, PageHeader } from "@site-secure/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { FormFillFields } from "../components/FormFillFields";
import { he } from "../i18n/he";
import { createSspApi } from "../lib/api";
import { readDeviceSession } from "../lib/deviceSession";

const api = createSspApi();

export function FieldFormPage() {
  const { assignmentId } = useParams({ from: "/field/forms/$assignmentId" });
  const stored = readDeviceSession();
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const detail = useQuery({
    queryKey: ["ssp-device-assignment", stored?.device_token, assignmentId],
    enabled: Boolean(stored?.device_token),
    queryFn: () => api.getSspSiteDeviceAssignment(stored!.device_token, assignmentId),
    retry: false,
  });
  const submit = useMutation({
    mutationFn: () =>
      api.submitSspSiteDeviceAssignment(stored!.device_token, assignmentId, { answers }),
    onSuccess: (row) => {
      setDone(true);
      setMsg(`${he.submittedOk}${row.submitted_at ? ` · ${row.submitted_at}` : ""}`);
    },
    onError: (e: unknown) => setMsg(e instanceof Error ? e.message : he.apiUnavailable),
  });

  if (!stored) return <Navigate to="/activate" />;
  if (detail.isLoading) return <p className="p-6 text-sm text-fg-muted">{he.loading}</p>;
  if (detail.isError || !detail.data) {
    return (
      <main className="mx-auto max-w-md px-4 py-8">
        <ErrorState title={he.apiUnavailable} />
        <Link to="/field">{he.fieldHome}</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-4 py-6" data-testid="ssp-field-form">
      <PageHeader
        title={detail.data.form.title}
        description={`${detail.data.site.name}${detail.data.assignment.due_at ? ` · ${he.sspDueDate} ${detail.data.assignment.due_at.slice(0, 10)}` : ""}`}
      />
      {detail.data.form.description ? (
        <p className="text-sm text-fg-muted">{detail.data.form.description}</p>
      ) : null}
      <FormFillFields
        fields={detail.data.definition.fields ?? []}
        answers={answers}
        onChange={(id, value) => setAnswers((prev) => ({ ...prev, [id]: value }))}
      />
      {msg ? <p className="text-sm text-fg-muted">{msg}</p> : null}
      <Button type="button" onClick={() => submit.mutate()} disabled={submit.isPending || done}>
        {he.officerSubmit}
      </Button>
      <Link to="/field" className="text-sm text-fg-muted underline">
        {he.fieldHome}
      </Link>
    </main>
  );
}
