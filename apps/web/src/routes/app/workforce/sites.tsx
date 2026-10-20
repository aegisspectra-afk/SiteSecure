import { ApiClientError } from "@site-secure/api-client";
import { Input, Select } from "@site-secure/ui";
import { createFileRoute } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  Button,
  CreatePanel,
  EmptyRows,
  ErrorState,
  ModuleScaffold,
  SimpleEntityTable,
  useMutation,
  useQuery,
} from "../../../components/modules/ModuleKit";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { can } from "../../../lib/can";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/workforce/sites")({
  component: WorkforceSitesPage,
});

const KIND_LABEL: Record<string, string> = {
  physical_site: he.workforceKindPhysical,
  office: he.workforceKindOffice,
  ops_center: he.workforceKindOps,
  other: he.workforceKindOther,
};

function WorkforceSitesPage() {
  return (
    <RequirePermission permission="workforce.sites.view">
      <WorkforceSitesBody />
    </RequirePermission>
  );
}

function WorkforceSitesBody() {
  const { session, api } = useSession();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const grants = membership?.permissions ?? null;
  const features = membership?.features ?? [];
  const canManage = can(membership?.role_key, "workforce.sites.manage", features, grants);
  const [success, setSuccess] = useState<string | null>(null);
  const [regionError, setRegionError] = useState<string | null>(null);
  const [siteError, setSiteError] = useState<string | null>(null);
  const [creatingRegion, setCreatingRegion] = useState(false);
  const [creatingSite, setCreatingSite] = useState(false);
  const [editingRegionId, setEditingRegionId] = useState<string | null>(null);
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [regionName, setRegionName] = useState("");
  const [regionCode, setRegionCode] = useState("");
  const [siteName, setSiteName] = useState("");
  const [siteCode, setSiteCode] = useState("");
  const [siteKind, setSiteKind] = useState("physical_site");
  const [siteRegionId, setSiteRegionId] = useState("");
  const [siteNotes, setSiteNotes] = useState("");

  const regionsQuery = useQuery({
    queryKey: ["workforce-regions", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listWorkforceRegions(workspaceId!),
  });
  const sitesQuery = useQuery({
    queryKey: ["workforce-sites", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listWorkforceSites(workspaceId!),
  });

  const resetRegionForm = () => {
    setRegionName("");
    setRegionCode("");
    setRegionError(null);
    setEditingRegionId(null);
  };
  const resetSiteForm = () => {
    setSiteName("");
    setSiteCode("");
    setSiteKind("physical_site");
    setSiteRegionId("");
    setSiteNotes("");
    setSiteError(null);
    setEditingSiteId(null);
  };

  const saveRegion = useMutation({
    mutationFn: () => {
      const body = { name: regionName.trim(), code: regionCode.trim() || undefined };
      return editingRegionId
        ? api.patchWorkforceRegion(workspaceId!, editingRegionId, body)
        : api.createWorkforceRegion(workspaceId!, body);
    },
    onSuccess: async () => {
      setSuccess(editingRegionId ? he.workforceRegionUpdated : he.workforceRegionCreated);
      setCreatingRegion(false);
      resetRegionForm();
      await regionsQuery.refetch();
    },
    onError: (err) => {
      setRegionError(err instanceof ApiClientError ? err.message : he.workforceLoadError);
    },
  });

  const saveSite = useMutation({
    mutationFn: () => {
      const body = {
        name: siteName.trim(),
        code: siteCode.trim() || undefined,
        kind: siteKind,
        region_id: siteRegionId || null,
        notes: siteNotes.trim() || undefined,
      };
      return editingSiteId
        ? api.patchWorkforceSite(workspaceId!, editingSiteId, body)
        : api.createWorkforceSite(workspaceId!, body);
    },
    onSuccess: async () => {
      setSuccess(editingSiteId ? he.workforceSiteUpdated : he.workforceSiteCreated);
      setCreatingSite(false);
      resetSiteForm();
      await sitesQuery.refetch();
    },
    onError: (err) => {
      setSiteError(err instanceof ApiClientError ? err.message : he.workforceLoadError);
    },
  });

  const removeRegion = useMutation({
    mutationFn: (id: string) => api.deleteWorkforceRegion(workspaceId!, id),
    onSuccess: async () => {
      setSuccess(he.workforceRegionDeleted);
      await regionsQuery.refetch();
    },
    onError: (err) => {
      setRegionError(err instanceof ApiClientError ? err.message : he.workforceLoadError);
    },
  });

  const removeSite = useMutation({
    mutationFn: (id: string) => api.deleteWorkforceSite(workspaceId!, id),
    onSuccess: async () => {
      setSuccess(he.workforceSiteDeleted);
      await sitesQuery.refetch();
    },
    onError: (err) => {
      setSiteError(err instanceof ApiClientError ? err.message : he.workforceLoadError);
    },
  });

  const regions = regionsQuery.data?.items ?? [];
  const sites = sitesQuery.data?.items ?? [];
  const loadError = regionsQuery.isError || sitesQuery.isError;

  return (
    <ModuleScaffold title={he.workforceSitesTitle} lead={he.workforceSitesLead}>
      {success ? (
        <p className="text-sm text-success" role="status">
          {success}
        </p>
      ) : null}
      {loadError ? (
        <ErrorState title={he.workforceLoadError} description={he.workforceLoadErrorHint} />
      ) : regionsQuery.isLoading || sitesQuery.isLoading ? (
        <p className="text-sm text-fg-muted">{he.loading}</p>
      ) : (
        <div className="grid gap-8">
          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-fg">{he.workforceRegionsTitle}</h2>
              {canManage ? (
                <Button
                  type="button"
                  onClick={() => {
                    setCreatingRegion((value) => !value);
                    resetRegionForm();
                    setSuccess(null);
                  }}
                >
                  {creatingRegion ? he.cancel : he.workforceCreateRegion}
                </Button>
              ) : null}
            </div>
            <CreatePanel
              open={creatingRegion}
              pending={saveRegion.isPending}
              error={regionError}
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                saveRegion.mutate();
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  id="wf-region-name"
                  label={he.name}
                  value={regionName}
                  onChange={(event) => setRegionName(event.target.value)}
                  required
                />
                <Input
                  id="wf-region-code"
                  label={he.workforceFieldCode}
                  value={regionCode}
                  onChange={(event) => setRegionCode(event.target.value)}
                />
              </div>
            </CreatePanel>
            {regions.length ? (
              <ul className="grid gap-2">
                {regions.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] border border-border px-3 py-2">
                    <div>
                      <p className="font-medium text-fg">{row.name}</p>
                      <p className="text-xs text-fg-muted">
                        {[row.code, row.is_active ? he.workforceStatusActive : he.workforceInactive]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    {canManage ? (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          onClick={() => {
                            setCreatingRegion(true);
                            setEditingRegionId(row.id);
                            setRegionName(row.name);
                            setRegionCode(row.code ?? "");
                            setRegionError(null);
                          }}
                        >
                          {he.workforceEditAction}
                        </Button>
                        <Button
                          type="button"
                          onClick={() => {
                            if (!window.confirm(he.workforceConfirmDeleteRegion)) return;
                            removeRegion.mutate(row.id);
                          }}
                        >
                          {he.workforceDeleteAction}
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyRows message={he.workforceRegionsEmpty} />
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-fg">{he.workforceSitesSectionTitle}</h2>
              {canManage ? (
                <Button
                  type="button"
                  onClick={() => {
                    setCreatingSite((value) => !value);
                    resetSiteForm();
                    setSuccess(null);
                  }}
                >
                  {creatingSite ? he.cancel : he.workforceCreateSite}
                </Button>
              ) : null}
            </div>
            <CreatePanel
              open={creatingSite}
              pending={saveSite.isPending}
              error={siteError}
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                saveSite.mutate();
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  id="wf-site-name"
                  label={he.name}
                  value={siteName}
                  onChange={(event) => setSiteName(event.target.value)}
                  required
                />
                <Input
                  id="wf-site-code"
                  label={he.workforceFieldCode}
                  value={siteCode}
                  onChange={(event) => setSiteCode(event.target.value)}
                />
                <Select
                  id="wf-site-kind"
                  label={he.workforceFieldKind}
                  value={siteKind}
                  onChange={(event) => setSiteKind(event.target.value)}
                >
                  {Object.entries(KIND_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
                <Select
                  id="wf-site-region"
                  label={he.workforceFieldRegion}
                  value={siteRegionId}
                  onChange={(event) => setSiteRegionId(event.target.value)}
                >
                  <option value="">{he.workforceLookupNone}</option>
                  {regions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
                <Input
                  id="wf-site-notes"
                  label={he.workforceFieldNotes}
                  value={siteNotes}
                  onChange={(event) => setSiteNotes(event.target.value)}
                />
              </div>
            </CreatePanel>
            {sites.length ? (
              <SimpleEntityTable
                rows={sites.map((row) => ({
                  id: row.id,
                  title: row.name,
                  meta: [
                    KIND_LABEL[row.kind] ?? row.kind,
                    row.code,
                    regions.find((region) => region.id === row.region_id)?.name,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                  status: row.is_active ? "active" : "inactive",
                }))}
                empty={he.workforceSitesEmpty}
                statusLabel={(status) =>
                  status === "active" ? he.workforceStatusActive : he.workforceInactive
                }
                leadingIcon={MapPin}
              />
            ) : (
              <EmptyRows message={he.workforceSitesEmpty} />
            )}
            {canManage && sites.length ? (
              <ul className="mt-3 grid gap-2">
                {sites.map((row) => (
                  <li key={`actions-${row.id}`} className="flex justify-end gap-2">
                    <Button
                      type="button"
                      onClick={() => {
                        setCreatingSite(true);
                        setEditingSiteId(row.id);
                        setSiteName(row.name);
                        setSiteCode(row.code ?? "");
                        setSiteKind(row.kind || "physical_site");
                        setSiteRegionId(row.region_id ?? "");
                        setSiteNotes(row.notes ?? "");
                        setSiteError(null);
                      }}
                    >
                      {he.workforceEditAction}: {row.name}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        if (!window.confirm(he.workforceConfirmDeleteSite)) return;
                        removeSite.mutate(row.id);
                      }}
                    >
                      {he.workforceDeleteAction}: {row.name}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </div>
      )}
    </ModuleScaffold>
  );
}
