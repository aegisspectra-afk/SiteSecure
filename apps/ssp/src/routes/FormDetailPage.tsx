import type { SspFieldType, SspFormDefinition, SspFormField } from "@site-secure/api-client";
import { Button, ErrorState, Input, PageHeader, Textarea } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FormFillFields } from "../components/FormFillFields";
import { FormSiteAssignPanel } from "../components/FormSiteAssignPanel";
import { Forbidden } from "../components/RequirePermission";
import { he } from "../i18n/he";
import { publicAssignmentUrl } from "../lib/env";
import { useOrg } from "../lib/org";
import { useSession } from "../lib/session";

const FIELD_TYPES: Array<{ type: SspFieldType; label: string }> = [
  { type: "short_text", label: he.sspFieldShortText },
  { type: "long_text", label: he.sspFieldLongText },
  { type: "notes", label: he.sspFieldNotes },
  { type: "number", label: he.sspFieldNumber },
  { type: "date", label: he.sspFieldDate },
  { type: "time", label: he.sspFieldTime },
  { type: "single_choice", label: he.sspFieldSingle },
  { type: "multi_choice", label: he.sspFieldMulti },
  { type: "yes_no", label: he.sspFieldYesNo },
  { type: "consent", label: he.sspFieldConsent },
];

function newId() {
  return crypto.randomUUID();
}

function emptyField(type: SspFieldType): SspFormField {
  const base: SspFormField = {
    id: newId(),
    type,
    label: "",
    help_text: "",
    required: type === "consent",
  };
  if (type === "single_choice" || type === "multi_choice") {
    base.options = [
      { id: newId(), label: "אפשרות 1" },
      { id: newId(), label: "אפשרות 2" },
    ];
  }
  if (type === "consent") {
    base.consent_wording = "אני מאשר/ת את השימוש בפרטים שמסרתי לצורך תהליך הגיוס.";
    base.label = "הסכמה";
  }
  return base;
}

