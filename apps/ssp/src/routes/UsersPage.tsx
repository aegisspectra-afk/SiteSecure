import { Button, ErrorState, Input, PageHeader } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { DataModeNote } from "../components/DataModeNote";
import { SspHubLinks } from "../components/SspHubLinks";
import { RequireSspAccess } from "../components/RequirePermission";
import { he } from "../i18n/he";
import { useOrg } from "../lib/org";
import { useSession } from "../lib/session";

export function UsersPage() {
  return (
    <RequireSspAccess anyOf={["ssp.sites.view", "ssp.forms.view", "ssp.officers.view"]}>
      <UsersBody />
    </RequireSspAccess>
  );
}

function UsersBody() {
  const { api, workspaceId } = useSession();
  const { sspCan, productRole } = useOrg();
  const isOfficer = productRole === "patrol_officer";
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["ssp-sites", workspaceId, "actors"],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspSites(workspaceId!, { kind: "office,ops_center" }),
    retry: false,
  });
  const create = useMutation({
    mutationFn: () => api.createSspSite(workspaceId!, { name: name.trim(), kind: "office" }),
    onSuccess: async () => {
      setName("");
      await qc.invalidateQueries({ queryKey: ["ssp-sites", workspaceId] });
    },
    onError: (e: unknown) => setMsg(e instanceof Error ? e.message : he.apiUnavailable),
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  return (
    <div className="flex flex-col gap-4" data-testid="ssp-users">
      <PageHeader title={he.navUsers} description={he.usersLead} />
      <SspHubLinks
        items={[
          { to: "/organization", label: he.navOrg },
          ...(sspCan("ssp.officers.view") ? [{ to: "/officers", label: he.navOfficers }] : []),
          { to: "/devices", label: he.navDevices },
          ...(!isOfficer ? [{ to: "/enrollments", label: he.navEnrollments }] : []),
        ]}
      />
      <p className="text-xs text-fg-muted">{he.actorNotPerson}</p>
      <DataModeNote mode={list.data?.data_mode} waitingDb={list.isError} />
      {sspCan("ssp.sites.edit") ? (
        <div className="flex flex-wrap items-end gap-2">
          <Input id="new-actor-name" label={he.name} value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="button" onClick={() => create.mutate()} disabled={create.isPending || !name.trim()}>
            {he.newActor}
          </Button>
        </div>
      ) : null}
      {msg ? <p className="text-sm text-danger">{msg}</p> : null}
      {list.isLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
      {!list.data?.items.length && !list.isLoading && !list.isError ? (
        <p className="text-sm text-fg-muted">{he.noActors}</p>
      ) : null}
      <ul className="divide-y divide-border rounded-lg border border-border text-sm">
        {(list.data?.items ?? []).map((site) => (
          <li key={site.id} className="flex justify-between gap-2 px-4 py-3">
            <Link to="/sites/$siteId" params={{ siteId: site.id }} className="font-medium underline">
              {site.name}
            </Link>
            <span className="text-xs text-fg-muted">
              {site.kind === "ops_center" ? he.siteKindOps : he.siteKindOffice}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
