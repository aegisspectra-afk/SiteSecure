import { Button, ErrorState, Input, PageHeader } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { can } from "../../../lib/can";
import {
  RBAC_ACTIONS,
  RBAC_MODULES,
  RBAC_PERMISSION_MAP,
  type RbacAction,
  type RbacModule,
} from "../../../lib/settings-rbac-demo";
import { useSession } from "../../../lib/session";
import { planAllowsCustomRbac } from "@site-secure/authz";

export const Route = createFileRoute("/app/settings/roles")({
  component: RolesPage,
});

function RolesPage() {
  return (
    <RequirePermission permission="roles.manage">
      <RolesBody />
    </RequirePermission>
  );
}

function grantsToMatrix(grants: string[]): Record<RbacModule, Record<RbacAction, boolean | null>> {
  const all = grants.includes("*");
  const matrix = {} as Record<RbacModule, Record<RbacAction, boolean | null>>;
  for (const module of RBAC_MODULES) {
    matrix[module] = {} as Record<RbacAction, boolean | null>;
    for (const action of RBAC_ACTIONS) {
      const mapping = RBAC_PERMISSION_MAP[module][action];
      if (!mapping) {
        matrix[module][action] = null;
        continue;
      }
      const keys = Array.isArray(mapping) ? mapping : [mapping];
      matrix[module][action] = all || keys.every((key) => grants.includes(key));
    }
  }
  return matrix;
}

function matrixToGrants(matrix: Record<RbacModule, Record<RbacAction, boolean | null>>): string[] {
  const out = new Set<string>();
  for (const module of RBAC_MODULES) {
    for (const action of RBAC_ACTIONS) {
      const mapping = RBAC_PERMISSION_MAP[module][action];
      if (!mapping || !matrix[module][action]) continue;
      const keys = Array.isArray(mapping) ? mapping : [mapping];
      keys.forEach((key) => out.add(key));
    }
  }
  return [...out].sort();
}

