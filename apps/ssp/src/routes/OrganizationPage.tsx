import { Button, ErrorState, Input, PageHeader } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { SspHubLinks } from "../components/SspHubLinks";
import { he } from "../i18n/he";
import { useOrg } from "../lib/org";
import { productRoleLabelHe } from "../lib/productAuthz";
import { useSession } from "../lib/session";

export function OrganizationPage() {
  const { api, workspaceId, session } = useSession();
  const { org, loading, sspCan, refresh, productRole } = useOrg();
  const queryClient = useQueryClient();
  const [companyName, setCompanyName] = useState("G1 Group");
  const [message, setMessage] = useState<string | null>(null);

  const canManageOrg = sspCan("ssp.org.manage");
  const canViewMembers = sspCan("ssp.members.view") || sspCan("ssp.members.manage");
  const workspaceRole = session?.memberships[0]?.role_key;
  const canBootstrap =
    !org?.company && (workspaceRole === "owner" || workspaceRole === "administrator");

  const units = useQuery({
    queryKey: ["ssp-org-units", workspaceId],
    enabled: Boolean(workspaceId) && sspCan("ssp.org.view") && Boolean(org?.company),
    queryFn: () => api.listSspOrgUnits(workspaceId!),
  });

  const departments = useQuery({
    queryKey: ["ssp-org-departments", workspaceId],
    enabled: Boolean(workspaceId) && sspCan("ssp.org.view") && Boolean(org?.company),
    queryFn: () => api.listSspDepartments(workspaceId!),
  });

  const members = useQuery({
    queryKey: ["ssp-org-members", workspaceId],
    enabled: Boolean(workspaceId) && canViewMembers,
    queryFn: () => api.listSspOrgMembers(workspaceId!),
  });

  const bootstrap = useMutation({
    mutationFn: () =>
      api.bootstrapSspCompany(workspaceId!, {
        name: companyName.trim() || "Company",
        root_unit_name: "מטה",
        patrol_department_name: "סיור",
      }),
    onSuccess: async () => {
      refresh();
      await queryClient.invalidateQueries({ queryKey: ["ssp-org-me", workspaceId] });
      setMessage(he.orgBootstrapOk);
    },
    onError: (e: unknown) => setMessage(e instanceof Error ? e.message : he.apiUnavailable),
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;
  if (loading) return <p className="text-sm text-fg-muted">{he.loading}</p>;

  return (
    <div className="flex flex-col gap-6" data-testid="ssp-org-page">
      <PageHeader title={he.orgTitle} description={he.orgLead} />
      <SspHubLinks
        items={[
          { to: "/users", label: he.navUsers },
          { to: "/templates", label: he.navTemplatesHub },
        ]}
      />

      <section className="rounded-lg border border-border p-4" data-testid="ssp-org-assignment">
        <h2 className="text-sm font-semibold text-fg">{he.orgMyAssignment}</h2>
        <dl className="mt-3 grid gap-2 text-sm">
          <div className="flex flex-wrap gap-2">
            <dt className="text-fg-muted">{he.orgCompany}:</dt>
            <dd className="text-fg">
              {org?.company
                ? `${org.company.name} (${org.company.company_id})`
                : he.orgNoCompany}
            </dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="text-fg-muted">{he.orgProductRole}:</dt>
            <dd className="text-fg" data-testid="ssp-product-role">
              {productRoleLabelHe(productRole)}
            </dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="text-fg-muted">{he.orgWorkspaceRole}:</dt>
            <dd className="text-fg">{org?.workspace_role_key ?? workspaceRole ?? "—"}</dd>
          </div>
        </dl>
      </section>

      {canBootstrap ? (
        <section className="rounded-lg border border-border p-4" data-testid="ssp-org-bootstrap">
          <h2 className="text-sm font-semibold text-fg">{he.orgBootstrap}</h2>
          <p className="mt-1 text-sm text-fg-muted">{he.orgBootstrapLead}</p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <Input
              id="ssp-org-company-name"
              label={he.orgCompanyName}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
            <Button type="button" onClick={() => bootstrap.mutate()} disabled={bootstrap.isPending}>
              {he.orgBootstrapAction}
            </Button>
          </div>
        </section>
      ) : null}

      {org?.company && sspCan("ssp.org.view") ? (
        <section className="rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold text-fg">{he.orgUnits}</h2>
          {!canManageOrg ? (
            <p className="mt-1 text-xs text-fg-muted">{he.orgManageHint}</p>
          ) : null}
          {units.isLoading ? <p className="mt-2 text-sm text-fg-muted">{he.loading}</p> : null}
          <ul className="mt-2 divide-y divide-border text-sm">
            {(units.data?.items ?? []).map((u) => (
              <li key={u.id} className="py-2">
                {u.name} <span className="text-fg-muted">({u.unit_type})</span>
              </li>
            ))}
          </ul>
          <h3 className="mt-4 text-sm font-semibold text-fg">{he.orgDepartments}</h3>
          <ul className="mt-2 divide-y divide-border text-sm">
            {(departments.data?.items ?? []).map((d) => (
              <li key={d.id} className="py-2">
                {d.name_he} <span className="text-fg-muted">({d.key})</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canViewMembers ? (
        <section className="rounded-lg border border-border p-4" data-testid="ssp-org-members">
          <h2 className="text-sm font-semibold text-fg">{he.orgMembers}</h2>
          {members.isLoading ? <p className="mt-2 text-sm text-fg-muted">{he.loading}</p> : null}
          <ul className="mt-2 divide-y divide-border text-sm">
            {(members.data?.items ?? []).map((m) => (
              <li key={m.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="font-mono text-xs text-fg-muted">{m.user_id.slice(0, 8)}…</span>
                <span>{productRoleLabelHe(m.product_role)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {message ? <p className="text-sm text-fg-muted">{message}</p> : null}
    </div>
  );
}
