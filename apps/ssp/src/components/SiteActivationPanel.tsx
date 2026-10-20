import { Button } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { he } from "../i18n/he";
import { useSession } from "../lib/session";

export function SiteActivationPanel({ siteId, canManage }: { siteId: string; canManage: boolean }) {
  const { api, workspaceId } = useSession();
  const qc = useQueryClient();
  const [issued, setIssued] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const codes = useQuery({
    queryKey: ["ssp-act-codes", workspaceId, siteId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspActivationCodes(workspaceId!, siteId),
  });
  const devices = useQuery({
    queryKey: ["ssp-site-devices", workspaceId, siteId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspSiteDevices(workspaceId!, siteId),
  });
  const enrollments = useQuery({
    queryKey: ["ssp-enrollments", workspaceId, siteId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspEnrollments(workspaceId!, { site_id: siteId }),
  });

  const issue = useMutation({
    mutationFn: () => api.issueSspActivationCode(workspaceId!, siteId),
    onSuccess: async (row) => {
      setIssued(row.code || null);
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
      <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <h2 className="text-base font-semibold">{he.codesTitle}</h2>
        {canManage ? (
          <Button type="button" onClick={() => issue.mutate()} disabled={issue.isPending}>
            {he.issueActivationCode}
          </Button>
        ) : null}
        {issued ? (
          <div className="rounded-md bg-bg-subtle p-3" data-testid="ssp-activation-code">
            <p className="text-xs text-fg-muted">{he.activationCodeOnce}</p>
            <code className="mt-1 block text-lg tracking-widest">{issued}</code>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void navigator.clipboard.writeText(issued)}
            >
              {he.activationCodeCopy}
            </Button>
          </div>
        ) : null}
        {!codes.data?.items.length ? <p className="text-sm text-fg-muted">{he.noItems}</p> : null}
        <ul className="divide-y divide-border text-sm">
          {(codes.data?.items ?? []).map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {c.status} · {c.expires_at?.slice(0, 16)}
              </span>
              {canManage && c.status === "active" ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    if (!window.confirm(he.confirmRevokeCode)) return;
                    revokeCode.mutate(c.id);
                  }}
                >
                  {he.revokeCode}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <h2 className="text-base font-semibold">{he.navEnrollments}</h2>
        {!enrollments.data?.items.length ? <p className="text-sm text-fg-muted">{he.noEnrollments}</p> : null}
        <ul className="divide-y divide-border text-sm">
          {(enrollments.data?.items ?? []).map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {e.status} · {e.created_at.slice(0, 16)} · {e.device_label || "—"}
              </span>
              {canManage && e.status === "pending" ? (
                <div className="flex gap-2">
                  <Button type="button" onClick={() => decide.mutate({ id: e.id, action: "approve" })}>
                    {he.approveEnrollment}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => decide.mutate({ id: e.id, action: "deny" })}
                  >
                    {he.denyEnrollment}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <h2 className="text-base font-semibold">{he.devicesTitle}</h2>
        {!devices.data?.items.length ? <p className="text-sm text-fg-muted">{he.noDevices}</p> : null}
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
                      if (!window.confirm(he.confirmRevokeSession)) return;
                      revokeSession.mutate(d.id);
                    }}
                  >
                    {he.revokeSession}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      if (!window.confirm(he.confirmUnlinkDevice)) return;
                      unlink.mutate(d.id);
                    }}
                  >
                    {he.unlinkDevice}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      {msg ? <p className="text-sm text-danger">{msg}</p> : null}
    </div>
  );
}
