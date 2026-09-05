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

export const Route = createFileRoute("/app/settings/quotes")({
  component: QuotesSettingsPage,
});

function QuotesSettingsPage() {
  return (
    <RequirePermission permission="workspace.edit">
      <QuotesSettingsBody />
    </RequirePermission>
  );
}

function QuotesSettingsBody() {
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
      <PageHeader title={he.settingsNavQuotes} description={he.settingsQuotesLead} />
      <form
        className="settings-form"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="settings-field-grid">
          <Input
            id="quote-validity"
            label={he.settingsQuoteValidity}
            type="number"
            min={1}
            max={365}
            value={String(prefs.quoteValidityDays)}
            onChange={(ev) => setPrefs({ ...prefs, quoteValidityDays: Number(ev.target.value) || 14 })}
            className="ltr-meta"
          />
          <Input
            id="quote-payment"
            label={he.settingsPaymentTerms}
            value={prefs.paymentTerms}
            onChange={(ev) => setPrefs({ ...prefs, paymentTerms: ev.target.value })}
          />
        </div>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={prefs.showVatOnQuotes}
            onChange={(ev) => setPrefs({ ...prefs, showVatOnQuotes: ev.target.checked })}
          />
          <span>{he.settingsShowVat}</span>
        </label>
        <label className="settings-field-block">
          <span className="settings-field-label">{he.settingsPdfNotes}</span>
          <textarea
            className="settings-textarea"
            rows={4}
            value={prefs.pdfNotes}
            onChange={(ev) => setPrefs({ ...prefs, pdfNotes: ev.target.value })}
          />
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
