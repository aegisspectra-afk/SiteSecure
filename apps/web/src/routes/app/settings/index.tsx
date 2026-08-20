import { Button, ErrorState, Input, PageHeader } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { ThemePicker } from "../../../components/ThemePicker";
import { he } from "../../../i18n/he";
import { ApiClientError } from "@site-secure/api-client";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/settings/")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <RequirePermission permission="workspace.edit">
      <SettingsBody />
    </RequirePermission>
  );
}

function SettingsBody() {
  const { session, api } = useSession();
  const workspaceId = session?.memberships[0]?.workspace_id;
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("Asia/Jerusalem");
  const [vat, setVat] = useState("18");
  const [formError, setFormError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["workspace", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getWorkspace(workspaceId!),
  });

  useEffect(() => {
    if (!query.data) return;
    setName(query.data.name);
    setTimezone(query.data.timezone || "Asia/Jerusalem");
    setVat(String(query.data.vat_percent ?? 18));
  }, [query.data]);

  const save = useMutation({
    mutationFn: () =>
      api.patchWorkspace(workspaceId!, {
        name: name.trim(),
        timezone,
        vat_percent: Number(vat),
      }),
    onSuccess: () => {
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] });
    },
    onError: (err) => {
      setFormError(err instanceof ApiClientError ? err.message : he.sessionError);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
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
    <div className="flex max-w-lg flex-col gap-8">
      <PageHeader title={he.settingsTitle} description={he.settingsLead} />
      <section className="ops-card flex flex-col gap-3 p-5">
        <p className="text-sm font-medium text-fg">{he.appearanceTitle}</p>
        <ThemePicker id="settings-theme" />
      </section>
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <Input id="ws-name" label={he.workspaceName} value={name} onChange={(ev) => setName(ev.target.value)} />
        <Input
          id="ws-timezone"
          label={he.timezone}
          value={timezone}
          onChange={(ev) => setTimezone(ev.target.value)}
          className="ltr-meta"
        />
        <Input
          id="ws-vat"
          label={he.vat}
          type="number"
          min={0}
          max={100}
          value={vat}
          onChange={(ev) => setVat(ev.target.value)}
          className="ltr-meta"
        />
        {formError ? (
          <p className="text-sm text-danger" role="alert">
            {formError}
          </p>
        ) : null}
        <Button type="submit" variant="primary" loading={save.isPending} className="self-start">
          {he.saveSettings}
        </Button>
      </form>
    </div>
  );
}
