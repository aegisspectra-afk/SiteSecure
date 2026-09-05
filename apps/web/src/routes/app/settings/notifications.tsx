import { Button, ErrorState, PageHeader } from "@site-secure/ui";
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

export const Route = createFileRoute("/app/settings/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  return (
    <RequirePermission permission="workspace.edit">
      <NotificationsBody />
    </RequirePermission>
  );
}

function NotificationsBody() {
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

  if (!workspaceId) return <ErrorState title={he.sessionError} />;
  if (query.isLoading) return <p className="text-sm text-fg-muted">{he.loading}</p>;
  if (query.isError) return <ErrorState title={he.settingsError} />;

  return (
    <div className="settings-panel flex flex-col gap-6">
      <PageHeader title={he.settingsNavNotifications} description={he.settingsNotificationsLead} />
      <form
        className="settings-form"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={prefs.notifyQuoteViewed}
            onChange={(ev) => setPrefs({ ...prefs, notifyQuoteViewed: ev.target.checked })}
          />
          <span>{he.settingsNotifyQuoteViewed}</span>
        </label>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={prefs.notifyQuoteApproved}
            onChange={(ev) => setPrefs({ ...prefs, notifyQuoteApproved: ev.target.checked })}
          />
          <span>{he.settingsNotifyQuoteApproved}</span>
        </label>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={prefs.notifyJobOverdue}
            onChange={(ev) => setPrefs({ ...prefs, notifyJobOverdue: ev.target.checked })}
          />
          <span>{he.settingsNotifyJobOverdue}</span>
        </label>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={prefs.notifyTeamInvite}
            onChange={(ev) => setPrefs({ ...prefs, notifyTeamInvite: ev.target.checked })}
          />
          <span>{he.settingsNotifyTeamInvite}</span>
        </label>
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
