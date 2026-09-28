import { ApiClientError } from "@site-secure/api-client";
import { Button, Input, PageHeader, Select } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { he } from "../../i18n/he";
import { useSession } from "../../lib/session";

export const Route = createFileRoute("/admin/invitations")({
  component: AdminInvitations,
});

const ROLE_OPTIONS = [
  { value: "owner", label: he.adminInviteRoleOwner },
  { value: "technician", label: he.adminInviteRoleTechnician },
  { value: "manager", label: he.adminInviteRoleManager },
  { value: "sales", label: he.adminInviteRoleSales },
  { value: "viewer", label: he.adminInviteRoleViewer },
];

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("he-IL");
}

function statusLabel(status: string) {
  switch (status) {
    case "pending":
      return he.adminInviteStatusPending;
    case "accepted":
      return he.adminInviteStatusAccepted;
    case "expired":
      return he.adminInviteStatusExpired;
    case "revoked":
      return he.adminInviteStatusRevoked;
    default:
      return status;
  }
}

function AdminInvitations() {
  const { api } = useSession();
  const queryClient = useQueryClient();
  const [workspaceId, setWorkspaceId] = useState("");
  const [email, setEmail] = useState("");
  const [roleKey, setRoleKey] = useState("owner");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lastLink, setLastLink] = useState<string | null>(null);

  const orgs = useQuery({ queryKey: ["admin-orgs"], queryFn: () => api.adminOrganizations() });
  const invites = useQuery({
    queryKey: ["admin-invitations", workspaceId],
    queryFn: () => api.adminInvitations({ workspace_id: workspaceId || undefined }),
  });

  const createInvite = useMutation({
    mutationFn: () =>
      api.adminCreateInvitation({
        workspace_id: workspaceId,
        email: email.trim(),
        role_key: roleKey,
      }),
    onSuccess: (row) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-invitations"] });
      if (row.token) {
        const link = `${window.location.origin}/invite/${row.token}`;
        setLastLink(link);
        void navigator.clipboard.writeText(link).then(() => setCopiedId(row.id));
      }
      setEmail("");
    },
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.adminRevokeInvitation(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-invitations"] }),
  });

  const reissue = useMutation({
    mutationFn: (id: string) => api.adminReissueInvitation(id),
    onSuccess: (row) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-invitations"] });
      if (row.token) {
        const link = `${window.location.origin}/invite/${row.token}`;
        setLastLink(link);
        void navigator.clipboard.writeText(link).then(() => setCopiedId(row.id));
      }
    },
  });

  const orgOptions = useMemo(
    () =>
      (orgs.data ?? []).map((org) => ({
        value: org.id,
        label: `${org.name}${org.is_beta ? " · beta" : ""}`,
      })),
    [orgs.data],
  );

  const createError =
    createInvite.error instanceof ApiClientError
      ? createInvite.error.message
      : createInvite.isError
        ? he.adminInviteCreateError
        : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={he.adminInvitations} description={he.adminInvitationsLead} />

      <section className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-border p-4">
        <h2 className="text-sm font-semibold text-fg">{he.adminInviteCreateTitle}</h2>
        <Select
          id="admin-invite-workspace"
          label={he.adminInviteWorkspace}
          value={workspaceId}
          onChange={(ev) => setWorkspaceId(ev.target.value)}
        >
          <option value="">{he.adminInviteWorkspacePlaceholder}</option>
          {orgOptions.map((org) => (
            <option key={org.value} value={org.value}>
              {org.label}
            </option>
          ))}
        </Select>
        <Input
          id="admin-invite-email"
          label={he.email}
          type="email"
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          placeholder="tech@example.com"
        />
        <Select
          id="admin-invite-role"
          label={he.role}
          value={roleKey}
          onChange={(ev) => setRoleKey(ev.target.value)}
        >
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
        <p className="text-xs text-fg-muted">{he.adminInviteRoleHint}</p>
        {createError ? (
          <p className="text-sm text-danger" role="alert">
            {createError}
          </p>
        ) : null}
        <Button
          variant="primary"
          disabled={!workspaceId || email.trim().length < 3}
          loading={createInvite.isPending}
          onClick={() => createInvite.mutate()}
        >
          {he.adminInviteCreateCta}
        </Button>
        {lastLink ? (
          <div className="rounded-[var(--radius-control)] border border-border bg-bg px-3 py-2">
            <p className="mb-1 text-xs text-fg-muted">{he.adminInviteLinkCopied}</p>
            <p className="ltr-meta break-all text-sm text-fg">{lastLink}</p>
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-fg">{he.adminInviteListTitle}</h2>
        {invites.isLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
        {invites.isError ? <p className="text-sm text-danger">{he.adminInviteListError}</p> : null}
        {!invites.isLoading && (invites.data ?? []).length === 0 ? (
          <p className="text-sm text-fg-muted">{he.adminInviteListEmpty}</p>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-start text-sm">
            <thead className="text-xs text-fg-muted">
              <tr>
                <th className="py-2 font-medium">{he.email}</th>
                <th className="py-2 font-medium">{he.adminInviteWorkspace}</th>
                <th className="py-2 font-medium">{he.role}</th>
                <th className="py-2 font-medium">{he.adminInviteCreated}</th>
                <th className="py-2 font-medium">{he.adminInviteExpires}</th>
                <th className="py-2 font-medium">{he.adminStatus}</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {(invites.data ?? []).map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="ltr-meta py-3 text-fg">{row.email}</td>
                  <td className="py-3 text-fg-muted">{row.workspace_name ?? "—"}</td>
                  <td className="py-3 text-fg-muted">{row.role_key}</td>
                  <td className="ltr-meta py-3 text-fg-muted">{formatDate(row.created_at)}</td>
                  <td className="ltr-meta py-3 text-fg-muted">{formatDate(row.expires_at)}</td>
                  <td className="py-3 text-fg-muted">{statusLabel(row.status)}</td>
                  <td className="py-3 text-end">
                    <div className="flex flex-wrap justify-end gap-2">
                      {row.status === "pending" ? (
                        <>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              void reissue.mutateAsync(row.id);
                            }}
                          >
                            {copiedId === row.id ? he.adminInviteCopied : he.adminInviteReissue}
                          </Button>
                          <Button variant="ghost" onClick={() => revoke.mutate(row.id)}>
                            {he.adminInviteRevoke}
                          </Button>
                        </>
                      ) : row.status === "revoked" || row.status === "expired" ? (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            void reissue.mutateAsync(row.id);
                          }}
                        >
                          {copiedId === row.id ? he.adminInviteCopied : he.adminInviteReissue}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
