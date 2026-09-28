import {
  ApiClientError,
  type EquipmentOut,
  type SystemOut,
  type WarrantyOut,
} from "@site-secure/api-client";
import { Button, ErrorState, Input, Select, Status } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { he } from "../../i18n/he";
import { can } from "../../lib/can";
import {
  ASSET_CATEGORY_OPTIONS,
  ASSET_STATUS_OPTIONS,
  equipmentCategoryLabel,
  equipmentStatusLabel,
  equipmentStatusTone,
  formatAssetDate,
  manufacturerModel,
  warrantyForAsset,
} from "../../lib/site-assets";
import { warrantyStatusLabel, warrantyTypeLabel } from "../../lib/warranties";
import { useSession } from "../../lib/session";
import { AssetConnectionsSection } from "./AssetConnectionsSection";
import { AssetDocumentsSection } from "./AssetDocumentsSection";
import { AssetActivitySection, AssetServiceHistorySection } from "./AssetLifecycleSections";

function Section({
  id,
  title,
  children,
  defaultOpen = true,
}: {
  id: string;
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="site-asset-section border-b border-border py-3"
      open={defaultOpen}
      data-testid={`asset-section-${id}`}
    >
      <summary className="cursor-pointer list-none text-sm font-semibold text-fg [&::-webkit-details-marker]:hidden">
        <span className="flex min-h-11 items-center justify-between gap-2">
          {title}
          <span className="text-xs font-normal text-fg-muted" aria-hidden>
            ▾
          </span>
        </span>
      </summary>
      <div className="mt-2 space-y-3 pb-2">{children}</div>
    </details>
  );
}

function FieldRow({
  label,
  value,
  ltr,
}: {
  label: string;
  value: ReactNode;
  ltr?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="shrink-0 text-xs text-fg-muted">{label}</dt>
      <dd className={`text-sm text-fg text-end ${ltr ? "public-mono" : ""}`} dir={ltr ? "ltr" : undefined}>
        {value ?? "—"}
      </dd>
    </div>
  );
}

