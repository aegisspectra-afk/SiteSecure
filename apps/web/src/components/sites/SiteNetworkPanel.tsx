import {
  ApiClientError,
  type EquipmentOut,
  type SiteIpAddressOut,
  type SiteNetworkOut,
  type SiteVlanOut,
} from "@site-secure/api-client";
import { Button, Input, Select, Status } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { he } from "../../i18n/he";
import { useSession } from "../../lib/session";

function ipStatusTone(status: string): "success" | "warning" | "neutral" | "danger" {
  if (status === "assigned") return "success";
  if (status === "reserved") return "warning";
  return "neutral";
}

export function SiteNetworkPanel({
  siteId,
  equipment,
  canEdit,
}: {
  siteId: string;
  equipment: EquipmentOut[];
  canEdit?: boolean;
}) {
  const { session, api } = useSession();
  const queryClient = useQueryClient();
  const workspaceId = session?.memberships[0]?.workspace_id;
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showVlanForm, setShowVlanForm] = useState(false);
  const [showNetForm, setShowNetForm] = useState(false);
  const [showIpForm, setShowIpForm] = useState(false);

  const [vlanNumber, setVlanNumber] = useState("10");
  const [vlanName, setVlanName] = useState("");
  const [vlanPurpose, setVlanPurpose] = useState("");

  const [netName, setNetName] = useState("");
  const [netCidr, setNetCidr] = useState("");
  const [netVlanId, setNetVlanId] = useState("");
  const [netGateway, setNetGateway] = useState("");
  const [netPurpose, setNetPurpose] = useState("");

  const [ipAddress, setIpAddress] = useState("");
  const [ipNetworkId, setIpNetworkId] = useState("");
  const [ipEquipmentId, setIpEquipmentId] = useState("");
  const [ipHostname, setIpHostname] = useState("");
  const [ipMac, setIpMac] = useState("");
  const [ipType, setIpType] = useState("static");

  const overviewQuery = useQuery({
    queryKey: ["site-network-overview", workspaceId, siteId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getSiteNetworkOverview(workspaceId!, siteId),
  });
  const vlansQuery = useQuery({
    queryKey: ["site-vlans", workspaceId, siteId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSiteVlans(workspaceId!, siteId),
  });
  const networksQuery = useQuery({
    queryKey: ["site-networks", workspaceId, siteId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSiteNetworks(workspaceId!, siteId),
  });
  const ipsQuery = useQuery({
    queryKey: ["site-ips", workspaceId, siteId, q],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSiteIpAddresses(workspaceId!, siteId, { q: q || undefined }),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["site-network-overview", workspaceId, siteId] });
    void queryClient.invalidateQueries({ queryKey: ["site-vlans", workspaceId, siteId] });
    void queryClient.invalidateQueries({ queryKey: ["site-networks", workspaceId, siteId] });
    void queryClient.invalidateQueries({ queryKey: ["site-ips", workspaceId, siteId] });
  };

  const createVlan = useMutation({
    mutationFn: () =>
      api.createSiteVlan(workspaceId!, {
        site_id: siteId,
        vlan_number: Number(vlanNumber),
        name: vlanName.trim(),
        purpose: vlanPurpose.trim() || null,
      }),
    onSuccess: () => {
      setError(null);
      setShowVlanForm(false);
      setVlanName("");
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : he.siteNetworkError),
  });

  const createNetwork = useMutation({
    mutationFn: () =>
      api.createSiteNetwork(workspaceId!, {
        site_id: siteId,
        name: netName.trim(),
        cidr: netCidr.trim(),
        vlan_id: netVlanId || null,
        gateway: netGateway.trim() || null,
        purpose: netPurpose.trim() || null,
      }),
    onSuccess: () => {
      setError(null);
      setShowNetForm(false);
      setNetName("");
      setNetCidr("");
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : he.siteNetworkError),
  });

  const createIp = useMutation({
    mutationFn: () =>
      api.createSiteIpAddress(workspaceId!, {
        site_id: siteId,
        network_id: ipNetworkId,
        ip_address: ipAddress.trim(),
        equipment_id: ipEquipmentId || null,
        hostname: ipHostname.trim() || null,
        mac_address: ipMac.trim() || null,
        assignment_type: ipType,
      }),
    onSuccess: () => {
      setError(null);
      setShowIpForm(false);
      setIpAddress("");
      setIpHostname("");
      setIpMac("");
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : he.siteNetworkError),
  });

  const unassignIp = useMutation({
    mutationFn: (ipId: string) => api.patchSiteIpAddress(workspaceId!, ipId, { clear_equipment: true }),
    onSuccess: () => invalidate(),
    onError: (err) => setError(err instanceof ApiClientError ? err.message : he.siteNetworkError),
  });

  const overview = overviewQuery.data;
  const vlans: SiteVlanOut[] = vlansQuery.data?.items ?? [];
  const networks: SiteNetworkOut[] = networksQuery.data?.items ?? [];
  const ips: SiteIpAddressOut[] = ipsQuery.data?.items ?? [];
  const vlanById = useMemo(() => new Map(vlans.map((v) => [v.id, v])), [vlans]);

  return (
    <div className="site-network-panel space-y-4" data-testid="site-network-panel">
      <section className="ops-panel space-y-3 p-5">
        <div>
          <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.siteNetworkKicker}</p>
          <h2 className="mt-1 text-base font-semibold text-fg">{he.siteTabNetwork}</h2>
          <p className="mt-1 text-xs text-fg-muted">{he.siteNetworkLead}</p>
        </div>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" data-testid="site-network-overview">
          {[
            [he.siteNetworkCountNetworks, overview?.networks ?? 0],
            [he.siteNetworkCountVlans, overview?.vlans ?? 0],
            [he.siteNetworkCountIps, overview?.ips ?? 0],
            [he.siteNetworkCountAssigned, overview?.assigned ?? 0],
            [he.siteNetworkCountAvailable, overview?.available ?? 0],
            [he.siteNetworkCountReserved, overview?.reserved ?? 0],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-md border border-border px-3 py-2">
              <dt className="text-[11px] text-fg-muted">{label}</dt>
              <dd className="public-mono mt-1 text-lg font-semibold text-fg" dir="ltr">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <section className="ops-panel space-y-3 p-5" data-testid="site-vlans-section">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-fg">{he.siteVlanTitle}</h3>
          {canEdit ? (
            <Button type="button" variant="secondary" className="min-h-11" onClick={() => setShowVlanForm((v) => !v)}>
              {he.siteVlanAdd}
            </Button>
          ) : null}
        </div>
        {showVlanForm ? (
          <form
            className="grid gap-2 sm:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              createVlan.mutate();
            }}
          >
            <Input id="vlan-number" label={he.siteVlanNumber} value={vlanNumber} onChange={(e) => setVlanNumber(e.target.value)} />
            <Input id="vlan-name" label={he.name} value={vlanName} onChange={(e) => setVlanName(e.target.value)} />
            <Input id="vlan-purpose" label={he.siteNetworkPurpose} value={vlanPurpose} onChange={(e) => setVlanPurpose(e.target.value)} />
            <div className="sm:col-span-3">
              <Button type="submit" loading={createVlan.isPending} className="min-h-11">
                {he.save}
              </Button>
            </div>
          </form>
        ) : null}
        <ul className="divide-y divide-border border-y border-border">
          {vlans.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>
                <span className="public-mono me-2 text-fg-muted" dir="ltr">
                  {v.vlan_number}
                </span>
                {v.name}
                {v.purpose ? <span className="ms-2 text-xs text-fg-muted">{v.purpose}</span> : null}
              </span>
            </li>
          ))}
          {!vlans.length ? <li className="py-4 text-sm text-fg-muted">{he.siteVlanEmpty}</li> : null}
        </ul>
      </section>

      <section className="ops-panel space-y-3 p-5" data-testid="site-networks-section">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-fg">{he.siteNetworksTitle}</h3>
          {canEdit ? (
            <Button type="button" variant="secondary" className="min-h-11" onClick={() => setShowNetForm((v) => !v)}>
              {he.siteNetworkAdd}
            </Button>
          ) : null}
        </div>
        {showNetForm ? (
          <form
            className="grid gap-2 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              createNetwork.mutate();
            }}
          >
            <Input id="net-name" label={he.name} value={netName} onChange={(e) => setNetName(e.target.value)} />
            <Input id="net-cidr" label="CIDR" value={netCidr} onChange={(e) => setNetCidr(e.target.value)} placeholder="10.10.20.0/24" />
            <Select id="net-vlan" label={he.siteVlanTitle} value={netVlanId} onChange={(e) => setNetVlanId(e.target.value)}>
              <option value="">{he.siteNetworkNoVlan}</option>
              {vlans.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vlan_number} — {v.name}
                </option>
              ))}
            </Select>
            <Input id="net-gw" label={he.siteNetworkGateway} value={netGateway} onChange={(e) => setNetGateway(e.target.value)} />
            <Input id="net-purpose" label={he.siteNetworkPurpose} value={netPurpose} onChange={(e) => setNetPurpose(e.target.value)} />
            <div className="sm:col-span-2">
              <Button type="submit" loading={createNetwork.isPending} className="min-h-11">
                {he.save}
              </Button>
            </div>
          </form>
        ) : null}
        <ul className="divide-y divide-border border-y border-border">
          {networks.map((n) => {
            const vlan = n.vlan_id ? vlanById.get(n.vlan_id) : null;
            return (
              <li key={n.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-fg">{n.name}</p>
                    <p className="public-mono mt-0.5 text-xs text-fg-muted" dir="ltr">
                      {n.cidr}
                      {vlan ? ` · VLAN ${vlan.vlan_number}` : ""}
                      {n.gateway ? ` · gw ${n.gateway}` : ""}
                    </p>
                    {n.purpose ? <p className="mt-0.5 text-xs text-fg-muted">{n.purpose}</p> : null}
                  </div>
                  <p className="text-xs text-fg-muted">
                    {he.siteNetworkAssignedCount(n.assigned_count ?? 0, n.ip_count ?? 0)}
                  </p>
                </div>
              </li>
            );
          })}
          {!networks.length ? <li className="py-4 text-sm text-fg-muted">{he.siteNetworkEmpty}</li> : null}
        </ul>
      </section>

      <section className="ops-panel space-y-3 p-5" data-testid="site-ipam-section">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-fg">{he.siteIpamTitle}</h3>
          {canEdit ? (
            <Button type="button" variant="secondary" className="min-h-11" onClick={() => setShowIpForm((v) => !v)}>
              {he.siteIpAdd}
            </Button>
          ) : null}
        </div>
        <Input
          id="ip-search"
          label={he.siteAssetsSearch}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={he.siteIpamSearchHint}
        />
        {showIpForm ? (
          <form
            className="grid gap-2 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              createIp.mutate();
            }}
          >
            <Select id="ip-network" label={he.siteNetworksTitle} value={ipNetworkId} onChange={(e) => setIpNetworkId(e.target.value)}>
              <option value="">{he.siteNetworkPick}</option>
              {networks.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} ({n.cidr})
                </option>
              ))}
            </Select>
            <Input id="ip-addr" label="IP" value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} />
            <Select id="ip-asset" label={he.siteTabAssets} value={ipEquipmentId} onChange={(e) => setIpEquipmentId(e.target.value)}>
              <option value="">{he.siteIpUnassigned}</option>
              {equipment.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {[eq.asset_code, eq.name].filter(Boolean).join(" · ")}
                </option>
              ))}
            </Select>
            <Select id="ip-type" label={he.siteIpAssignmentType} value={ipType} onChange={(e) => setIpType(e.target.value)}>
              <option value="static">{he.siteIpTypeStatic}</option>
              <option value="dhcp">{he.siteIpTypeDhcp}</option>
              <option value="reserved">{he.siteIpTypeReserved}</option>
            </Select>
            <Input id="ip-host" label={he.siteIpHostname} value={ipHostname} onChange={(e) => setIpHostname(e.target.value)} />
            <Input id="ip-mac" label="MAC" value={ipMac} onChange={(e) => setIpMac(e.target.value)} />
            <div className="sm:col-span-2">
              <Button type="submit" loading={createIp.isPending} disabled={!ipNetworkId || !ipAddress.trim()} className="min-h-11">
                {he.save}
              </Button>
            </div>
          </form>
        ) : null}

        <div className="hidden md:block overflow-x-auto" data-testid="site-ipam-table">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-start text-xs text-fg-muted">
                <th className="py-2 pe-3 font-medium">IP</th>
                <th className="py-2 pe-3 font-medium">{he.status}</th>
                <th className="py-2 pe-3 font-medium">{he.siteIpAssignmentType}</th>
                <th className="py-2 pe-3 font-medium">{he.siteTabAssets}</th>
                <th className="py-2 pe-3 font-medium">{he.siteIpHostname}</th>
                <th className="py-2 pe-3 font-medium">MAC</th>
                <th className="py-2 pe-3 font-medium">{he.siteNetworksTitle}</th>
                <th className="py-2 font-medium">{he.siteVlanTitle}</th>
              </tr>
            </thead>
            <tbody>
              {ips.map((row) => (
                <tr key={row.id} className="border-b border-border/80">
                  <td className="py-2 pe-3">
                    <span className="public-mono text-xs" dir="ltr">
                      {row.ip_address}
                    </span>
                  </td>
                  <td className="py-2 pe-3">
                    <Status label={he.siteIpStatuses[row.status as keyof typeof he.siteIpStatuses] ?? row.status} tone={ipStatusTone(row.status)} />
                  </td>
                  <td className="py-2 pe-3 text-fg-muted">
                    {he.siteIpTypes[row.assignment_type as keyof typeof he.siteIpTypes] ?? row.assignment_type}
                  </td>
                  <td className="py-2 pe-3">
                    {row.equipment_id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to="/app/sites/$siteId/assets/$assetId"
                          params={{ siteId, assetId: row.equipment_id }}
                          className="hover:underline"
                        >
                          {[row.equipment_asset_code, row.equipment_name].filter(Boolean).join(" · ") || "—"}
                        </Link>
                        {canEdit ? (
                          <Button
                            type="button"
                            variant="ghost"
                            className="min-h-11 px-2 text-xs"
                            onClick={() => unassignIp.mutate(row.id)}
                          >
                            {he.siteIpUnassign}
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2 pe-3 public-mono text-xs" dir="ltr">
                    {row.hostname || "—"}
                  </td>
                  <td className="py-2 pe-3 public-mono text-xs" dir="ltr">
                    {row.mac_address || "—"}
                  </td>
                  <td className="py-2 pe-3 text-fg-muted">{row.network_name || "—"}</td>
                  <td className="py-2 text-fg-muted">
                    {row.vlan_number != null ? `${row.vlan_number}${row.vlan_name ? ` — ${row.vlan_name}` : ""}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!ips.length ? <p className="py-4 text-sm text-fg-muted">{he.siteIpamEmpty}</p> : null}
        </div>

        <ul className="space-y-2 md:hidden" data-testid="site-ipam-cards">
          {ips.map((row) => (
            <li key={row.id} className="rounded-md border border-border px-3 py-3">
              <div className="flex items-start justify-between gap-2">
                <span className="public-mono text-sm font-semibold" dir="ltr">
                  {row.ip_address}
                </span>
                <Status label={he.siteIpStatuses[row.status as keyof typeof he.siteIpStatuses] ?? row.status} tone={ipStatusTone(row.status)} />
              </div>
              <p className="mt-1 text-xs text-fg-muted">
                {[row.network_name, row.vlan_number != null ? `VLAN ${row.vlan_number}` : null, row.hostname]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </p>
              {row.equipment_id ? (
                <Link
                  to="/app/sites/$siteId/assets/$assetId"
                  params={{ siteId, assetId: row.equipment_id }}
                  className="mt-2 inline-flex min-h-11 items-center text-sm hover:underline"
                >
                  {[row.equipment_asset_code, row.equipment_name].filter(Boolean).join(" · ")}
                </Link>
              ) : null}
            </li>
          ))}
          {!ips.length ? <li className="py-4 text-sm text-fg-muted">{he.siteIpamEmpty}</li> : null}
        </ul>
      </section>
    </div>
  );
}