export function FormDetailPage() {
  const { formId } = useParams({ from: "/authenticated/forms/$formId" });
  const { api, workspaceId } = useSession();
  const { sspCan, productRole } = useOrg();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [fields, setFields] = useState<SspFormField[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [preview, setPreview] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [maxSubmissions, setMaxSubmissions] = useState("1");
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});

  const detail = useQuery({
    queryKey: ["ssp-form", workspaceId, formId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getSspForm(workspaceId!, formId),
  });

  const assignments = useQuery({
    queryKey: ["ssp-assignments", workspaceId, formId],
    enabled: Boolean(workspaceId) && sspCan("ssp.assignments.manage"),
    queryFn: () => api.listSspAssignments(workspaceId!, formId),
  });

  useEffect(() => {
    if (!detail.data) return;
    setTitle(detail.data.form.title);
    setDescription(detail.data.form.description || "");
    setCategory(detail.data.form.category || "");
    const def =
      detail.data.draft_version?.definition ??
      detail.data.latest_published?.definition ??
      ({ fields: [] } as SspFormDefinition);
    setFields(def.fields ?? []);
  }, [detail.data]);

  const canEdit = sspCan("ssp.forms.edit");
  const canPublish = sspCan("ssp.forms.publish");
  const canAssign = sspCan("ssp.assignments.manage");
  const isOfficer = productRole === "patrol_officer";
  const archived = detail.data?.form.status === "archived";

  const officerSubmit = useMutation({
    mutationFn: () => api.officerSubmitSspForm(workspaceId!, formId, { answers }),
    onSuccess: async () => {
      setMessage(he.officerSubmit);
      await queryClient.invalidateQueries({ queryKey: ["ssp-submissions", workspaceId] });
    },
    onError: (e: unknown) => setMessage(e instanceof Error ? e.message : he.apiUnavailable),
  });

  const saveMeta = useMutation({
    mutationFn: () => api.patchSspForm(workspaceId!, formId, { title, description, category: category.trim() || null }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ssp-form", workspaceId, formId] });
      setMessage("נשמר");
    },
  });

  const saveDefinition = useMutation({
    mutationFn: () => api.putSspFormDefinition(workspaceId!, formId, { fields }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ssp-form", workspaceId, formId] });
      setMessage(he.sspSaveDefinition);
    },
    onError: (e: unknown) => setMessage(e instanceof Error ? e.message : he.apiUnavailable),
  });

  const publish = useMutation({
    mutationFn: async () => {
      await api.putSspFormDefinition(workspaceId!, formId, { fields });
      return api.publishSspForm(workspaceId!, formId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ssp-form", workspaceId, formId] });
      await queryClient.invalidateQueries({ queryKey: ["ssp-forms", workspaceId] });
      setMessage(he.sspPublish);
    },
    onError: (e: unknown) => setMessage(e instanceof Error ? e.message : he.apiUnavailable),
  });

  const archive = useMutation({
    mutationFn: () => api.archiveSspForm(workspaceId!, formId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ssp-form", workspaceId, formId] });
      await queryClient.invalidateQueries({ queryKey: ["ssp-forms", workspaceId] });
    },
  });

  const duplicate = useMutation({
    mutationFn: () => api.duplicateSspForm(workspaceId!, formId),
    onSuccess: async (form) => {
      await queryClient.invalidateQueries({ queryKey: ["ssp-forms", workspaceId] });
      void navigate({ to: "/forms/$formId", params: { formId: form.id } });
    },
  });

  const createAssignment = useMutation({
    mutationFn: () =>
      api.createSspAssignment(workspaceId!, formId, {
        label: "טאבלט מועמדים",
        access_code: accessCode.trim() || undefined,
        max_submissions: maxSubmissions ? Number(maxSubmissions) : undefined,
      }),
    onSuccess: async (row) => {
      setCreatedLink(publicAssignmentUrl(row.public_path));
      setAccessCode("");
      await queryClient.invalidateQueries({ queryKey: ["ssp-assignments", workspaceId, formId] });
    },
    onError: (e: unknown) => setMessage(e instanceof Error ? e.message : he.apiUnavailable),
  });

  const revoke = useMutation({
    mutationFn: (assignmentId: string) => api.revokeSspAssignment(workspaceId!, assignmentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ssp-assignments", workspaceId, formId] });
    },
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

  // Direct URL to editor: officers never get create/edit/publish UI (server also denies).
  if (isOfficer && !canEdit) {
    const publishedFields =
      detail.data.latest_published?.definition?.fields ??
      detail.data.draft_version?.definition?.fields ??
      [];
    if (detail.data.form.status !== "published") {
      return <Forbidden />;
    }
    return (
      <div className="flex flex-col gap-4" data-testid="ssp-officer-fill">
        <PageHeader title={detail.data.form.title} description={he.officerNoEdit} />
        {message ? <p className="text-sm text-fg-muted">{message}</p> : null}
        <FormFillFields
          fields={publishedFields}
          answers={answers}
          onChange={(id, value) => setAnswers((a) => ({ ...a, [id]: value }))}
        />
        <Button type="button" onClick={() => officerSubmit.mutate()} disabled={officerSubmit.isPending}>
          {he.officerSubmit}
        </Button>
      </div>
    );
  }

  function updateField(id: string, patch: Partial<SspFormField>) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function moveField(index: number, dir: -1 | 1) {
    setFields((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      const tmp = next[index];
      next[index] = next[j];
      next[j] = tmp;
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-6" data-testid="ssp-form-detail">
      <PageHeader
        title={detail.data.form.title}
        description={`${detail.data.form.status} · v${detail.data.form.latest_published_version ?? "—"}`}
        action={
          <div className="flex flex-wrap gap-2">
            {canEdit && !archived ? (
              <Button type="button" variant="secondary" onClick={() => saveMeta.mutate()}>
                {he.save}
              </Button>
            ) : null}
            {canEdit && !archived ? (
              <Button type="button" variant="secondary" onClick={() => saveDefinition.mutate()}>
                {he.sspSaveDefinition}
              </Button>
            ) : null}
            {canPublish && !archived ? (
              <Button
                type="button"
                onClick={() => {
                  if (!window.confirm(he.sspConfirmPublish)) return;
                  publish.mutate();
                }}
              >
                {he.sspPublish}
              </Button>
            ) : null}
            {canEdit ? (
              <Button type="button" variant="secondary" onClick={() => duplicate.mutate()}>
                {he.sspDuplicate}
              </Button>
            ) : null}
            {canEdit && !archived ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  if (!window.confirm(he.sspConfirmArchive)) return;
                  archive.mutate();
                }}
              >
                {he.sspArchive}
              </Button>
            ) : null}
            <Button type="button" variant="secondary" onClick={() => setPreview((v) => !v)}>
              {preview ? he.sspHidePreview : he.sspPreview}
            </Button>
          </div>
        }
      />
      {message ? <p className="text-sm text-fg-muted">{message}</p> : null}

      <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <Input
          id="ssp-title"
          label={he.name}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={!canEdit || archived}
        />
        <Textarea
          id="ssp-desc"
          label="תיאור"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={!canEdit || archived}
          rows={2}
        />
        <Input
          id="ssp-category"
          label={he.sspCategory}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          disabled={!canEdit || archived}
        />
      </section>

      {preview ? (
        <section className="flex flex-col gap-3 rounded-lg border border-border p-4" data-testid="ssp-form-preview">
          <h2 className="text-base font-semibold">{he.sspPreview}</h2>
          <FormFillFields fields={fields} answers={answers} onChange={() => undefined} disabled />
        </section>
      ) : null}

      <section className="flex flex-col gap-2 rounded-lg border border-border p-4">
        <h2 className="text-base font-semibold">{he.sspVersions}</h2>
        {!detail.data.versions.length ? (
          <p className="text-sm text-fg-muted">{he.noItems}</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {detail.data.versions.map((v) => (
              <li key={v.id} className="flex justify-between gap-2 py-2">
                <span>
                  v{v.version} · {v.status === "published" ? he.sspStatusPublished : he.sspStatusDraft}
                </span>
                <span className="text-xs text-fg-muted">{v.published_at || v.created_at}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{he.sspForms}</h2>
          {canEdit && !archived ? (
            <div className="flex flex-wrap gap-2">
              {FIELD_TYPES.map((ft) => (
                <Button
                  key={ft.type}
                  type="button"
                  variant="secondary"
                  onClick={() => setFields((prev) => [...prev, emptyField(ft.type)])}
                >
                  {he.sspAddField}: {ft.label}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
        {fields.map((field, index) => (
          <div key={field.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-2 text-xs text-fg-muted">
              <span>
                #{index + 1} · {FIELD_TYPES.find((t) => t.type === field.type)?.label ?? field.type}
              </span>
              {canEdit && !archived ? (
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" onClick={() => moveField(index, -1)}>
                    {he.sspMoveUp}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => moveField(index, 1)}>
                    {he.sspMoveDown}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setFields((prev) => prev.filter((f) => f.id !== field.id))}
                  >
                    מחיקה
                  </Button>
                </div>
              ) : null}
            </div>
            <Input
              id={`label-${field.id}`}
              label="שאלה"
              value={field.label}
              onChange={(e) => updateField(field.id, { label: e.target.value })}
              disabled={!canEdit || archived}
            />
            <Input
              id={`help-${field.id}`}
              label={he.sspHelpText}
              value={field.help_text ?? ""}
              onChange={(e) => updateField(field.id, { help_text: e.target.value })}
              disabled={!canEdit || archived}
            />
            {field.type === "consent" ? (
              <Textarea
                id={`consent-${field.id}`}
                label={he.sspConsentWording}
                value={field.consent_wording ?? ""}
                onChange={(e) => updateField(field.id, { consent_wording: e.target.value })}
                disabled={!canEdit || archived}
                rows={3}
              />
            ) : null}
            {(field.type === "single_choice" || field.type === "multi_choice") && (
              <div className="flex flex-col gap-2">
                {(field.options ?? []).map((opt, oidx) => (
                  <Input
                    key={opt.id}
                    id={`opt-${opt.id}`}
                    label={`אפשרות ${oidx + 1}`}
                    value={opt.label}
                    disabled={!canEdit || archived}
                    onChange={(e) => {
                      const options = [...(field.options ?? [])];
                      options[oidx] = { ...opt, label: e.target.value };
                      updateField(field.id, { options });
                    }}
                  />
                ))}
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={field.required}
                disabled={!canEdit || archived}
                onChange={(e) => updateField(field.id, { required: e.target.checked })}
              />
              {he.sspRequired}
            </label>
          </div>
        ))}
        {!fields.length ? <p className="text-sm text-fg-muted">{he.sspAddField}</p> : null}
      </section>

      {canAssign && !archived ? (
        <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <h2 className="text-base font-semibold">{he.sspCreateAssignment}</h2>
          <Input
            id="ssp-access-code"
            label={he.sspAccessCode}
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            hint="אופציונלי · לפחות 4 תווים"
          />
          <Input
            id="ssp-max-sub"
            label={he.sspMaxSubmissions}
            value={maxSubmissions}
            onChange={(e) => setMaxSubmissions(e.target.value)}
          />
          <Button
            type="button"
            onClick={() => createAssignment.mutate()}
            disabled={createAssignment.isPending || !detail.data.form.latest_published_version}
          >
            {he.sspCreateAssignment}
          </Button>
          {!detail.data.form.latest_published_version ? (
            <p className="text-xs text-fg-muted">יש לפרסם את הטופס לפני יצירת קישור.</p>
          ) : null}
          {createdLink ? (
            <div className="break-all rounded-md bg-bg-subtle p-3 text-sm" data-testid="ssp-public-link">
              <div className="mb-1 font-medium">{he.sspPublicLink}</div>
              <code>{createdLink}</code>
              <div className="mt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void navigator.clipboard.writeText(createdLink)}
                >
                  {he.sspCopyLink}
                </Button>
              </div>
            </div>
          ) : null}
          <ul className="divide-y divide-border rounded-md border border-border">
            {(assignments.data?.items ?? []).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <div>
                  {a.label || a.id.slice(0, 8)} · {a.status} · {a.submission_count}
                  {a.max_submissions != null ? `/${a.max_submissions}` : ""}
                </div>
                {a.status === "active" ? (
                  <Button type="button" variant="secondary" onClick={() => revoke.mutate(a.id)}>
                    {he.sspRevokeAssignment}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canAssign && !archived ? (
        <FormSiteAssignPanel
          formId={formId}
          published={Boolean(detail.data.form.latest_published_version)}
        />
      ) : null}
    </div>
  );
}
