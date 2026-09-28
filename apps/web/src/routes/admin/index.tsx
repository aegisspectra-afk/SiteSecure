import { ApiClientError } from "@site-secure/api-client";
import { Button, Input } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { DashboardZone } from "../../components/dashboard/DashboardZone";
import { he } from "../../i18n/he";
import { WEB_BUILD } from "../../lib/app-version";
import { useSession } from "../../lib/session";

export const Route = createFileRoute("/admin/")({
  component: AdminHome,
});

function formatWhen(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("he-IL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("he-IL");
}

function inviteStatusLabel(status: string) {
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

function severityTone(severity?: string | null) {
  if (severity === "critical" || severity === "blocker") return "is-critical";
  if (severity === "high") return "is-high";
  if (severity === "medium") return "is-medium";
  return "is-low";
}

function systemLabel(status: "ok" | "attention" | "unavailable" | "disconnected") {
  switch (status) {
    case "ok":
      return he.adminStatusOk;
    case "attention":
      return he.adminStatusAttention;
    case "unavailable":
      return he.adminStatusUnavailable;
    default:
      return he.adminStatusDisconnected;
  }
}

function FoundingTechnicianOnboard({ onDone }: { onDone: () => void }) {
  const { api } = useSession();
  const [open, setOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaceLabel, setWorkspaceLabel] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [phaseError, setPhaseError] = useState<string | null>(null);

  const createWorkspace = useMutation({
    mutationFn: () =>
      api.adminCreateOrganization({
        name: workspaceName.trim(),
        plan_key: "business",
        is_beta: true,
        beta_program: "early",
        internal_note: "Founding Technician — ops center",
      }),
    onSuccess: (org) => {
      setWorkspaceId(org.id);
      setWorkspaceLabel(org.name);
      setPhaseError(null);
    },
    onError: (err) => {
      setPhaseError(err instanceof ApiClientError ? err.message : he.adminOrgCreateError);
    },
  });

  const createInvite = useMutation({
    mutationFn: (wsId: string) =>
      api.adminCreateInvitation({
        workspace_id: wsId,
        email: ownerEmail.trim(),
        role_key: "owner",
      }),
    onSuccess: (row) => {
      if (row.token) {
        const link = `${window.location.origin}/invite/${row.token}`;
        setInviteLink(link);
        void navigator.clipboard.writeText(link).then(() => setCopied(true));
      }
      setPhaseError(null);
      onDone();
    },
    onError: (err) => {
      setPhaseError(
        err instanceof ApiClientError
          ? `${he.adminFtInviteFailed} (${err.message})`
          : he.adminFtInviteFailed,
      );
    },
  });

  const reset = () => {
    setWorkspaceName("");
    setOwnerEmail("");
    setWorkspaceId(null);
    setWorkspaceLabel(null);
    setInviteLink(null);
    setCopied(false);
    setPhaseError(null);
    createWorkspace.reset();
    createInvite.reset();
  };

  if (!open) {
    return (
      <section className="admin-ft-cta" aria-labelledby="admin-ft-cta-title">
        <div className="admin-ft-cta-copy">
          <h2 id="admin-ft-cta-title" className="admin-ft-cta-title">
            {he.adminFtCta}
          </h2>
          <p className="admin-ft-cta-lead">{he.adminFtCtaLead}</p>
        </div>
        <Button variant="primary" className="admin-ft-cta-btn" onClick={() => setOpen(true)}>
          {he.adminFtCta}
        </Button>
      </section>
    );
  }

  const step =
    inviteLink && workspaceId ? 5 : workspaceId ? 4 : workspaceName.trim().length >= 2 && ownerEmail.includes("@") ? 3 : ownerEmail ? 2 : 1;

  return (
    <section className="admin-ft-panel" aria-labelledby="admin-ft-panel-title">
      <div className="admin-ft-panel-head">
        <h2 id="admin-ft-panel-title" className="admin-ft-panel-title">
          {he.adminFtCta}
        </h2>
        <Button
          variant="ghost"
          onClick={() => {
            setOpen(false);
            if (inviteLink) reset();
          }}
        >
          {he.feedbackClose}
        </Button>
      </div>

      <ol className="admin-ft-steps" aria-label={he.adminFtCta}>
        <li className={step >= 1 ? "is-done" : ""}>{he.adminFtStepWorkspace}</li>
        <li className={step >= 2 ? "is-done" : ""}>{he.adminFtStepEmail}</li>
        <li className={step >= 3 ? "is-done" : ""}>{he.adminFtStepCreate}</li>
        <li className={step >= 4 ? "is-done" : ""}>{he.adminFtStepInvite}</li>
        <li className={step >= 5 ? "is-done" : ""}>{he.adminFtStepLink}</li>
      </ol>

      {!workspaceId ? (
        <div className="admin-ft-form">
          <Input
            id="ft-workspace-name"
            label={he.adminFtStepWorkspace}
            value={workspaceName}
            onChange={(ev) => setWorkspaceName(ev.target.value)}
            placeholder={he.adminOrgNamePlaceholder}
          />
          <Input
            id="ft-owner-email"
            label={he.adminFtStepEmail}
            type="email"
            value={ownerEmail}
            onChange={(ev) => setOwnerEmail(ev.target.value)}
            placeholder="owner@example.com"
          />
          {phaseError ? (
            <p className="text-sm text-danger" role="alert">
              {phaseError}
            </p>
          ) : null}
          <Button
            variant="primary"
            disabled={workspaceName.trim().length < 2 || !ownerEmail.includes("@")}
            loading={createWorkspace.isPending}
            onClick={() => createWorkspace.mutate()}
          >
            {he.adminFtCreateWorkspace}
          </Button>
        </div>
      ) : !inviteLink ? (
        <div className="admin-ft-form">
          <p className="admin-ft-ok" role="status">
            {he.adminFtWorkspaceOk}
            {workspaceLabel ? ` — ${workspaceLabel}` : null}
          </p>
          <p className="text-xs text-fg-muted ltr-meta" dir="ltr">
            {he.adminFtPartialWorkspace}: {workspaceId}
          </p>
          <Input
            id="ft-owner-email-retry"
            label={he.adminFtStepEmail}
            type="email"
            value={ownerEmail}
            onChange={(ev) => setOwnerEmail(ev.target.value)}
          />
          {phaseError ? (
            <p className="text-sm text-danger" role="alert">
              {phaseError}
            </p>
          ) : null}
          <Button
            variant="primary"
            disabled={!ownerEmail.includes("@") || !workspaceId}
            loading={createInvite.isPending}
            onClick={() => workspaceId && createInvite.mutate(workspaceId)}
          >
            {phaseError ? he.adminFtRetryInvite : he.adminFtCreateInvite}
          </Button>
        </div>
      ) : (
        <div className="admin-ft-form">
          <p className="admin-ft-ok" role="status">
            {he.adminFtInviteOk}
          </p>
          <div className="admin-ft-link-box">
            <p className="text-xs text-fg-muted">{he.adminInviteLinkCopied}</p>
            <p className="ltr-meta break-all text-sm text-fg" dir="ltr">
              {inviteLink}
            </p>
          </div>
          <div className="admin-ft-link-actions">
            <Button
              variant="secondary"
              onClick={() => {
                if (!inviteLink) return;
                void navigator.clipboard.writeText(inviteLink).then(() => setCopied(true));
              }}
            >
              {copied ? he.adminInviteCopied : he.adminFtCopyLink}
            </Button>
            <a
              className="admin-ft-open-link"
              href={inviteLink}
              target="_blank"
              rel="noreferrer"
            >
              {he.adminFtOpenInvite}
            </a>
            <Button
              variant="primary"
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              {he.adminFtDone}
            </Button>
            <Button variant="ghost" onClick={reset}>
              {he.adminFtReset}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function AdminHome() {
  const { api } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin-summary"], queryFn: () => api.adminSummary() });
  const data = query.data;
  const errorMessage =
    query.error instanceof ApiClientError ? query.error.message : query.isError ? he.adminSummaryError : null;

  const revoke = useMutation({
    mutationFn: (id: string) => api.adminRevokeInvitation(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-invitations"] });
    },
  });
  const reissue = useMutation({
    mutationFn: (id: string) => api.adminReissueInvitation(id),
    onSuccess: (row) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-invitations"] });
      if (row.token) {
        const link = `${window.location.origin}/invite/${row.token}`;
        void navigator.clipboard.writeText(link);
      }
    },
  });

  const metrics: Array<{ key: string; label: string; value: number | undefined; to: string; warn?: boolean }> = [
    {
      key: "beta-active",
      label: he.adminMetricBetaActive,
      value: data?.beta_workspaces_active,
      to: "/admin/organizations",
    },
    {
      key: "ft",
      label: he.adminMetricFounding,
      value: data?.founding_technicians,
      to: "/admin/users",
    },
    {
      key: "pending",
      label: he.adminMetricInvitesPending,
      value: data?.invites_pending,
      to: "/admin/invitations",
      warn: (data?.invites_pending ?? 0) > 0,
    },
    {
      key: "expired",
      label: he.adminMetricInvitesExpired,
      value:
        data?.invites_expired !== undefined || data?.invites_revoked !== undefined
          ? (data?.invites_expired ?? 0) + (data?.invites_revoked ?? 0)
          : undefined,
      to: "/admin/invitations",
      warn: ((data?.invites_expired ?? 0) + (data?.invites_revoked ?? 0)) > 0,
    },
    {
      key: "feedback",
      label: he.adminMetricFeedbackOpen,
      value: data?.feedback_open,
      to: "/admin/feedback",
      warn: (data?.feedback_open ?? 0) > 0,
    },
    {
      key: "joined7d",
      label: he.adminMetricJoined7d,
      value: data?.joined_7d,
      to: "/admin/users",
    },
  ];

  const systemRows: Array<{ key: string; label: string; status: "ok" | "attention" | "unavailable" | "disconnected"; detail?: string }> = [
    {
      key: "api",
      label: he.adminSystemApi,
      status: query.isSuccess && data?.system?.api_ok ? "ok" : query.isError ? "attention" : "disconnected",
      detail: data?.system?.api_version ? `v${data.system.api_version.replace(/^v/, "")}` : undefined,
    },
    {
      key: "web",
      label: he.adminSystemWeb,
      status: "disconnected",
      detail: WEB_BUILD.version,
    },
    {
      key: "auth",
      label: he.adminSystemAuth,
      status: "disconnected",
    },
    {
      key: "backup",
      label: he.adminSystemBackup,
      status: "disconnected",
      detail: he.adminBackupDisconnected,
    },
    {
      key: "invite",
      label: he.adminSystemInviteFlow,
      status: "disconnected",
    },
    {
      key: "quote",
      label: he.adminSystemQuoteFlow,
      status: "disconnected",
    },
  ];

  const attention = data?.attention ?? [];
  const pending = data?.pending_invites ?? [];
  const workspaces = data?.beta_workspaces ?? [];
  const feedback = data?.open_feedback ?? [];
  const activity = data?.recent_activity ?? [];
  const funnel = data?.funnel;

  return (
    <div className="admin-beta-ops">
      <header className="admin-beta-ops-header">
        <p className="admin-beta-ops-brand">{he.brand}</p>
        <p className="admin-beta-ops-badge">{he.adminPlatformBadge}</p>
        <h1 className="admin-beta-ops-title">{he.adminOpsCenterTitle}</h1>
        <p className="admin-beta-ops-subtitle">{he.adminOpsCenterSubtitle}</p>
      </header>

      {errorMessage ? (
        <div className="ops-card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm text-danger">{errorMessage}</p>
          <Button type="button" variant="secondary" onClick={() => void query.refetch()}>
            {he.retry}
          </Button>
        </div>
      ) : null}

      <FoundingTechnicianOnboard
        onDone={() => {
          void queryClient.invalidateQueries({ queryKey: ["admin-summary"] });
          void queryClient.invalidateQueries({ queryKey: ["admin-orgs"] });
          void queryClient.invalidateQueries({ queryKey: ["admin-invitations"] });
        }}
      />

      <DashboardZone id="admin-system" label={he.adminSystemStatus} className="is-ops">
        <div className="admin-system-strip">
          {systemRows.map((row) => (
            <div key={row.key} className={`admin-system-row ${severityTone(row.status === "ok" ? "low" : row.status === "attention" ? "high" : "medium")}`}>
              <span className="admin-system-label">{row.label}</span>
              <span className={`admin-system-status is-${row.status}`}>{systemLabel(row.status)}</span>
              {row.detail ? (
                <span className="admin-system-detail ltr-meta" dir="ltr">
                  {row.detail}
                </span>
              ) : null}
            </div>
          ))}
        </div>
        <div className="admin-deploy-block">
          <p className="admin-deploy-title">{he.adminDeployBlock}</p>
          <dl className="admin-deploy-grid">
            <div>
              <dt>{he.adminDeployEnv}</dt>
              <dd className="ltr-meta" dir="ltr">
                {data?.system?.app_env ?? he.adminDeployUnavailable}
              </dd>
            </div>
            <div>
              <dt>{he.adminDeployWebVersion}</dt>
              <dd className="ltr-meta" dir="ltr">
                {WEB_BUILD.version}
              </dd>
            </div>
            <div>
              <dt>{he.adminDeployApiVersion}</dt>
              <dd className="ltr-meta" dir="ltr">
                {data?.system?.api_version ?? he.adminDeployUnavailable}
              </dd>
            </div>
            <div>
              <dt>{he.adminDeployGitSha}</dt>
              <dd className="ltr-meta" dir="ltr">
                {WEB_BUILD.gitSha ?? he.adminDeployUnavailable}
              </dd>
            </div>
          </dl>
        </div>
      </DashboardZone>

      <DashboardZone id="admin-attention" label={he.adminAttentionTitle} className="is-ops">
        {query.isLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
        {!query.isLoading && attention.length === 0 ? (
          <p className="text-sm text-fg-muted">{he.adminAttentionEmpty}</p>
        ) : null}
        <ul className="admin-attention-list">
          {attention.map((item) => (
            <li key={item.id} className={`admin-attention-item ${severityTone(item.severity)}`}>
              <div className="admin-attention-item-copy">
                <p className="admin-attention-item-title">{item.title}</p>
                {item.detail ? <p className="admin-attention-item-detail">{item.detail}</p> : null}
                <p className="admin-attention-item-meta ltr-meta" dir="ltr">
                  {formatWhen(item.created_at)}
                </p>
              </div>
              <button
                type="button"
                className="admin-attention-item-link"
                onClick={() => void navigate({ to: item.href })}
              >
                {he.adminAttentionOpen}
              </button>
            </li>
          ))}
        </ul>
      </DashboardZone>

      <DashboardZone id="admin-metrics" label={he.adminSummarySection} className="is-ops">
        <div className="admin-metric-grid">
          {metrics.map((m) => {
            const display =
              query.isLoading && m.value === undefined ? "…" : m.value === undefined ? "—" : String(m.value);
            return (
              <button
                type="button"
                key={m.key}
                className={`admin-metric-card${m.warn ? " is-warn" : ""}`}
                onClick={() => void navigate({ to: m.to })}
              >
                <span className="admin-metric-value tabular-nums ltr-meta" dir="ltr">
                  {display}
                </span>
                <span className="admin-metric-label">{m.label}</span>
              </button>
            );
          })}
        </div>
        {funnel ? (
          <div className="admin-funnel">
            <p className="admin-funnel-title">{he.adminFunnelTitle}</p>
            <div className="admin-funnel-steps">
              <div>
                <span className="admin-funnel-count tabular-nums ltr-meta" dir="ltr">
                  {funnel.beta_workspaces}
                </span>
                <span>{he.adminFunnelWorkspaces}</span>
              </div>
              <span className="admin-funnel-arrow" aria-hidden>
                →
              </span>
              <div>
                <span className="admin-funnel-count tabular-nums ltr-meta" dir="ltr">
                  {funnel.owner_invites}
                </span>
                <span>{he.adminFunnelOwnerInvites}</span>
              </div>
              <span className="admin-funnel-arrow" aria-hidden>
                →
              </span>
              <div>
                <span className="admin-funnel-count tabular-nums ltr-meta" dir="ltr">
                  {funnel.owner_accepted}
                </span>
                <span>{he.adminFunnelAccepted}</span>
              </div>
              <span className="admin-funnel-arrow" aria-hidden>
                /
              </span>
              <div>
                <span className="admin-funnel-count tabular-nums ltr-meta" dir="ltr">
                  {funnel.owner_pending}
                </span>
                <span>{he.adminFunnelPending}</span>
              </div>
            </div>
          </div>
        ) : null}
        {(data?.beta_participants_active !== undefined || data?.founding_technicians !== undefined) && (
          <div className="admin-cohort">
            <p className="admin-cohort-title">{he.adminCohortTitle}</p>
            <p className="admin-cohort-line">
              {he.adminCohortActive}:{" "}
              <span className="tabular-nums ltr-meta" dir="ltr">
                {data?.beta_participants_active ?? "—"}
              </span>
              {" · "}
              {he.adminCohortFt}:{" "}
              <span className="tabular-nums ltr-meta" dir="ltr">
                {data?.founding_technicians ?? "—"}
              </span>
            </p>
          </div>
        )}
      </DashboardZone>

      <DashboardZone id="admin-invites" label={he.adminInviteHealthTitle} className="is-ops">
        <div className="admin-invite-health">
          <span>
            {he.adminInviteHealthPending}{" "}
            <b className="tabular-nums ltr-meta" dir="ltr">
              {data?.invites_pending ?? "—"}
            </b>
          </span>
          <span>
            {he.adminInviteHealthAccepted}{" "}
            <b className="tabular-nums ltr-meta" dir="ltr">
              {data?.invites_accepted ?? "—"}
            </b>
          </span>
          <span>
            {he.adminInviteHealthExpired}{" "}
            <b className="tabular-nums ltr-meta" dir="ltr">
              {data?.invites_expired ?? "—"}
            </b>
          </span>
          <span>
            {he.adminInviteHealthRevoked}{" "}
            <b className="tabular-nums ltr-meta" dir="ltr">
              {data?.invites_revoked ?? "—"}
            </b>
          </span>
        </div>
        {pending.length === 0 && !query.isLoading ? (
          <p className="text-sm text-fg-muted">{he.adminInviteListEmpty}</p>
        ) : null}
        <ul className="admin-compact-list">
          {pending.map((inv) => (
            <li key={inv.id} className="admin-compact-card">
              <div className="admin-compact-main">
                <p className="admin-compact-title ltr-meta" dir="ltr">
                  {inv.email}
                </p>
                <p className="admin-compact-meta">
                  {inv.workspace_name ?? "—"} · {inv.role_key} · {inviteStatusLabel(String(inv.status))}
                  {inv.age_hours !== undefined ? ` · ${he.adminInviteAge} ${he.adminInviteHours(inv.age_hours)}` : null}
                </p>
              </div>
              <div className="admin-compact-actions">
                <Button
                  variant="secondary"
                  loading={reissue.isPending}
                  onClick={() => reissue.mutate(inv.id)}
                >
                  {he.adminInviteReissue}
                </Button>
                <Button variant="ghost" loading={revoke.isPending} onClick={() => revoke.mutate(inv.id)}>
                  {he.adminInviteRevoke}
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <Link to="/admin/invitations" className="admin-zone-more">
          {he.adminInvitations} ←
        </Link>
      </DashboardZone>

      <DashboardZone id="admin-workspaces" label={he.adminBetaWorkspacesTitle} className="is-ops">
        {workspaces.length === 0 && !query.isLoading ? (
          <p className="text-sm text-fg-muted">{he.adminBetaWorkspacesEmpty}</p>
        ) : null}
        <ul className="admin-compact-list">
          {workspaces.map((ws) => (
            <li key={ws.id} className="admin-compact-card">
              <div className="admin-compact-main">
                <p className="admin-compact-title">{ws.name}</p>
                <p className="admin-compact-meta">
                  {ws.status} · {he.adminBetaWsMembers} {ws.member_count} ·{" "}
                  {ws.has_owner ? he.adminBetaWsOwner : he.adminBetaWsNoOwner} · {he.adminBetaWsPending}{" "}
                  {ws.pending_invites} · {formatDate(ws.created_at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <Link to="/admin/organizations" className="admin-zone-more">
          {he.adminOrgs} ←
        </Link>
      </DashboardZone>

      <DashboardZone id="admin-feedback" label={he.adminOpenFeedbackTitle} className="is-ops">
        {feedback.length === 0 && !query.isLoading ? (
          <p className="text-sm text-fg-muted">{he.adminOpenFeedbackEmpty}</p>
        ) : null}
        <ul className="admin-compact-list">
          {feedback.map((fb) => (
            <li key={fb.id} className={`admin-compact-card ${severityTone(fb.severity)}`}>
              <div className="admin-compact-main">
                <p className="admin-compact-title">{fb.title || fb.ticket_id || fb.id}</p>
                <p className="admin-compact-meta">
                  {fb.severity ?? "—"} · {fb.status ?? "—"} · {formatWhen(fb.created_at)}
                  {fb.workspace_id ? (
                    <>
                      {" · "}
                      <span className="ltr-meta" dir="ltr">
                        {fb.workspace_id.slice(0, 8)}
                      </span>
                    </>
                  ) : null}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <Link to="/admin/feedback" className="admin-zone-more">
          {he.adminOpenFeedbackAll} ←
        </Link>
      </DashboardZone>

      <DashboardZone id="admin-activity" label={he.adminActivityTitle} className="is-utility">
        {activity.length === 0 && !query.isLoading ? (
          <p className="text-sm text-fg-muted">{he.adminActivityEmpty}</p>
        ) : null}
        <ul className="admin-activity-list">
          {activity.map((ev) => (
            <li key={ev.id} className="admin-activity-item">
              <span className="admin-activity-time ltr-meta" dir="ltr">
                {formatWhen(ev.created_at)}
              </span>
              <span className="admin-activity-action">{ev.action ?? "—"}</span>
              <span className="admin-activity-summary">{ev.summary ?? "—"}</span>
            </li>
          ))}
        </ul>
        <Link to="/admin/audit" className="admin-zone-more">
          {he.adminAudit} ←
        </Link>
      </DashboardZone>

      <DashboardZone id="admin-request-id" label={he.adminRequestIdTitle} className="is-utility">
        <p className="admin-request-id-body">{he.adminRequestIdBody}</p>
        <p className="text-xs text-fg-muted">{he.adminRequestIdHint}</p>
        <p className="text-xs text-fg-muted mt-2">{he.adminErrorsGap}</p>
      </DashboardZone>
    </div>
  );
}