export function AssetDetail({ siteId, assetId }: { siteId: string; assetId: string }) {
  const { session, api } = useSession();
  const queryClient = useQueryClient();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const roleKey = membership?.role_key;
  const features = membership?.features ?? [];
  const permissions = membership?.permissions;
  const canEdit = can(roleKey, "systems.edit", features, permissions);
  const canWarranties = can(roleKey, "warranties.view", features, permissions);
  const canProjects = can(roleKey, "projects.view", features, permissions);
  const canCatalog = can(roleKey, "catalog.view", features, permissions) || can(roleKey, "quotes.view", features, permissions);
  const canDocsView = can(roleKey, "documents.view", features, permissions);
  const canDocsUpload = can(roleKey, "documents.upload", features, permissions);
  const canService = can(roleKey, "service.view", features, permissions);

  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("installed");
  const [category, setCategory] = useState("other");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");
  const [locationNote, setLocationNote] = useState("");
  const [systemId, setSystemId] = useState("");
  const [ip, setIp] = useState("");
  const [mac, setMac] = useState("");
  const [installedAt, setInstalledAt] = useState("");

  const assetQuery = useQuery({
    queryKey: ["equipment", workspaceId, assetId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getEquipment(workspaceId!, assetId),
  });

  const siteQuery = useQuery({
    queryKey: ["site", workspaceId, siteId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getSite(workspaceId!, siteId),
  });

  const systemsQuery = useQuery({
    queryKey: ["site-systems", workspaceId, siteId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSystems(workspaceId!, siteId),
  });

  const warrantiesQuery = useQuery({
    queryKey: ["site-warranties", workspaceId, siteId],
    enabled: Boolean(workspaceId && canWarranties),
    queryFn: () => api.listWarranties(workspaceId!, { site_id: siteId, limit: 100 }),
  });

  const ipamQuery = useQuery({
    queryKey: ["equipment-ips", workspaceId, assetId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listEquipmentIpAddresses(workspaceId!, assetId),
  });

  const asset = assetQuery.data;
  const projectId = asset?.project_id ?? undefined;
  const productId = asset?.product_id ?? undefined;

  const projectQuery = useQuery({
    queryKey: ["project", workspaceId, projectId],
    enabled: Boolean(workspaceId && projectId && canProjects),
    queryFn: () => api.getProject(workspaceId!, projectId!),
    retry: false,
  });

  const quoteId = projectQuery.data?.source_quote_id ?? undefined;
  const quoteQuery = useQuery({
    queryKey: ["quote", workspaceId, quoteId],
    enabled: Boolean(workspaceId && quoteId && canProjects),
    queryFn: () => api.getQuote(workspaceId!, quoteId!),
    retry: false,
  });

  const productQuery = useQuery({
    queryKey: ["catalog-product", workspaceId, productId],
    enabled: Boolean(workspaceId && productId && canCatalog),
    queryFn: () => api.getCatalogProduct(workspaceId!, productId!),
    retry: false,
  });

  useEffect(() => {
    if (!asset) return;
    setName(asset.name || "");
    setStatus(asset.status || "installed");
    setCategory(asset.category || "other");
    setManufacturer(asset.manufacturer || "");
    setModel(asset.model || "");
    setSerial(asset.serial || "");
    setLocationNote(asset.location_note || "");
    setSystemId(asset.system_id || "");
    setIp(asset.ip || "");
    setMac(asset.mac || "");
    setInstalledAt(asset.installed_at ? asset.installed_at.slice(0, 10) : "");
  }, [asset]);

  const systems: SystemOut[] = systemsQuery.data?.items ?? [];
  const warranties: WarrantyOut[] = warrantiesQuery.data?.items ?? [];
  const linkedWarranty = useMemo(
    () => (asset ? warrantyForAsset(warranties, asset.id) : null),
    [warranties, asset],
  );

  const save = useMutation({
    mutationFn: () =>
      api.patchEquipment(workspaceId!, assetId, {
        name: name.trim(),
        status,
        category,
        manufacturer: manufacturer.trim() || null,
        model: model.trim() || null,
        serial: serial.trim() || null,
        location_note: locationNote.trim() || null,
        system_id: systemId || null,
        ip: ip.trim() || null,
        mac: mac.trim() || null,
        installed_at: installedAt.trim() || null,
      }),
    onSuccess: () => {
      setError(null);
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: ["equipment", workspaceId, assetId] });
      void queryClient.invalidateQueries({ queryKey: ["site-equipment", workspaceId, siteId] });
    },
    onError: (err) => {
      setError(err instanceof ApiClientError ? err.message : he.assetSaveError);
    },
  });

  if (!workspaceId) return <ErrorState title={he.assetLoadError} />;
  if (assetQuery.isError) {
    return (
      <ErrorState
        title={assetQuery.error instanceof ApiClientError ? assetQuery.error.message : he.assetLoadError}
      />
    );
  }
  if (assetQuery.isLoading || !asset) {
    return <p className="p-4 text-sm text-fg-muted">{he.assetLoading}</p>;
  }

  if (asset.site_id !== siteId) {
    return <ErrorState title={he.assetSiteMismatch} />;
  }

  const site = siteQuery.data;
  const project = projectQuery.data;
  const quote = quoteQuery.data;
  const product = productQuery.data;
  const mm = manufacturerModel(asset);

  return (
    <div className="site-asset-detail mx-auto max-w-3xl px-4 pb-24 pt-4 md:pb-10" data-testid="asset-detail">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link
          to="/app/sites/$siteId"
          params={{ siteId }}
          className="inline-flex min-h-11 items-center gap-1 text-sm text-fg-muted hover:text-fg"
          data-testid="asset-back-to-site"
        >
          <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
          {he.assetBackToSite}
        </Link>
      </div>

      <header className="mb-4 border-b border-border pb-4">
        {asset.asset_code ? (
          <p className="public-mono text-xs tracking-wide text-fg-muted" dir="ltr" data-testid="asset-code">
            {asset.asset_code}
          </p>
        ) : null}
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-fg" data-testid="asset-name">
          {asset.name}
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          {[equipmentCategoryLabel(asset.category), mm].filter(Boolean).join(" · ") || "—"}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Status label={equipmentStatusLabel(asset.status)} tone={equipmentStatusTone(asset.status)} />
          {canEdit && !editing ? (
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              onClick={() => setEditing(true)}
              data-testid="asset-edit-open"
            >
              {he.assetEdit}
            </Button>
          ) : null}
        </div>
        {error ? (
          <p className="mt-2 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </header>

      {editing && canEdit ? (
        <form
          className="mb-6 space-y-4 rounded-md border border-border p-4"
          data-testid="asset-edit-form"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <p className="text-sm font-semibold text-fg">{he.assetEdit}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input id="asset-edit-name" label={he.equipmentName} value={name} onChange={(e) => setName(e.target.value)} />
            <Select id="asset-edit-status" label={he.status} value={status} onChange={(e) => setStatus(e.target.value)}>
              {ASSET_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {equipmentStatusLabel(s)}
                </option>
              ))}
            </Select>
            <Select
              id="asset-edit-category"
              label={he.equipmentCategory}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {ASSET_CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {equipmentCategoryLabel(c)}
                </option>
              ))}
            </Select>
            <Select
              id="asset-edit-system"
              label={he.siteTabSystems}
              value={systemId}
              onChange={(e) => setSystemId(e.target.value)}
            >
              <option value="">{he.siteAssetsNoSystem}</option>
              {systems.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Input
              id="asset-edit-mfr"
              label={he.assetManufacturer}
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
            />
            <Input id="asset-edit-model" label={he.assetModel} value={model} onChange={(e) => setModel(e.target.value)} />
            <Input
              id="asset-edit-serial"
              label={he.equipmentSerial}
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
            />
            <Input
              id="asset-edit-location"
              label={he.equipmentLocation}
              value={locationNote}
              onChange={(e) => setLocationNote(e.target.value)}
            />
            <Input id="asset-edit-ip" label="IP" value={ip} onChange={(e) => setIp(e.target.value)} />
            <Input id="asset-edit-mac" label="MAC" value={mac} onChange={(e) => setMac(e.target.value)} />
            <Input
              id="asset-edit-installed"
              label={he.equipmentInstalled}
              type="date"
              value={installedAt}
              onChange={(e) => setInstalledAt(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={save.isPending} className="min-h-11" data-testid="asset-edit-save">
              {he.save}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              disabled={save.isPending}
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
            >
              {he.cancel}
            </Button>
          </div>
        </form>
      ) : null}

      <Section id="general" title={he.assetSectionGeneral}>
        <dl className="divide-y divide-border border-y border-border">
          <FieldRow label={he.equipmentAssetCode} value={asset.asset_code || "—"} ltr />
          <FieldRow label={he.equipmentName} value={asset.name} />
          <FieldRow label={he.equipmentCategory} value={equipmentCategoryLabel(asset.category)} />
          <FieldRow label={he.assetManufacturer} value={asset.manufacturer || "—"} />
          <FieldRow label={he.assetModel} value={asset.model || "—"} />
          <FieldRow label={he.equipmentSerial} value={asset.serial || "—"} ltr />
          <FieldRow label={he.status} value={equipmentStatusLabel(asset.status)} />
        </dl>
      </Section>

      <Section id="location" title={he.assetSectionLocation}>
        <dl className="divide-y divide-border border-y border-border">
          <FieldRow
            label={he.navSiteFiles}
            value={
              site ? (
                <Link to="/app/sites/$siteId" params={{ siteId }} className="hover:underline">
                  {site.name}
                </Link>
              ) : (
                "—"
              )
            }
          />
          <FieldRow
            label={he.siteTabSystems}
            value={systems.find((s) => s.id === asset.system_id)?.name || he.siteAssetsNoSystem}
          />
          <FieldRow label={he.equipmentLocation} value={asset.location_note || he.siteLocationUnknown} />
        </dl>
      </Section>

      <Section id="network" title={he.assetSectionNetwork}>
        {(() => {
          const ipamItems = ipamQuery.data?.items ?? [];
          const primary = ipamItems[0] ?? null;
          const legacyIp = ipamQuery.data?.legacy_ip ?? asset.ip;
          const legacyMac = ipamQuery.data?.legacy_mac ?? asset.mac;
          if (primary) {
            return (
              <div className="space-y-2" data-testid="asset-ipam">
                <dl className="divide-y divide-border border-y border-border">
                  <FieldRow label={he.assetIpamPrimary} value={primary.ip_address} ltr />
                  <FieldRow label="MAC" value={primary.mac_address || legacyMac || "—"} ltr />
                  <FieldRow
                    label={he.siteNetworksTitle}
                    value={
                      primary.network_name
                        ? `${primary.network_name}${primary.network_cidr ? ` (${primary.network_cidr})` : ""}`
                        : "—"
                    }
                  />
                  <FieldRow
                    label={he.siteVlanTitle}
                    value={
                      primary.vlan_number != null
                        ? `${primary.vlan_number}${primary.vlan_name ? ` — ${primary.vlan_name}` : ""}`
                        : "—"
                    }
                  />
                  {ipamItems.length > 1 ? (
                    <FieldRow
                      label={he.siteIpamTitle}
                      value={
                        <span className="public-mono text-xs" dir="ltr">
                          {ipamItems.map((r) => r.ip_address).join(", ")}
                        </span>
                      }
                    />
                  ) : null}
                </dl>
                <p className="text-xs text-fg-muted">{he.assetNetworkBasicNote}</p>
              </div>
            );
          }
          return (
            <div data-testid="asset-ipam-legacy">
              <dl className="divide-y divide-border border-y border-border">
                <FieldRow label="IP" value={legacyIp || "—"} ltr />
                <FieldRow label="MAC" value={legacyMac || "—"} ltr />
              </dl>
              <p className="mt-2 text-xs text-fg-muted">
                {legacyIp || legacyMac ? he.assetIpamLegacyFallback : he.assetIpamEmpty}
              </p>
              <p className="mt-1 text-xs text-fg-muted">{he.assetNetworkBasicNote}</p>
            </div>
          );
        })()}
      </Section>

      <Section id="connections" title={he.assetSectionConnections} defaultOpen={false}>
        <AssetConnectionsSection siteId={siteId} assetId={assetId} canEdit={canEdit} />
      </Section>

      <Section id="lifecycle" title={he.assetSectionLifecycle} defaultOpen={false}>
        <dl className="divide-y divide-border border-y border-border">
          <FieldRow label={he.equipmentInstalled} value={formatAssetDate(asset.installed_at) || "—"} />
          <FieldRow
            label={he.assetSource}
            value={
              project ? (
                <span>
                  <Link
                    to="/app/projects/$projectId"
                    params={{ projectId: project.id }}
                    className="font-medium hover:underline"
                  >
                    {project.name}
                  </Link>
                  {project.source_quote_version || quote?.number ? (
                    <span className="mt-1 block text-xs text-fg-muted">
                      {quote?.number
                        ? he.assetSourceQuote(
                            quote.number,
                            project.source_quote_version ?? quote.version ?? null,
                          )
                        : project.source_quote_version
                          ? he.projectPlannedScopeFromRevision(project.source_quote_version)
                          : null}
                    </span>
                  ) : null}
                </span>
              ) : asset.project_id ? (
                he.assetSourceUnavailable
              ) : (
                he.assetNoProjectSource
              )
            }
          />
          <FieldRow
            label={he.assetProductSource}
            value={
              product ? (
                <span>
                  <span className="font-medium">{product.name || product.sku || product.id}</span>
                  {product.sku ? (
                    <span className="mt-0.5 block public-mono text-xs text-fg-muted" dir="ltr">
                      {product.sku}
                    </span>
                  ) : null}
                </span>
              ) : asset.product_id ? (
                he.assetProductUnavailable
              ) : (
                he.assetNoProductSource
              )
            }
          />
        </dl>
      </Section>

      <Section id="warranty" title={he.assetSectionWarranty} defaultOpen={false}>
        {linkedWarranty ? (
          <div className="space-y-2" data-testid="asset-warranty">
            <div className="flex flex-wrap items-center gap-2">
              <Status label={warrantyStatusLabel(linkedWarranty.status)} />
              <Link
                to="/app/warranties/$warrantyId"
                params={{ warrantyId: linkedWarranty.id }}
                className="text-sm font-medium text-fg underline-offset-2 hover:underline"
              >
                {linkedWarranty.number || linkedWarranty.title || he.siteWarrantyLabel}
              </Link>
            </div>
            <dl className="divide-y divide-border border-y border-border">
              <FieldRow label={he.warrantyType} value={warrantyTypeLabel(linkedWarranty.type)} />
              <FieldRow label={he.warrantyStarts} value={formatAssetDate(linkedWarranty.starts_on) || "—"} />
              <FieldRow label={he.warrantyEnds} value={formatAssetDate(linkedWarranty.ends_on) || "—"} />
            </dl>
          </div>
        ) : (
          <p className="text-sm text-fg-muted" data-testid="asset-warranty-empty">
            {he.assetNoWarranty}
          </p>
        )}
      </Section>

      {canDocsView ? (
        <Section id="documents" title={he.assetSectionDocuments} defaultOpen={false}>
          <AssetDocumentsSection assetId={assetId} canUpload={canDocsUpload} />
        </Section>
      ) : null}

      <Section id="service" title={he.assetSectionService} defaultOpen={false}>
        <AssetServiceHistorySection assetId={assetId} canView={canService} />
      </Section>

      <Section id="activity" title={he.assetSectionActivity} defaultOpen={false}>
        <AssetActivitySection assetId={assetId} />
      </Section>
    </div>
  );
}

/** Lightweight type guard for tests / callers */
export type { EquipmentOut };