function RolesBody() {
  const { session, api } = useSession();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const customRbac = planAllowsCustomRbac(membership?.plan_key);
  const canEdit = customRbac && can(
    membership?.role_key,
    "roles.manage",
    membership?.features ?? [],
    membership?.permissions,
  );
  const queryClient = useQueryClient();
  const [selectedKey, setSelectedKey] = useState<string>("owner");
  const [customName, setCustomName] = useState("");
  const [localMatrix, setLocalMatrix] = useState<Record<
    RbacModule,
    Record<RbacAction, boolean | null>
  > | null>(null);

  const rolesQuery = useQuery({
    queryKey: ["workspace-roles", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listWorkspaceRoles(workspaceId!),
  });

  const membersQuery = useQuery({
    queryKey: ["members", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listMembers(workspaceId!),
  });

  const roles = rolesQuery.data ?? [];
  const selected = roles.find((r) => r.key === selectedKey) ?? roles[0];

  const matrix = useMemo(() => {
    if (!selected) return null;
    if (localMatrix && selected.key === selectedKey) return localMatrix;
    return grantsToMatrix(selected.grants);
  }, [selected, localMatrix, selectedKey]);

  const assignedUsers = useMemo(() => {
    if (!selected || !membersQuery.data) return [];
    return membersQuery.data.filter(
      (m) => (m.workspace_role_key || m.role_key) === selected.key && m.status === "active",
    );
  }, [membersQuery.data, selected]);

  const saveRole = useMutation({
    mutationFn: async () => {
      if (!workspaceId || !selected || !matrix) return;
      const grants = selected.is_locked ? ["*"] : matrixToGrants(matrix);
      return api.patchWorkspaceRole(workspaceId, selected.id, { grants });
    },
    onSuccess: async () => {
      setLocalMatrix(null);
      await queryClient.invalidateQueries({ queryKey: ["workspace-roles", workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ["session"] });
    },
  });

  const createRole = useMutation({
    mutationFn: async () => {
      if (!workspaceId || !customName.trim()) return;
      return api.createWorkspaceRole(workspaceId, {
        label_he: customName.trim(),
        description: he.rbacCustomRoleDesc,
        base_role_key: "viewer",
      });
    },
    onSuccess: async (role) => {
      setCustomName("");
      await queryClient.invalidateQueries({ queryKey: ["workspace-roles", workspaceId] });
      if (role?.key) setSelectedKey(role.key);
    },
  });

  function selectRole(key: string) {
    setSelectedKey(key);
    setLocalMatrix(null);
  }

  function toggleCell(module: RbacModule, action: RbacAction) {
    if (!canEdit || !selected || selected.is_locked || !matrix) return;
    const current = matrix[module][action];
    if (current == null) return;
    const next = {
      ...matrix,
      [module]: { ...matrix[module], [action]: !current },
    };
    setLocalMatrix(next);
  }

  if (!workspaceId) return <ErrorState title={he.sessionError} />;
  if (rolesQuery.isLoading) return <p className="text-sm text-fg-muted">{he.loading}</p>;
  if (rolesQuery.isError || !selected || !matrix) return <ErrorState title={he.rolesError} />;

  return (
    <div className="settings-panel flex flex-col gap-5">
      <PageHeader title={he.settingsNavRoles} description={he.rbacLead} />
      <p className="settings-demo-note">
        {canEdit ? he.rbacPersistedNote : customRbac ? he.rbacReadOnly : he.rbacPlanLocked}
      </p>

      <div className="rbac-layout">
        <section className="rbac-roles" aria-label={he.rbacRolesListAria}>
          <h2 className="settings-section-title">{he.rbacRolesHeading}</h2>
          <ul className="rbac-role-list">
            {roles.map((role) => {
              const active = role.key === selected.key;
              return (
                <li key={role.id}>
                  <button
                    type="button"
                    className={`rbac-role-item${active ? " is-active" : ""}`}
                    onClick={() => selectRole(role.key)}
                    aria-pressed={active}
                  >
                    <span className="rbac-role-name">{role.label_he}</span>
                    <span className="rbac-role-meta">
                      {he.rbacUsersAssigned(role.users_count)}
                      {role.is_locked ? ` · ${he.rbacLocked}` : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {canEdit ? (
            <div className="rbac-create">
              <Input
                id="custom-role"
                label={he.rbacCreateRole}
                value={customName}
                onChange={(ev) => setCustomName(ev.target.value)}
                placeholder={he.rbacCreateRolePlaceholder}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => createRole.mutate()}
                disabled={!customName.trim() || createRole.isPending}
                loading={createRole.isPending}
              >
                {he.rbacAddRole}
              </Button>
            </div>
          ) : null}
        </section>

        <section className="rbac-detail" aria-labelledby="rbac-selected-heading">
          <div className="rbac-detail-head">
            <div>
              <h2 id="rbac-selected-heading" className="settings-section-title">
                {selected.label_he}
              </h2>
              <p className="settings-section-lead">{selected.description}</p>
            </div>
            {selected.is_locked ? <span className="rbac-lock-tag">{he.rbacFullAccess}</span> : null}
          </div>

          <div className="rbac-matrix-wrap">
            <table className="rbac-matrix">
              <thead>
                <tr>
                  <th scope="col">{he.rbacModule}</th>
                  {RBAC_ACTIONS.map((action) => (
                    <th key={action} scope="col">
                      {he.rbacActions[action]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RBAC_MODULES.map((module) => (
                  <tr key={module}>
                    <th scope="row">{he.rbacModules[module]}</th>
                    {RBAC_ACTIONS.map((action) => {
                      const value = matrix[module][action];
                      if (value == null) {
                        return (
                          <td key={action} className="rbac-cell is-na">
                            <span className="sr-only">{he.rbacNotApplicable}</span>
                            <span aria-hidden>—</span>
                          </td>
                        );
                      }
                      return (
                        <td key={action} className="rbac-cell">
                          <label className="rbac-check">
                            <input
                              type="checkbox"
                              checked={value}
                              disabled={!canEdit || selected.is_locked}
                              onChange={() => toggleCell(module, action)}
                              aria-label={`${he.rbacModules[module]} · ${he.rbacActions[action]}`}
                            />
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {canEdit && !selected.is_locked ? (
            <Button
              type="button"
              variant="primary"
              className="self-start"
              loading={saveRole.isPending}
              onClick={() => saveRole.mutate()}
            >
              {he.saveSettings}
            </Button>
          ) : null}

          <div className="rbac-users">
            <h3 className="settings-section-title">{he.rbacAssignedUsers}</h3>
            {assignedUsers.length ? (
              <ul className="rbac-user-list">
                {assignedUsers.map((user) => (
                  <li key={user.id} className="rbac-user-row">
                    <span>{user.full_name || user.email || user.user_id}</span>
                    {user.email ? <span className="ltr-meta text-fg-muted">{user.email}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-fg-muted">{he.rbacNoUsers}</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
