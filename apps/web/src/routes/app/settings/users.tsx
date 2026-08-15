import { Button, EmptyState, ErrorState, Input, PageHeader, Select, Status, Table, TBody, TD, TH, THead, TR } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { ApiClientError } from "@site-secure/api-client";
import { roleLabel } from "../../../lib/app-nav";
import { can } from "../../../lib/can";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/settings/users")({
  component: UsersPage,
});

function UsersPage() {
  return (
    <RequirePermission permission="users.view">
      <UsersBody />
    </RequirePermission>
  );
}

function UsersBody() {
  const { session, api } = useSession();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const queryClient = useQueryClient();
  const canInvite = can(membership?.role_key, "users.invite", membership?.features ?? []);
  const canManage = can(membership?.role_key, "users.manage", membership?.features ?? []);
  const [email, setEmail] = useState("");
  const [roleKey, setRoleKey] = useState("technician");
  const [formError, setFormError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["members", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listMembers(workspaceId!),
  });

  const invite = useMutation({
    mutationFn: () => api.createInvitation(workspaceId!, { email: email.trim(), role_key: roleKey }),
    onSuccess: () => {
      setEmail("");
      setRoleKey("technician");
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ["members", workspaceId] });
    },
    onError: (err) => {
      setFormError(err instanceof ApiClientError ? err.message : he.sessionError);
    },
  });

  const patch = useMutation({
    mutationFn: (input: { id: string; role_key: string }) =>
      api.patchMember(workspaceId!, input.id, { role_key: input.role_key }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["members", workspaceId] }),
  });

  function onInvite(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    invite.mutate();
  }

  if (!workspaceId) return <ErrorState title={he.sessionError} />;
  if (query.isLoading) return <p className="text-sm text-fg-muted">{he.loading}</p>;
  if (query.isError || !query.data) {
    return (
      <ErrorState
        title={he.usersError}
        action={
          <Button variant="secondary" onClick={() => void query.refetch()}>
            {he.retry}
          </Button>
        }
      />
    );
  }

  const inviteRoles =
    membership?.plan_key === "solo"
      ? [
          { value: "technician", label: roleLabel("technician") },
          { value: "founding_technician", label: roleLabel("founding_technician") },
          { value: "viewer", label: roleLabel("viewer") },
        ]
      : [
          { value: "technician", label: roleLabel("technician") },
          { value: "founding_technician", label: roleLabel("founding_technician") },
          { value: "viewer", label: roleLabel("viewer") },
          { value: "sales", label: roleLabel("sales") },
          { value: "manager", label: roleLabel("manager") },
          { value: "administrator", label: roleLabel("administrator") },
        ];
  const manageRoles =
    membership?.role_key === "owner"
      ? [...inviteRoles, { value: "owner", label: roleLabel("owner") }]
      : inviteRoles;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={he.usersTitle} description={he.usersLead} />
      {canInvite ? (
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={onInvite}>
          <Input
            id="invite-email"
            label={he.email}
            type="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            className="ltr-meta min-h-11 sm:w-72"
          />
          <Select
            id="invite-role"
            label={he.role}
            value={roleKey}
            onChange={(ev) => setRoleKey(ev.target.value)}
          >
            {inviteRoles.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="primary" loading={invite.isPending} className="h-11">
            {he.inviteUser}
          </Button>
        </form>
      ) : null}
      {formError ? (
        <p className="text-sm text-danger" role="alert">
          {formError}
        </p>
      ) : null}
      {query.data.length === 0 ? (
        <EmptyState title={he.usersEmpty} />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{he.fullName}</TH>
              <TH>{he.email}</TH>
              <TH>{he.role}</TH>
              <TH>{he.status}</TH>
            </TR>
          </THead>
          <TBody>
            {query.data.map((member) => (
              <TR key={member.id}>
                <TD>{member.full_name || "—"}</TD>
                <TD className="ltr-meta">{member.email || "—"}</TD>
                <TD>
                  {canManage && member.user_id !== session?.user_id ? (
                    <select
                      className="min-h-9 rounded-[var(--radius-control)] border border-border bg-transparent px-2 text-sm"
                      value={member.role_key}
                      onChange={(ev) => patch.mutate({ id: member.id, role_key: ev.target.value })}
                      aria-label={he.changeRole}
                    >
                      {manageRoles.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    roleLabel(member.role_key)
                  )}
                </TD>
                <TD>
                  <Status
                    label={member.status === "active" ? he.statusActive : he.statusDisabled}
                    tone={member.status === "active" ? "success" : "neutral"}
                  />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
