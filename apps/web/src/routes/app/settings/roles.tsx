import { ErrorState, PageHeader, Table, TBody, TD, TH, THead, TR, Tabs } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { RequireAnyPermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { roleLabel } from "../../../lib/app-nav";
import { FOUNDATION_PERMISSIONS, permissionGroups, roleGranted } from "../../../lib/role-catalog";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/settings/roles")({
  component: RolesPage,
});

function RolesPage() {
  return (
    <RequireAnyPermission permissions={["users.view", "roles.manage"]}>
      <RolesBody />
    </RequireAnyPermission>
  );
}

function RolesBody() {
  const { api } = useSession();
  const query = useQuery({
    queryKey: ["authz-catalog"],
    queryFn: () => api.getAuthzCatalog(),
  });
  const [roleKey, setRoleKey] = useState("technician");

  if (query.isLoading) return <p className="text-sm text-fg-muted">{he.loading}</p>;
  if (query.isError || !query.data) return <ErrorState title={he.rolesError} />;

  const roles = query.data.roles;
  const selected = roles.some((role) => role.key === roleKey) ? roleKey : roles[0]?.key;
  const groups = permissionGroups();
  const selectedMeta = roles.find((role) => role.key === selected);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={he.rolesTitle} description={he.rolesLead} />
      <p className="text-sm text-fg-muted">{he.rolesReadOnly}</p>
      <Table>
        <THead>
          <TR>
            <TH>{he.role}</TH>
            {FOUNDATION_PERMISSIONS.map((key) => (
              <TH key={key} className="ltr-meta whitespace-nowrap">
                {key}
              </TH>
            ))}
          </TR>
        </THead>
        <TBody>
          {roles.map((role) => (
            <TR key={role.key}>
              <TD>{roleLabel(role.key)}</TD>
              {FOUNDATION_PERMISSIONS.map((key) => (
                <TD key={key} className="text-center">
                  <GrantMark granted={roleGranted(role.key, key)} />
                </TD>
              ))}
            </TR>
          ))}
        </TBody>
      </Table>
      <Tabs
        tabs={roles.map((role) => ({ id: role.key, label: roleLabel(role.key) }))}
        value={selected}
        onChange={setRoleKey}
      />
      <p className="text-sm text-fg-muted">
        {he.scope}: <span className="ltr-meta">{selectedMeta?.default_scope}</span>
      </p>
      {groups.map((group) => (
        <section key={group.group} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-fg">{groupLabel(group.group)}</h2>
          <Table>
            <THead>
              <TR>
                <TH>{he.permission}</TH>
                <TH>{he.granted}</TH>
              </TR>
            </THead>
            <TBody>
              {group.keys.map((key) => (
                <TR key={key}>
                  <TD className="ltr-meta">{key}</TD>
                  <TD>
                    <GrantMark granted={roleGranted(selected, key)} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </section>
      ))}
    </div>
  );
}

function GrantMark({ granted }: { granted: boolean }) {
  return (
    <span className={granted ? "font-semibold text-fg" : "text-fg-muted"} aria-label={granted ? he.permYes : he.permNo}>
      {granted ? he.permYes : he.permNo}
    </span>
  );
}

function groupLabel(group: string): string {
  return he.permissionGroups[group as keyof typeof he.permissionGroups] ?? group;
}
