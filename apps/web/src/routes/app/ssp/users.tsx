import { Button, Input, Select, Textarea } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  CreatePanel,
  EmptyRows,
  ErrorState,
  ModuleScaffold,
  SearchCreateBar,
  SimpleEntityTable,
} from "../../../components/modules/ModuleKit";
import { SspHubLinks } from "../../../components/ssp/SspHubLinks";
import { useSspWorkspace } from "../../../components/ssp/useSspWorkspace";
import { he } from "../../../i18n/he";

export const Route = createFileRoute("/app/ssp/users")({
  component: SspUsersPage,
});

function kindLabel(kind?: string) {
  if (kind === "ops_center") return he.sspSiteKindOps;
  return he.sspSiteKindOffice;
}

function SspUsersPage() {
  const { api, workspaceId, canEdit, isOfficer, sspCan } = useSspWorkspace();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<"office" | "ops_center">("office");
  const [formError, setFormError] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["ssp-sites", workspaceId, q, "actors"],
    enabled: Boolean(workspaceId),
    queryFn: () =>
      api.listSspSites(workspaceId!, {
        q: q.trim() || undefined,
        kind: "office,ops_center",
      }),
    retry: false,
  });

  const create = useMutation({
    mutationFn: () =>
      api.createSspSite(workspaceId!, {
        name: name.trim(),
        phone: phone.trim() || undefined,
        description: description.trim() || undefined,
        kind,
      }),
    onSuccess: async () => {
      setCreating(false);
      setName("");
      setPhone("");
      setDescription("");
      setKind("office");
      setFormError(null);
      await qc.invalidateQueries({ queryKey: ["ssp-sites", workspaceId] });
    },
    onError: (e: unknown) => setFormError(e instanceof Error ? e.message : he.apiUnavailable),
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;
  const schemaUnavailable = list.data?.data_mode === "unavailable" || list.isError;

  return (
    <div data-testid="ssp-users">
      <ModuleScaffold title={he.sspNavUsers} lead={he.sspUsersLead}>
        <SspHubLinks
          items={[
            { to: "/app/ssp/organization", label: he.sspNavOrganization },
            ...(sspCan("ssp.officers.view") ? [{ to: "/app/ssp/officers" as const, label: he.sspNavOfficers }] : []),
            { to: "/app/ssp/devices", label: he.sspNavDevices },
            ...(!isOfficer ? [{ to: "/app/ssp/enrollments" as const, label: he.sspNavEnrollments }] : []),
          ]}
        />
        <p className="text-xs text-fg-muted">{he.sspActorNotPerson}</p>
        <SearchCreateBar
          query={q}
          onQuery={setQ}
          canCreate={canEdit && !schemaUnavailable && list.isSuccess}
          creating={creating}
          onToggleCreate={() => {
            setCreating((v) => !v);
            setFormError(null);
          }}
          createLabel={he.sspNewActor}
        />
        <CreatePanel
          open={creating}
          pending={create.isPending}
          error={formError}
          onSubmit={(ev: FormEvent) => {
            ev.preventDefault();
            if (!name.trim()) return;
            create.mutate();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Input id="new-actor-name" label={he.name} value={name} onChange={(e) => setName(e.target.value)} required />
            <Input id="new-actor-phone" label={he.sspSitePhone} value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Select id="new-actor-kind" label={he.sspSiteKind} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="office">{he.sspSiteKindOffice}</option>
              <option value="ops_center">{he.sspSiteKindOps}</option>
            </Select>
          </div>
          <Textarea
            id="new-actor-desc"
            label="תיאור"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </CreatePanel>
        {list.isLoading ? <EmptyRows message={he.loading} /> : null}
        {list.isError || schemaUnavailable ? (
          <ErrorState
            title={he.apiUnavailable}
            description={he.sspWaitingLocalDb}
            action={
              <Button type="button" variant="secondary" onClick={() => void list.refetch()}>
                {he.retry}
              </Button>
            }
          />
        ) : null}
        {!list.isLoading && !list.isError && !schemaUnavailable && !list.data?.items.length ? (
          <p className="ss-module-empty-text">{he.sspNoActors}</p>
        ) : !list.isLoading && !list.isError && !schemaUnavailable ? (
          <SimpleEntityTable
            empty={he.sspNoActors}
            leadingIcon={Users}
            rows={(list.data?.items ?? []).map((site) => ({
              id: site.id,
              title: site.name,
              meta: [
                kindLabel(site.kind),
                site.is_active ? he.sspSiteActive : he.sspSiteInactive,
                `${he.sspSiteMembers} ${site.members_count ?? 0}`,
                `${he.sspAssignedForms} ${site.assigned_forms_count ?? 0}`,
                `${he.sspPendingJoins} ${site.pending_join_count ?? 0}`,
              ].join(" · "),
              href: `/app/ssp/sites/${site.id}`,
            }))}
          />
        ) : null}
        {!isOfficer ? (
          <p className="pt-2">
            <Link to="/app/ssp/enrollments" className="ops-section-link text-sm">
              {he.sspNavEnrollments}
            </Link>
          </p>
        ) : null}
      </ModuleScaffold>
    </div>
  );
}
