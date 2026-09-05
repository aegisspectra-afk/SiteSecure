import { Button, ErrorState, Input, PageHeader } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
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

function NumberingBody() {
  const { session, api } = useSession();
  const workspaceId = session?.memberships[0]?.workspace_id;
  const queryClient = useQueryClient();
  const [prefs, setPrefs] = useState<WorkspacePrefs>(DEFAULT_WORKSPACE_PREFS);
  const [saved, setSaved] = useState(false);

  const query = useQuery({
    queryKey: ["workspace-settings", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getWorkspaceSettings(workspaceId!),
  });

  useEffect(() => {
    if (query.data) setPrefs(prefsFromSettings(query.data));
  }, [query.data]);

  const save = useMutation({
    mutationFn: () => api.patchWorkspaceSettings(workspaceId!, prefsToSettingsPatch(prefs)),
    onSuccess: async () => {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
      await queryClient.invalidateQueries({ queryKey: ["workspace-settings", workspaceId] });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  if (!workspaceId) return <ErrorState title={he.sessionError} />;
  if (query.isLoading) return <p className="text-sm text-fg-muted">{he.loading}</p>;
  if (query.isError) return <ErrorState title={he.settingsError} />;

  return (
    <div className="settings-panel flex flex-col gap-6">
      <PageHeader title={he.settingsNavNumbering} description={he.settingsNumberingLead} />
      <form className="settings-form" onSubmit={onSubmit}>
        <div className="settings-field-grid">
          <Input
            id="prefix-quote"
            label={he.settingsPrefixQuotes}
            value={prefs.quotePrefix}
            onChange={(ev) => setPrefs({ ...prefs, quotePrefix: ev.target.value })}
            className="ltr-meta"
          />
          <Input
            id="prefix-project"
            label={he.settingsPrefixProjects}
            value={prefs.projectPrefix}
            onChange={(ev) => setPrefs({ ...prefs, projectPrefix: ev.target.value })}
            className="ltr-meta"
          />
          <Input
            id="prefix-site"
            label={he.settingsPrefixSiteFiles}
            value={prefs.siteFilePrefix}
            onChange={(ev) => setPrefs({ ...prefs, siteFilePrefix: ev.target.value })}
            className="ltr-meta"
          />
        </div>
        {saved ? (
          <p className="text-sm text-success" role="status">
            {he.settingsSaved}
          </p>
        ) : null}
        <Button type="submit" variant="primary" className="self-start" loading={save.isPending}>
          {he.saveSettings}
        </Button>
      </form>
    </div>
  );
}
