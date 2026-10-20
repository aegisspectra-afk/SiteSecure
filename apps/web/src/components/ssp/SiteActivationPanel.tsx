import { Button, Card } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { he } from "../../i18n/he";
import { useSspWorkspace } from "./useSspWorkspace";

export function SiteActivationPanel({ siteId, canManage }: { siteId: string; canManage: boolean }) {
  const { api, workspaceId } = useSspWorkspace();
  const qc = useQueryClient();
  const [issued, setIssued] = useState<string | null>(null);
  const [joinPath, setJoinPath] = useState<string | null>(null);
  const [invitedRole, setInvitedRole] = useState<"patrol_officer" | "patrol_manager">("patrol_officer");
  const [msg, setMsg] = useState<string | null>(null);

  const codes = useQuery({
    queryKey: ["ssp-act-codes", workspaceId, siteId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspActivationCodes(workspaceId!, siteId),
    retry: false,
  });
  const devices = useQuery({
    queryKey: ["ssp-site-devices", workspaceId, siteId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspSiteDevices(workspaceId!, siteId),
    retry: false,
  });
  const enrollments = useQuery({
    queryKey: ["ssp-enrollments", workspaceId, siteId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspEnrollments(workspaceId!, { site_id: siteId }),
    retry: false,
  });

  const issue = useMutation({
    mutationFn: (audience: "device" | "user") =>
      api.issueSspActivationCode(workspaceId!, siteId, {
        audience,
        invited_role: audience === "user" ? invitedRole : undefined,
      }),
    onSuccess: async (row) => {
      setIssued(row.code || null);
      setJoinPath(row.join_path || null);
      await qc.invalidateQueries({ queryKey: ["ssp-act-codes", workspaceId, siteId] });
    },
    onError: (e: unknown) => setMsg(e instanceof Error ? e.message : he.apiUnavailable),
  });
  const revokeCode = useMutation({
    mutationFn: (id: string) => api.revokeSspActivationCode(workspaceId!, id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["ssp-act-codes", workspaceId, siteId] });
    },
  });
  const unlink = useMutation({
    mutationFn: (id: string) => api.revokeSspSiteDevice(workspaceId!, id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["ssp-site-devices", workspaceId, siteId] });
    },
    onError: (e: unknown) => setMsg(e instanceof Error ? e.message : he.apiUnavailable),
  });
  const revokeSession = useMutation({
    mutationFn: (id: string) => api.revokeSspSiteDeviceSession(workspaceId!, id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["ssp-site-devices", workspaceId, siteId] });
    },
    onError: (e: unknown) => setMsg(e instanceof Error ? e.message : he.apiUnavailable),
  });
  const decide = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "deny" | "cancel" }) => {
      if (action === "approve") return api.approveSspEnrollment(workspaceId!, id);
      if (action === "deny") return api.denySspEnrollment(workspaceId!, id);
      return api.cancelSspEnrollment(workspaceId!, id);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["ssp-enrollments", workspaceId, siteId] });
      await qc.invalidateQueries({ queryKey: ["ssp-site-devices", workspaceId, siteId] });
    },
    onError: (e: unknown) => setMsg(e instanceof Error ? e.message : he.apiUnavailable),
  });

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-fg">{he.sspCodesTitle}</h2>
        {canManage ? (
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-sm">
              <span>{he.sspInvitedRole}</span>
              <select
                className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
                value={invitedRole}
                onChange={(e) => setInvitedRole(e.target.value as typeof invitedRole)}
                aria-label={he.sspInvitedRole}
              >
                <option value="patrol_officer">{he.sspRoleOfficer}</option>
                <option value="patrol_manager">{he.sspRoleManager}</option>
              </select>
            </label>
            <Button type="button" onClick={() => issue.mutate("user")} disabled={issue.isPending}>
              {he.sspIssueUserJoin}
            </Button>
            <Button type="button" variant="secondary" onClick={() => issue.mutate("device")} disabled={issue.isPending}>
              {he.sspIssueActivationCode}
            </Button>
          </div>
        ) : null}
        {issued ? (
          <div className="rounded-md bg-bg-subtle p-3" data-testid="ssp-activation-code">
            <p className="text-xs text-fg-muted">{he.sspActivationCodeOnce}</p>
            <code className="mt-1 block text-lg tracking-widest">{issued}</code>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => void navigator.clipboard.writeText(issued)}>
                {he.sspActivationCodeCopy}
              </Button>
              {joinPath ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void navigator.clipboard.writeText(`${window.location.origin}${joinPath}`)}
                >
                  {he.sspJoinCopyLink}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
        {!codes.data?.items.length ? <p className="text-sm text-fg-muted">{he.sspNoItems}</p> : null}
        <ul className="divide-y divide-border text-sm">
          {(codes.data?.items ?? []).map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {c.audience === "user" ? he.sspAudienceUser : he.sspAudienceDevice} · {c.status} · {c.expires_at?.slice(0, 16)}
              </span>
              {canManage && c.status === "active" ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    if (!window.confirm(he.sspConfirmRevokeCode)) return;
                    revokeCode.mutate(c.id);
                  }}
                >
                  {he.sspRevokeCode}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-fg">{he.sspNavEnrollments}</h2>
        {!enrollments.data?.items.length ? <p className="text-sm text-fg-muted">{he.sspNoEnrollments}</p> : null}
        <ul className="divide-y divide-border text-sm">
          {(enrollments.data?.items ?? []).map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {e.audience === "user" ? he.sspAudienceUser : he.sspAudienceDevice} · {e.status} ·{" "}
                {e.requested_user_id || e.device_label || "—"} · {e.created_at.slice(0, 16)}
              </span>
              {canManage && e.status === "pending" ? (
                <div className="flex gap-2">
                  <Button type="button" onClick={() => decide.mutate({ id: e.id, action: "approve" })}>
                    {he.sspApproveEnrollment}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => decide.mutate({ id: e.id, action: "deny" })}>
                    {he.sspDenyEnrollment}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-fg">{he.sspDevicesTitle}</h2>
        {!devices.data?.items.length ? <p className="text-sm text-fg-muted">{he.sspNoDevices}</p> : null}
        <ul className="divide-y divide-border text-sm">
          {(devices.data?.items ?? []).map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {d.status} · {d.device_label || "—"} · {d.last_seen_at?.slice(0, 16) || "—"}
              </span>
              {canManage && d.status === "active" ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      if (!window.confirm(he.sspConfirmRevokeSession)) return;
                      revokeSession.mutate(d.id);
                    }}
                  >
                    {he.sspRevokeSession}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      if (!window.confirm(he.sspConfirmUnlinkDevice)) return;
                      unlink.mutate(d.id);
                    }}
                  >
                    {he.sspUnlinkDevice}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>
      {msg ? <p className="text-sm text-danger">{msg}</p> : null}
    </div>
  );
}
