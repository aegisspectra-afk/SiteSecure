import { Button, Input, Select, Textarea } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
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

export const Route = createFileRoute("/app/ssp/sites/")({
  validateSearch: (search: Record<string, unknown>): { activation?: string } => {
    const activation = typeof search.activation === "string" ? search.activation : undefined;
    return activation ? { activation } : {};
  },
  component: SspSitesPage,
});

function kindLabel(kind?: string) {
  if (kind === "ops_center") return he.sspSiteKindOps;
  if (kind === "physical_site") return he.sspSiteKindPhysical;
  if (kind === "other") return he.sspSiteKindOther;
  return he.sspSiteKindOffice;
}

function activationLabel(status?: string) {
  if (status === "awaiting_activation") return he.sspActivationAwaiting;
  if (status === "code_issued") return he.sspActivationCodeIssued;
  if (status === "pending_approval") return he.sspActivationPendingApproval;
  if (status === "device_active") return he.sspActivationDeviceActive;
  return status || "—";
}

function SspSitesPage() {
  const { api, workspaceId, canEdit, isOfficer } = useSspWorkspace();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const search = Route.useSearch();
  const [activation, setActivation] = useState(search.activation ?? "");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<"physical_site" | "other">("physical_site");
  const [formError, setFormError] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["ssp-sites", workspaceId, q, activation, "customer"],
    enabled: Boolean(workspaceId),
    queryFn: () =>
      api.listSspSites(workspaceId!, {
        q: q.trim() || undefined,
        activation_status: activation || undefined,
        kind: "physical_site,other",
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
      setKind("physical_site");
      setFormError(null);
      await qc.invalidateQueries({ queryKey: ["ssp-sites", workspaceId] });
    },
    onError: (e: unknown) => setFormError(e instanceof Error ? e.message : he.apiUnavailable),
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;
  const schemaUnavailable = list.data?.data_mode === "unavailable" || list.isError;

  return (
    <div data-testid="ssp-sites">
      <ModuleScaffold title={he.sspNavCustomerSites} lead={he.sspCustomerSitesLead}>
      <SspHubLinks
        items={[
          { to: "/app/ssp/checkpoints", label: he.sspNavCheckpoints },
          ...(!isOfficer ? [{ to: "/app/ssp/enrollments" as const, label: he.sspNavEnrollments }] : []),
        ]}
      />
      <p className="text-xs text-fg-muted">{he.sspSiteNoSchedule}</p>
      <SearchCreateBar
        query={q}
        onQuery={setQ}
        canCreate={canEdit && !schemaUnavailable && list.isSuccess}
        creating={creating}
        onToggleCreate={() => {
          setCreating((v) => !v);
          setFormError(null);
        }}
        createLabel={he.sspNewCustomerSite}
      />
      <Select
        id="ssp-site-activation"
        label={he.sspFilterActivation}
        value={activation}
        onChange={(e) => setActivation(e.target.value)}
      >
        <option value="">הכול</option>
        <option value="awaiting_activation">{he.sspActivationAwaiting}</option>
        <option value="code_issued">{he.sspActivationCodeIssued}</option>
        <option value="pending_approval">{he.sspActivationPendingApproval}</option>
        <option value="device_active">{he.sspActivationDeviceActive}</option>
      </Select>

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
          <Input id="new-site-name" label={he.name} value={name} onChange={(e) => setName(e.target.value)} required />
          <Input id="new-site-phone" label={he.sspSitePhone} value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Select id="new-site-kind" label={he.sspSiteKind} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="physical_site">{he.sspSiteKindPhysical}</option>
            <option value="other">{he.sspSiteKindOther}</option>
          </Select>
        </div>
        <Textarea
          id="new-site-desc"
          label={`${he.sspSiteAddress} / ${he.sspSiteServiceReq}`}
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
        <div className="ops-card flex flex-col items-start gap-3 p-6" data-testid="ssp-no-sites">
          <div>
            <p className="text-base font-semibold text-fg">{he.sspNoSites}</p>
            <p className="mt-1 text-sm text-fg-muted">{he.sspCustomerSitesLead}</p>
          </div>
          {canEdit ? (
            <Button
              type="button"
              onClick={() => {
                setCreating(true);
                setFormError(null);
              }}
            >
              {he.sspNewCustomerSite}
            </Button>
          ) : null}
        </div>
      ) : !list.isLoading && !list.isError && !schemaUnavailable ? (
        <SimpleEntityTable
          empty={he.sspNoSites}
          leadingIcon={Building2}
          statusLabel={activationLabel}
          rows={(list.data?.items ?? []).map((site) => ({
            id: site.id,
            title: site.name,
            meta: [
              kindLabel(site.kind),
              site.is_active ? he.sspSiteActive : he.sspSiteInactive,
              `${he.sspSiteMembers} ${site.members_count ?? 0}`,
              `${he.sspAssignedForms} ${site.assigned_forms_count ?? 0}`,
              `${he.sspSubmissionsCount} ${site.submissions_count ?? 0}`,
              `${he.sspPendingJoins} ${site.pending_join_count ?? 0}`,
            ].join(" · "),
            status: site.activation_status,
            href: `/app/ssp/sites/${site.id}`,
          }))}
        />
      ) : null}
      </ModuleScaffold>
    </div>
  );
}
