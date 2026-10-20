import { Button, Input } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ErrorState, ModuleScaffold } from "../../../components/modules/ModuleKit";
import { RequireSspAction } from "../../../components/ssp/RequireSspAction";
import { SspHubLinks } from "../../../components/ssp/SspHubLinks";
import { useSspWorkspace } from "../../../components/ssp/useSspWorkspace";
import { he } from "../../../i18n/he";
import { useSession } from "../../../lib/session";
import { productRoleLabelHe } from "../../../lib/ssp-product-authz";

export const Route = createFileRoute("/app/ssp/organization")({
  component: () => (
    <RequireSspAction permission="ssp.org.view">
      <SspOrganizationPage />
    </RequireSspAction>
  ),
});

function SspOrganizationPage() {
  const { api, workspaceId, org, orgLoading, sspCan, productRole } = useSspWorkspace();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [companyName, setCompanyName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const workspaceRole = org?.workspace_role_key || session?.memberships[0]?.role_key || "";
  const canManageOrg = sspCan("ssp.org.manage");
  const canViewMembers = sspCan("ssp.members.view") || sspCan("ssp.members.manage");
  const canBootstrap = !org?.company && (workspaceRole === "owner" || workspaceRole === "administrator");

  const units = useQuery({
    queryKey: ["ssp-org-units", workspaceId],
    enabled: Boolean(workspaceId) && sspCan("ssp.org.view") && Boolean(org?.company),
    queryFn: () => api.listSspOrgUnits(workspaceId!),
    retry: false,
  });
  const departments = useQuery({
    queryKey: ["ssp-org-departments", workspaceId],
    enabled: Boolean(workspaceId) && sspCan("ssp.org.view") && Boolean(org?.company),
    queryFn: () => api.listSspDepartments(workspaceId!),
    retry: false,
  });
  const members = useQuery({
    queryKey: ["ssp-org-members", workspaceId],
    enabled: Boolean(workspaceId) && canViewMembers,
    queryFn: () => api.listSspOrgMembers(workspaceId!),
    retry: false,
  });
  const bootstrap = useMutation({
    mutationFn: () =>
      api.bootstrapSspCompany(workspaceId!, {
        name: companyName.trim() || "Company",
        root_unit_name: "מטה",
        patrol_department_name: "סיור",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ssp-org-me", workspaceId] });
      setMessage("החברה נוצרה");
    },
    onError: (e: unknown) => setMessage(e instanceof Error ? e.message : he.apiUnavailable),
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;
  if (orgLoading) return <p className="text-sm text-fg-muted">{he.loading}</p>;

  return (
    <div data-testid="ssp-org-page">
      <ModuleScaffold title={he.sspOrgTitle} lead={he.sspOrgLead}>
        <SspHubLinks
          items={[
            { to: "/app/ssp/users", label: he.sspNavUsers },
            { to: "/app/ssp/templates", label: he.sspNavTemplatesHub },
          ]}
        />
        <section className="ops-card p-4">
          <h2 className="text-sm font-semibold text-fg">השיוך שלי</h2>
          <dl className="mt-3 grid gap-2 text-sm">
            <div className="flex flex-wrap gap-2">
              <dt className="text-fg-muted">חברה:</dt>
              <dd>{org?.company ? `${org.company.name} (${org.company.company_id})` : "טרם הוגדרה חברת SSP"}</dd>
            </div>
            <div className="flex flex-wrap gap-2">
              <dt className="text-fg-muted">תפקיד מוצר:</dt>
              <dd>{productRoleLabelHe(productRole)}</dd>
            </div>
            <div className="flex flex-wrap gap-2">
              <dt className="text-fg-muted">תפקיד workspace:</dt>
              <dd>{org?.workspace_role_key || "—"}</dd>
            </div>
          </dl>
        </section>
        {canBootstrap ? (
          <section className="ops-card p-4" data-testid="ssp-org-bootstrap">
            <h2 className="text-sm font-semibold text-fg">הקמת חברה ראשונית</h2>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Input
                id="ssp-org-company-name"
                label="שם החברה"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
              <Button type="button" onClick={() => bootstrap.mutate()} disabled={bootstrap.isPending}>
                הקמת חברה
              </Button>
            </div>
          </section>
        ) : null}
        {org?.company && sspCan("ssp.org.view") ? (
          <section className="ops-card p-4">
            <h2 className="text-sm font-semibold text-fg">יחידות ארגוניות</h2>
            {!canManageOrg ? <p className="mt-1 text-xs text-fg-muted">יצירת יחידות דורשת מנהל ארגון.</p> : null}
            <ul className="mt-2 divide-y divide-border text-sm">
              {(units.data?.items ?? []).map((unit) => (
                <li key={unit.id} className="py-2">
                  {unit.name} <span className="text-fg-muted">({unit.unit_type})</span>
                </li>
              ))}
            </ul>
            <h3 className="mt-4 text-sm font-semibold text-fg">מחלקות</h3>
            <ul className="mt-2 divide-y divide-border text-sm">
              {(departments.data?.items ?? []).map((dept) => (
                <li key={dept.id} className="py-2">
                  {dept.name_he} <span className="text-fg-muted">({dept.key})</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {canViewMembers ? (
          <section className="ops-card p-4" data-testid="ssp-org-members">
            <h2 className="text-sm font-semibold text-fg">חברי מוצר</h2>
            <ul className="mt-2 divide-y divide-border text-sm">
              {(members.data?.items ?? []).map((member) => (
                <li key={member.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span className="font-mono text-xs text-fg-muted">{member.user_id.slice(0, 8)}…</span>
                  <span>{productRoleLabelHe(member.product_role)}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {message ? <p className="text-sm text-fg-muted">{message}</p> : null}
      </ModuleScaffold>
    </div>
  );
}
