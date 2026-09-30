import { Button, ErrorState, Input, PageHeader } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { ApiClientError } from "@site-secure/api-client";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/settings/general")({
  component: GeneralSettingsPage,
});

function GeneralSettingsPage() {
  return (
    <RequirePermission permission="workspace.edit">
      <GeneralSettingsBody />
    </RequirePermission>
  );
}

type Draft = { name: string; timezone: string; vat: string };

function GeneralSettingsBody() {
  const { session, api } = useSession();
  const workspaceId = session?.memberships[0]?.workspace_id;
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>({ name: "", timezone: "Asia/Jerusalem", vat: "18" });
  const [baseline, setBaseline] = useState<Draft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const query = useQuery({
    queryKey: ["workspace", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getWorkspace(workspaceId!),
  });

  useEffect(() => {
    if (!query.data) return;
    const next: Draft = {
      name: query.data.name,
      timezone: query.data.timezone || "Asia/Jerusalem",
      vat: String(query.data.vat_percent ?? 18),
    };
    setDraft(next);
    setBaseline(next);
  }, [query.data]);

  const dirty = useMemo(() => {
    if (!baseline) return false;
    return (
      draft.name.trim() !== baseline.name.trim() ||
      draft.timezone.trim() !== baseline.timezone.trim() ||
      Number(draft.vat) !== Number(baseline.vat)
    );
  }, [baseline, draft]);

  const vatInvalid = Number.isNaN(Number(draft.vat)) || Number(draft.vat) < 0 || Number(draft.vat) > 100;

  const save = useMutation({
    mutationFn: () =>
      api.patchWorkspace(workspaceId!, {
        name: draft.name.trim(),
        timezone: draft.timezone.trim(),
        vat_percent: Number(draft.vat),
      }),
    onSuccess: (data) => {
      setFormError(null);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1800);
      const next: Draft = {
        name: data.name,
        timezone: data.timezone || "Asia/Jerusalem",
        vat: String(data.vat_percent ?? 18),
      };
      setDraft(next);
      setBaseline(next);
      void queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] });
    },
    onError: (err) => {
      setFormError(err instanceof ApiClientError ? err.message : he.sessionError);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.name.trim() || vatInvalid || !dirty) return;
    save.mutate();
  }

  if (!workspaceId) return <ErrorState title={he.sessionError} />;
  if (query.isLoading) return <p className="text-sm text-fg-muted">{he.loading}</p>;
  if (query.isError || !query.data) {
    return (
      <ErrorState
        title={he.settingsError}
        action={
          <Button variant="secondary" onClick={() => void query.refetch()}>
            {he.retry}
          </Button>
        }
      />
    );
  }

  return (
    <div className="settings-panel flex flex-col gap-6">
      <PageHeader title={he.settingsNavGeneral} description={he.settingsGeneralLead} />

      <form className="settings-form" onSubmit={onSubmit}>
        <section className="settings-section" aria-labelledby="settings-workspace-heading">
          <h2 id="settings-workspace-heading" className="settings-section-title">
            {he.settingsGeneralWorkspaceSection}
          </h2>
          <p className="settings-section-lead">{he.settingsGeneralWorkspaceLead}</p>
          <div className="settings-field-grid">
            <Input
              id="ws-name"
              label={he.workspaceName}
              value={draft.name}
              onChange={(ev) => setDraft((d) => ({ ...d, name: ev.target.value }))}
            />
            <Input
              id="ws-timezone"
              label={he.timezone}
              value={draft.timezone}
              onChange={(ev) => setDraft((d) => ({ ...d, timezone: ev.target.value }))}
              className="ltr-meta"
            />
          </div>
        </section>

        <section className="settings-section" aria-labelledby="settings-finance-heading">
          <h2 id="settings-finance-heading" className="settings-section-title">
            {he.settingsGeneralFinanceSection}
          </h2>
          <p className="settings-section-lead">{he.settingsGeneralFinanceLead}</p>
          <div className="settings-field-grid">
            <Input
              id="ws-vat"
              label={he.vat}
              type="number"
              min={0}
              max={100}
              value={draft.vat}
              onChange={(ev) => setDraft((d) => ({ ...d, vat: ev.target.value }))}
              className="ltr-meta"
            />
            <div className="settings-locked-field">
              <span className="settings-field-label">{he.currencyLabel}</span>
              <p className="settings-locked-value ltr-meta" title={he.currencyLockedHint}>
                ₪ · ILS
              </p>
              <p className="settings-field-hint">{he.currencyLockedHint}</p>
            </div>
          </div>
        </section>

        {formError ? (
          <p className="text-sm text-danger" role="alert">
            {formError}
          </p>
        ) : null}
        {vatInvalid ? (
          <p className="text-sm text-danger" role="alert">
            {he.vat}
          </p>
        ) : null}
        {savedFlash ? (
          <p className="text-sm text-success" role="status">
            {he.settingsSaved}
          </p>
        ) : null}
        <div className="settings-form-actions">
          <Button
            type="submit"
            variant="primary"
            className="settings-save-cta"
            loading={save.isPending}
            disabled={!dirty || vatInvalid || !draft.name.trim()}
            title={!dirty ? he.settingsSaveDisabled : undefined}
          >
            {he.saveSettings}
          </Button>
          <Link to="/app/settings/company" className="ops-section-link self-center">
            {he.settingsCompanyVsGeneralHint}
          </Link>
        </div>
      </form>
    </div>
  );
}
