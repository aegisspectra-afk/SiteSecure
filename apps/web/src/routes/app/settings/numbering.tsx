import { Button, ErrorState, Input, PageHeader } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import {
  DEFAULT_WORKSPACE_PREFS,
  prefsFromSettings,
  prefsToSettingsPatch,
  type WorkspacePrefs,
} from "../../../lib/workspace-prefs";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/settings/numbering")({
  component: NumberingPage,
});

function NumberingPage() {
  return (
    <RequirePermission permission="workspace.edit">
      <NumberingBody />
    </RequirePermission>
  );
}

function exampleNumber(prefix: string): string {
  const clean = prefix.trim() || "—";
  return `${clean}00001`;
}

function NumberingBody() {
  const { session, api } = useSession();
  const workspaceId = session?.memberships[0]?.workspace_id;
  const queryClient = useQueryClient();
  const [prefs, setPrefs] = useState<WorkspacePrefs>(DEFAULT_WORKSPACE_PREFS);
  const [baseline, setBaseline] = useState<WorkspacePrefs | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["workspace-settings", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getWorkspaceSettings(workspaceId!),
  });

  useEffect(() => {
    if (!query.data) return;
    const next = prefsFromSettings(query.data);
    setPrefs(next);
    setBaseline(next);
  }, [query.data]);

  const dirty = useMemo(() => {
    if (!baseline) return false;
    return (
      prefs.quotePrefix !== baseline.quotePrefix ||
      prefs.projectPrefix !== baseline.projectPrefix ||
      prefs.siteFilePrefix !== baseline.siteFilePrefix
    );
  }, [baseline, prefs]);

  const save = useMutation({
    mutationFn: () => api.patchWorkspaceSettings(workspaceId!, prefsToSettingsPatch(prefs)),
    onSuccess: async () => {
      setSaveError(null);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
      await queryClient.invalidateQueries({ queryKey: ["workspace-settings", workspaceId] });
      setBaseline(prefs);
    },
    onError: () => {
      setSaveError(he.settingsError);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    save.mutate();
  }

  if (!workspaceId) return <ErrorState title={he.sessionError} />;
  if (query.isLoading) return <p className="text-sm text-fg-muted">{he.loading}</p>;
  if (query.isError) return <ErrorState title={he.settingsError} />;

  return (
    <div className="settings-panel flex flex-col gap-6">
      <PageHeader title={he.settingsNavNumbering} description={he.settingsNumberingLead} />
      <p className="settings-section-lead">{he.settingsNumberingExampleHint}</p>
      <form className="settings-form" onSubmit={onSubmit}>
        <div className="settings-field-grid">
          <div className="settings-field-block">
            <Input
              id="prefix-quote"
              label={he.settingsPrefixQuotes}
              value={prefs.quotePrefix}
              onChange={(ev) => setPrefs({ ...prefs, quotePrefix: ev.target.value })}
              className="ltr-meta"
            />
            <p className="settings-field-hint ltr-meta">
              {he.settingsNumberingExample}: {exampleNumber(prefs.quotePrefix)}
            </p>
          </div>
          <div className="settings-field-block">
            <Input
              id="prefix-project"
              label={he.settingsPrefixProjects}
              value={prefs.projectPrefix}
              onChange={(ev) => setPrefs({ ...prefs, projectPrefix: ev.target.value })}
              className="ltr-meta"
            />
            <p className="settings-field-hint ltr-meta">
              {he.settingsNumberingExample}: {exampleNumber(prefs.projectPrefix)}
            </p>
          </div>
          <div className="settings-field-block">
            <Input
              id="prefix-site"
              label={he.settingsPrefixSiteFiles}
              value={prefs.siteFilePrefix}
              onChange={(ev) => setPrefs({ ...prefs, siteFilePrefix: ev.target.value })}
              className="ltr-meta"
            />
            <p className="settings-field-hint ltr-meta">
              {he.settingsNumberingExample}: {exampleNumber(prefs.siteFilePrefix)}
            </p>
          </div>
        </div>
        {saveError ? (
          <p className="text-sm text-danger" role="alert">
            {saveError}
          </p>
        ) : null}
        {saved ? (
          <p className="text-sm text-success" role="status">
            {he.settingsSaved}
          </p>
        ) : null}
        <Button
          type="submit"
          variant="primary"
          className="self-start"
          loading={save.isPending}
          disabled={!dirty}
          title={!dirty ? he.settingsSaveDisabled : undefined}
        >
          {he.saveSettings}
        </Button>
      </form>
    </div>
  );
}
