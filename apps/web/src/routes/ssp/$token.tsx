import {
  createApiClient,
  type SspFormField,
  type SspPublicFormOut,
} from "@site-secure/api-client";
import { Button, Input, Textarea } from "@site-secure/ui";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { he } from "../../i18n/he";

export const Route = createFileRoute("/ssp/$token")({
  component: SspTabletPage,
});

function publicApi() {
  const fromEnv = ((import.meta.env.VITE_API_URL as string | undefined) ?? "").trim().replace(/\/$/, "");
  const onVercel = Boolean(import.meta.env.VERCEL);
  if (!fromEnv && !onVercel) {
    return createApiClient({
      baseUrl: "",
      sameOriginProxy: true,
      getAccessToken: async () => null,
    });
  }
  return createApiClient({
    baseUrl: fromEnv,
    sameOriginProxy: false,
    getAccessToken: async () => null,
  });
}

function SspTabletPage() {
  const { token } = Route.useParams();
  const api = useMemo(() => publicApi(), []);
  const [phase, setPhase] = useState<"loading" | "code" | "form" | "done" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [form, setForm] = useState<SspPublicFormOut | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const peek = await api.peekSspAssignment(token);
        if (cancelled) return;
        if (peek.requires_access_code) {
          setPhase("code");
          return;
        }
        if (peek.definition) {
          setForm({
            form_title: peek.form_title,
            form_description: peek.form_description,
            version: peek.version || 1,
            definition: peek.definition,
            require_account: Boolean(peek.require_account),
          });
          setPhase("form");
          return;
        }
        setPhase("error");
        setError(he.apiUnavailable);
      } catch (e) {
        if (cancelled) return;
        setPhase("error");
        setError(e instanceof Error ? e.message : he.apiUnavailable);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, token]);

  async function unlock() {
    setError(null);
    try {
      const unlocked = await api.unlockSspAssignment(token, code);
      setForm(unlocked);
      setPhase("form");
    } catch (e) {
      setError(e instanceof Error ? e.message : he.sspSubmitFail);
    }
  }

  async function submit() {
    if (!form) return;
    setSubmitting(true);
    setError(null);
    try {
      const idem =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}`;
      const result = await api.submitSspAssignment(token, {
        access_code: code || undefined,
        answers,
        idempotency_key: idem,
      });
      setSubmittedAt(result.submitted_at);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : he.sspSubmitFail);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-bg px-4 py-8 text-fg" dir="rtl" lang="he" data-testid="ssp-tablet">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
        <header className="flex flex-col gap-1">
          <p className="text-sm text-fg-muted">{he.sspTabletTitle}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{form?.form_title || he.sspTitle}</h1>
          {form?.form_description ? (
            <p className="text-sm text-fg-muted">{form.form_description}</p>
          ) : null}
        </header>

        {phase === "loading" ? <p className="text-sm text-fg-muted">…</p> : null}

        {phase === "code" ? (
          <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
            <Input
              id="tablet-code"
              label={he.sspEnterCode}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
            />
            <Button type="button" className="min-h-12 text-base" onClick={() => void unlock()}>
              {he.sspUnlock}
            </Button>
          </div>
        ) : null}

        {phase === "form" && form ? (
          <div className="flex flex-col gap-5">
            {(form.definition.fields ?? []).map((field) => (
              <TabletField
                key={field.id}
                field={field}
                value={answers[field.id]}
                onChange={(value) => setAnswers((prev) => ({ ...prev, [field.id]: value }))}
              />
            ))}
            <Button
              type="button"
              className="min-h-12 text-base"
              loading={submitting}
              onClick={() => void submit()}
            >
              {he.sspSubmit}
            </Button>
          </div>
        ) : null}

        {phase === "done" ? (
          <div className="rounded-xl border border-border bg-bg-subtle p-6 text-center" role="status">
            <p className="text-lg font-semibold">{he.sspSubmitSuccess}</p>
            {submittedAt ? (
              <p className="mt-2 text-sm text-fg-muted">
                {he.sspSubmittedAt}: {new Date(submittedAt).toLocaleString("he-IL")}
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function TabletField({
  field,
  value,
  onChange,
}: {
  field: SspFormField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (field.type === "long_text") {
    return (
      <Textarea
        id={field.id}
        label={`${field.label}${field.required ? " *" : ""}`}
        hint={field.help_text}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
      />
    );
  }
  if (field.type === "yes_no") {
    return (
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">
          {field.label}
          {field.required ? " *" : ""}
        </legend>
        <div className="flex gap-3">
          <Button
            type="button"
            variant={value === true ? "primary" : "secondary"}
            className="min-h-12 flex-1"
            onClick={() => onChange(true)}
          >
            כן
          </Button>
          <Button
            type="button"
            variant={value === false ? "primary" : "secondary"}
            className="min-h-12 flex-1"
            onClick={() => onChange(false)}
          >
            לא
          </Button>
        </div>
      </fieldset>
    );
  }
  if (field.type === "single_choice") {
    return (
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">
          {field.label}
          {field.required ? " *" : ""}
        </legend>
        {(field.options ?? []).map((opt) => (
          <label key={opt.id} className="flex min-h-12 items-center gap-3 rounded-lg border border-border px-3">
            <input
              type="radio"
              name={field.id}
              checked={value === opt.id}
              onChange={() => onChange(opt.id)}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </fieldset>
    );
  }
  if (field.type === "multi_choice") {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">
          {field.label}
          {field.required ? " *" : ""}
        </legend>
        {(field.options ?? []).map((opt) => {
          const checked = selected.includes(opt.id);
          return (
            <label key={opt.id} className="flex min-h-12 items-center gap-3 rounded-lg border border-border px-3">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  onChange(checked ? selected.filter((id) => id !== opt.id) : [...selected, opt.id]);
                }}
              />
              <span>{opt.label}</span>
            </label>
          );
        })}
      </fieldset>
    );
  }
  if (field.type === "consent") {
    return (
      <label className="flex min-h-14 items-start gap-3 rounded-lg border border-border p-3 text-sm">
        <input
          type="checkbox"
          className="mt-1 size-5"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{field.consent_wording || field.label}</span>
      </label>
    );
  }
  if (field.type === "date") {
    return (
      <Input
        id={field.id}
        type="date"
        label={`${field.label}${field.required ? " *" : ""}`}
        hint={field.help_text}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <Input
      id={field.id}
      label={`${field.label}${field.required ? " *" : ""}`}
      hint={field.help_text}
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
