import { ApiClientError } from "@site-secure/api-client";
import { Input, Select } from "@site-secure/ui";
import { useState, type FormEvent } from "react";
import { RequirePermission } from "../components/RequirePermission";
import { Button, CreatePanel, EmptyRows, ErrorState, ModuleScaffold, SimpleEntityTable, useMutation, useQuery } from "../components/Kit";
import { he } from "../i18n/he";
import { can } from "../lib/can";
import { useSession } from "../lib/session";

const KIND_LABEL: Record<string, string> = {
  physical_site: he.kindPhysical,
  office: he.kindOffice,
  ops_center: he.kindOps,
  other: he.kindOther,
};

export function SitesPage() {
  return (
    <RequirePermission permission="workforce.sites.view">
      <SitesBody />
    </RequirePermission>
  );
}

function SitesBody() {
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
  const [siteTimezone, setSiteTimezone] = useState("Asia/Jerusalem");

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
    setSiteTimezone("Asia/Jerusalem");
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
      setSuccess(editingRegionId ? he.regionUpdated : he.regionCreated);
      setCreatingRegion(false);
      resetRegionForm();
      await regionsQuery.refetch();
    },
    onError: (err) => {
      setRegionError(err instanceof ApiClientError ? err.message : he.loadError);
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
        timezone: siteTimezone.trim() || "Asia/Jerusalem",
      };
      return editingSiteId
        ? api.patchWorkforceSite(workspaceId!, editingSiteId, body)
        : api.createWorkforceSite(workspaceId!, body);
    },
    onSuccess: async () => {
      setSuccess(editingSiteId ? he.siteUpdated : he.siteCreated);
      setCreatingSite(false);
      resetSiteForm();
      await sitesQuery.refetch();
    },
    onError: (err) => {
      setSiteError(err instanceof ApiClientError ? err.message : he.loadError);
    },
  });

  const removeRegion = useMutation({
    mutationFn: (id: string) => api.deleteWorkforceRegion(workspaceId!, id),
    onSuccess: async () => {
      setSuccess(he.regionDeleted);
      await regionsQuery.refetch();
    },
    onError: (err) => {
      setRegionError(err instanceof ApiClientError ? err.message : he.loadError);
    },
  });

  const removeSite = useMutation({
    mutationFn: (id: string) => api.deleteWorkforceSite(workspaceId!, id),
    onSuccess: async () => {
      setSuccess(he.siteDeleted);
      await sitesQuery.refetch();
    },
    onError: (err) => {
      setSiteError(err instanceof ApiClientError ? err.message : he.loadError);
    },
  });

  const regions = regionsQuery.data?.items ?? [];
  const sites = sitesQuery.data?.items ?? [];
  const loadError = regionsQuery.isError || sitesQuery.isError;

  return (
    <ModuleScaffold title={he.sitesTitle} lead={he.sitesLead}>
      {success ? (
        <p className="text-sm text-success" role="status">
          {success}
        </p>
      ) : null}
      {loadError ? (
        <ErrorState title={he.loadError} description={he.loadErrorHint} />
      ) : regionsQuery.isLoading || sitesQuery.isLoading ? (
        <p className="text-sm text-fg-muted">{he.loading}</p>
      ) : (
        <div className="grid gap-8">
          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-fg">{he.regionsTitle}</h2>
              {canManage ? (
                <Button
                  type="button"
                  onClick={() => {
                    setCreatingRegion((value) => !value);
                    resetRegionForm();
                    setSuccess(null);
                  }}
                >
                  {creatingRegion ? he.cancel : he.createRegion}
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
                <Input id="wf-region-name" label={he.name} value={regionName} onChange={(event) => setRegionName(event.target.value)} required />
                <Input id="wf-region-code" label={he.fieldCode} value={regionCode} onChange={(event) => setRegionCode(event.target.value)} />
              </div>
            </CreatePanel>
            {regions.length ? (
              <ul className="grid gap-2">
                {regions.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                    <div>
                      <p className="font-medium text-fg">{row.name}</p>
                      <p className="text-xs text-fg-muted">
                        {[row.code, row.is_active ? he.statusActive : he.inactive].filter(Boolean).join(" · ")}
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
                          {he.editAction}
                        </Button>
                        <Button
                          type="button"
                          onClick={() => {
                            if (!window.confirm(he.confirmDeleteRegion)) return;
                            removeRegion.mutate(row.id);
                          }}
                        >
                          {he.deleteAction}
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyRows message={he.regionsEmpty} />
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-fg">{he.sitesSectionTitle}</h2>
              {canManage ? (
                <Button
                  type="button"
                  onClick={() => {
                    setCreatingSite((value) => !value);
                    resetSiteForm();
                    setSuccess(null);
                  }}
                >
                  {creatingSite ? he.cancel : he.createSite}
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
                <Input id="wf-site-name" label={he.name} value={siteName} onChange={(event) => setSiteName(event.target.value)} required />
                <Input id="wf-site-code" label={he.fieldCode} value={siteCode} onChange={(event) => setSiteCode(event.target.value)} />
                <Select id="wf-site-kind" label={he.fieldKind} value={siteKind} onChange={(event) => setSiteKind(event.target.value)}>
                  {Object.entries(KIND_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
                <Select id="wf-site-region" label={he.fieldRegion} value={siteRegionId} onChange={(event) => setSiteRegionId(event.target.value)}>
                  <option value="">{he.lookupNone}</option>
                  {regions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
                <Input id="wf-site-timezone" label={he.fieldTimezone} value={siteTimezone} onChange={(event) => setSiteTimezone(event.target.value)} required />
                <Input id="wf-site-notes" label={he.fieldNotes} value={siteNotes} onChange={(event) => setSiteNotes(event.target.value)} />
              </div>
            </CreatePanel>
            {sites.length ? (
              <SimpleEntityTable
                rows={sites.map((row) => ({
                  id: row.id,
                  title: row.name,
                  meta: [KIND_LABEL[row.kind] ?? row.kind, row.code, row.timezone, regions.find((region) => region.id === row.region_id)?.name]
                    .filter(Boolean)
                    .join(" · "),
                  status: row.is_active ? "active" : "inactive",
                }))}
                empty={he.sitesEmpty}
                statusLabel={(status) => (status === "active" ? he.statusActive : he.inactive)}
              />
            ) : (
              <EmptyRows message={he.sitesEmpty} />
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
                        setSiteTimezone(row.timezone || "Asia/Jerusalem");
                        setSiteError(null);
                      }}
                    >
                      {he.editAction}: {row.name}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        if (!window.confirm(he.confirmDeleteSite)) return;
                        removeSite.mutate(row.id);
                      }}
                    >
                      {he.deleteAction}: {row.name}
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
