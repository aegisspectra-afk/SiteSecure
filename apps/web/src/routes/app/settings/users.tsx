import { Button, EmptyState, ErrorState, Input, PageHeader, Select, Status, Table, TBody, TD, TH, THead, TR } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { ApiClientError } from "@site-secure/api-client";
import { assignableInviteRoles, seatBucket } from "@site-secure/authz";
import type { WorkspaceUsageMeter } from "@site-secure/api-client";
import { planLabel, roleLabel } from "../../../lib/app-nav";
import { can } from "../../../lib/can";
import { useSession } from "../../../lib/session";
import { formatStorageBytes } from "../../../lib/ux-metrics";

function formatMeterUsage(row: WorkspaceUsageMeter): string {
  if (row.unlimited) return he.usersUsageUnlimited;
  if (row.unit === "bytes") {
    return `${formatStorageBytes(row.current)} / ${formatStorageBytes(row.limit)}`;
  }
  return `${row.current} / ${row.limit}`;
}

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
  const grants = membership?.permissions ?? null;
  const canInvite = can(membership?.role_key, "users.invite", membership?.features ?? [], grants);
  const canManage = can(membership?.role_key, "users.manage", membership?.features ?? [], grants);
  const [email, setEmail] = useState("");
  const [roleKey, setRoleKey] = useState("technician");
  const [formError, setFormError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const query = useQuery({
    queryKey: ["members", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listMembers(workspaceId!),
  });
  const rolesQuery = useQuery({
    queryKey: ["workspace-roles", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listWorkspaceRoles(workspaceId!),
  });
  const usageQuery = useQuery({
    queryKey: ["usage", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getUsage(workspaceId!),
  });

  const meters = usageQuery.data?.meters ?? [];
  const selectedRole = rolesQuery.data?.find((r) => r.key === roleKey);
  const seatRoleKey = selectedRole?.base_role_key ?? roleKey;
  const seatMeter = meters.find((row) => row.key === seatBucket(seatRoleKey));
  const atSeatLimit = Boolean(seatMeter?.at_limit);

  const invite = useMutation({
    mutationFn: () =>
      api.createInvitation(workspaceId!, {
        email: email.trim(),
        role_key: selectedRole?.base_role_key ?? roleKey,
      }),
    onSuccess: (row) => {
      setEmail("");
      setRoleKey("technician");
      setFormError(null);
      setCopied(false);
      if (row.token) {
        setInviteLink(`${window.location.origin}/invite/${row.token}`);
      } else {
        setInviteLink(null);
      }
      void queryClient.invalidateQueries({ queryKey: ["members", workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ["usage", workspaceId] });
    },
    onError: (err) => {
      if (err instanceof ApiClientError && err.code === "PLAN_LIMIT_REACHED") {
        setFormError(`${he.planLimitReached} ${he.planLimitHint}`);
        return;
      }
      setFormError(err instanceof ApiClientError ? err.message : he.sessionError);
    },
  });

  const patch = useMutation({
    mutationFn: (input: { id: string; workspace_role_key?: string; status?: "active" | "disabled" }) =>
      api.patchMember(workspaceId!, input.id, {
        workspace_role_key: input.workspace_role_key,
        status: input.status,
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["members", workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ["usage", workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ["workspace-roles", workspaceId] });
    },
  });

  function onInvite(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || atSeatLimit) return;
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

  const canAssignOwner = can(membership?.role_key, "workspace.delete", membership?.features ?? [], grants);
  const planInvite = new Set(assignableInviteRoles(membership?.plan_key));
  const workspaceRoles = rolesQuery.data ?? [];
  const inviteRoles = workspaceRoles
    .filter((role) => planInvite.has(role.base_role_key) && role.key !== "owner")
    .map((role) => ({ value: role.key, label: role.label_he, base: role.base_role_key }));
  const manageRoles = workspaceRoles
    .filter((role) => (canAssignOwner ? true : role.key !== "owner"))
    .map((role) => ({ value: role.key, label: role.label_he }));
  const usage = usageQuery.data?.meters ?? [];

  return (
    <div className="settings-panel flex flex-col gap-8">
      <PageHeader
        title={he.navUsers}
        description={`${planLabel(membership?.plan_key)} · ${he.usersLead}`}
      />
      <dl className="grid gap-3 sm:grid-cols-2">
        {usage.map((row) => (
          <div key={row.key} className="settings-locked-field">
            <dt className="settings-field-label">{row.label_he}</dt>
            <dd className="settings-locked-value">{formatMeterUsage(row)}</dd>
          </div>
        ))}
      </dl>
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
          <Button
            type="submit"
            variant="primary"
            loading={invite.isPending}
            disabled={atSeatLimit}
            className="h-11"
            aria-describedby={atSeatLimit ? "seat-limit-hint" : undefined}
          >
            {he.inviteUser}
          </Button>
        </form>
      ) : null}
      {canInvite && atSeatLimit ? (
        <p id="seat-limit-hint" className="text-sm text-fg-muted" role="status">
          {he.planLimitReached} {he.planLimitHint}
        </p>
      ) : null}
      {formError ? (
        <p className="text-sm text-danger" role="alert">
          {formError}
        </p>
      ) : null}
      {inviteLink ? (
        <div className="settings-locked-field">
          <p className="text-sm text-fg">{he.inviteLinkReady}</p>
          <p className="mt-2 break-all text-xs text-fg-muted ltr-meta">{inviteLink}</p>
          <Button
            type="button"
            variant="secondary"
            className="mt-3 h-9"
            onClick={() => {
              void navigator.clipboard.writeText(inviteLink).then(() => setCopied(true));
            }}
          >
            {copied ? he.inviteCopied : he.inviteCopyLink}
          </Button>
        </div>
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
              {canManage ? <TH>{he.actions}</TH> : null}
            </TR>
          </THead>
          <TBody>
            {query.data.map((member) => {
              const effectiveRole = member.workspace_role_key || member.role_key;
              const roleName =
                workspaceRoles.find((r) => r.key === effectiveRole)?.label_he ?? roleLabel(member.role_key);
              return (
                <TR key={member.id}>
                  <TD>{member.full_name || "—"}</TD>
                  <TD className="ltr-meta">{member.email || "—"}</TD>
                  <TD>
                    {canManage && member.user_id !== session?.user_id ? (
                      <select
                        className="min-h-9 rounded-[var(--radius-control)] border border-border bg-transparent px-2 text-sm"
                        value={effectiveRole}
                        onChange={(ev) =>
                          patch.mutate({ id: member.id, workspace_role_key: ev.target.value })
                        }
                        aria-label={he.changeRole}
                      >
                        {manageRoles.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      roleName
                    )}
                  </TD>
                  <TD>
                    <Status
                      label={member.status === "active" ? he.statusActive : he.statusDisabled}
                      tone={member.status === "active" ? "success" : "neutral"}
                    />
                  </TD>
                  {canManage ? (
                    <TD>
                      {member.user_id !== session?.user_id ? (
                        <button
                          type="button"
                          className="settings-text-btn"
                          onClick={() =>
                            patch.mutate({
                              id: member.id,
                              status: member.status === "active" ? "disabled" : "active",
                            })
                          }
                        >
                          {member.status === "active" ? he.deactivateUser : he.activateUser}
                        </button>
                      ) : (
                        "—"
                      )}
                    </TD>
                  ) : null}
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}
    </div>
  );
}
