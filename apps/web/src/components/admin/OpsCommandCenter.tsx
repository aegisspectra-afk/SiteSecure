import type {
  AdminBetaWorkspaceCard,
  AdminFeedbackCard,
  AdminPendingInviteCard,
  AdminSummary,
} from "@site-secure/api-client";
import { Badge, Button, Input, Status, type StatusTone } from "@site-secure/ui";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { he } from "../../i18n/he";
import { WEB_BUILD } from "../../lib/app-version";
import {
  classifyInviteEmail,
  filterActivity,
  filterAttention,
  filterFeedback,
  filterPendingInvites,
  groupActivityItems,
  groupAttentionItems,
  mapSystemTone,
  type HealthTone,
  type OpsScope,
  type OpsTimeWindow,
} from "../../lib/admin-ops-center";

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

function formatTimeRange(first?: string | null, last?: string | null) {
  if (!first && !last) return "—";
  if (!first || !last || first === last) return formatWhen(first ?? last);
  const a = new Date(first);
  const b = new Date(last);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return formatWhen(last);
  const sameDay = a.toDateString() === b.toDateString();
  const t = (d: Date) =>
    d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `${t(a)}–${t(b)}`;
  return `${formatWhen(first)} – ${formatWhen(last)}`;
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

function severityToneClass(severity?: string | null) {
  if (severity === "critical" || severity === "blocker") return "is-critical";
  if (severity === "high") return "is-high";
  if (severity === "medium") return "is-medium";
  return "is-low";
}

function healthToStatus(tone: HealthTone): { label: string; tone: StatusTone } {
  switch (tone) {
    case "ok":
      return { label: he.adminStatusOk, tone: "success" };
    case "warning":
      return { label: he.adminStatusWarning, tone: "warning" };
    case "danger":
      return { label: he.adminStatusFault, tone: "danger" };
    default:
      return { label: he.adminStatusDisconnected, tone: "neutral" };
  }
}

function severityPriorityLabel(severity: string) {
  if (severity === "critical") return he.adminAttentionSeverityCritical;
  if (severity === "high") return he.adminAttentionSeverityHigh;
  if (severity === "medium") return he.adminAttentionSeverityAction;
  return he.adminAttentionSeverityInfo;
}

function classLabel(kind: ReturnType<typeof classifyInviteEmail>) {
  if (kind === "suspected_qa") return he.adminClassSuspectedQa;
  return he.adminClassUnclassified;
}

export type OpsCommandCenterProps = {
  data?: AdminSummary;
  loading: boolean;
  errorMessage: string | null;
  onRefresh: () => void;
  onOpenFt: () => void;
  onRevoke: (id: string) => void;
  onReissue: (id: string) => void;
  revokePending?: boolean;
  reissuePending?: boolean;
  ftPanelOpen?: boolean;
};

export function OpsCommandCenter({
  data,
  loading,
  errorMessage,
  onRefresh,
  onOpenFt,
  onRevoke,
  onReissue,
  revokePending,
  reissuePending,
  ftPanelOpen,
}: OpsCommandCenterProps) {
  const navigate = useNavigate();
  const [scope, setScope] = useState<OpsScope>("hide_suspected_qa");
  const [time, setTime] = useState<OpsTimeWindow>("7d");
  const [systemOpen, setSystemOpen] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [copiedRid, setCopiedRid] = useState(false);

  const attentionRaw = data?.attention ?? [];
  const pendingRaw = data?.pending_invites ?? [];
  const workspaces = data?.beta_workspaces ?? [];
  const feedbackRaw = data?.open_feedback ?? [];
  const activityRaw = data?.recent_activity ?? [];
  const funnel = data?.funnel;

  const attentionFiltered = useMemo(
    () => filterAttention(attentionRaw, scope, time),
    [attentionRaw, scope, time],
  );
  const groupedAttention = useMemo(() => groupAttentionItems(attentionFiltered), [attentionFiltered]);

  const pending = useMemo(
    () => filterPendingInvites(pendingRaw, scope, time).slice(0, 8),
    [pendingRaw, scope, time],
  );

  const feedback = useMemo(() => {
    const filtered = filterFeedback(feedbackRaw, scope, time);
    const real = filtered.filter((f) => f.is_beta !== false);
    const qa = filtered.filter((f) => f.is_beta === false);
    return { real: real.slice(0, 5), qa: qa.slice(0, 3), high: real.filter((f) => f.severity === "high" || f.severity === "blocker" || f.severity === "critical").length, open: real.length };
  }, [feedbackRaw, scope, time]);

  const activityGrouped = useMemo(
    () => groupActivityItems(filterActivity(activityRaw, time)),
    [activityRaw, time],
  );

  const system = data?.system;
  const healthItems: Array<{ key: string; label: string; tone: HealthTone; meta?: string }> = [
    {
      key: "api",
      label: he.adminSystemApi,
      tone: mapSystemTone("api", system, !errorMessage && (loading || Boolean(data))),
      meta: system?.api_version ? `v${system.api_version.replace(/^v/, "")}` : undefined,
    },
    {
      key: "web",
      label: he.adminSystemWeb,
      tone: mapSystemTone("web", system),
      meta: WEB_BUILD.version,
    },
    { key: "auth", label: he.adminSystemAuth, tone: mapSystemTone("auth", system) },
    {
      key: "backup",
      label: he.adminSystemBackup,
      tone: mapSystemTone("backup", system),
    },
    { key: "invite", label: he.adminSystemInviteFlow, tone: mapSystemTone("invite", system) },
    { key: "quote", label: he.adminSystemQuoteFlow, tone: mapSystemTone("quote", system) },
  ];

  const snapshot: Array<{ key: string; label: string; value: number | undefined; to: string; warn?: boolean }> = [
    { key: "ws", label: he.adminMetricBetaActive, value: data?.beta_workspaces_active, to: "/admin/organizations" },
    { key: "users", label: he.adminSnapshotParticipants, value: data?.beta_participants_active ?? data?.founding_technicians, to: "/admin/users" },
    {
      key: "pending",
      label: he.adminMetricInvitesPending,
      value: data?.invites_pending,
      to: "/admin/invitations",
      warn: (data?.invites_pending ?? 0) > 0,
    },
    {
      key: "no-owner",
      label: he.adminSnapshotAwaitingOwner,
      value: workspaces.filter((w) => !w.has_owner).length,
      to: "/admin/organizations",
      warn: workspaces.some((w) => !w.has_owner),
    },
    {
      key: "fb",
      label: he.adminMetricFeedbackOpen,
      value: data?.feedback_open,
      to: "/admin/feedback",
      warn: (data?.feedback_open ?? 0) > 0,
    },
  ];

  const funnelStages = funnel
    ? [
        { id: "ws", label: he.adminFunnelWorkspaces, count: funnel.beta_workspaces },
        { id: "inv", label: he.adminFunnelOwnerInvites, count: funnel.owner_invites },
        { id: "acc", label: he.adminFunnelAccepted, count: funnel.owner_accepted },
        { id: "pen", label: he.adminFunnelPending, count: funnel.owner_pending },
      ]
    : [];

  return (
    <div className="admin-cc">
      <header className="admin-cc-header">
        <div className="admin-cc-header-copy">
          <p className="admin-cc-brand">{he.brand}</p>
          <p className="admin-cc-badge">{he.adminPlatformBadge}</p>
          <h1 className="admin-cc-title">{he.adminOpsCenterTitle}</h1>
          <p className="admin-cc-subtitle">{he.adminOpsCenterSubtitleShort}</p>
        </div>
        <div className="admin-cc-header-actions">
          {!ftPanelOpen ? (
            <Button variant="primary" className="admin-cc-primary-cta" onClick={onOpenFt}>
              {he.adminFtCta}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onRefresh} aria-label={he.adminFilterRefresh}>
            {he.adminFilterRefresh}
          </Button>
          <Link to="/admin/invitations" className="admin-cc-util-link">
            {he.adminInvitations}
          </Link>
          <Link to="/admin/feedback" className="admin-cc-util-link">
            {he.adminFeedback}
          </Link>
        </div>
      </header>

      {errorMessage ? (
        <div className="admin-cc-error ops-card flex flex-wrap items-center justify-between gap-3 px-4 py-3" role="alert">
          <p className="text-sm text-danger">{errorMessage}</p>
          <Button type="button" variant="secondary" onClick={onRefresh}>
            {he.retry}
          </Button>
        </div>
      ) : null}

      <div className="admin-cc-filters" role="group" aria-label={he.adminFilterBarLabel}>
        <div className="admin-cc-filter-group">
          <span className="admin-cc-filter-label">{he.adminFilterScope}</span>
          <div className="admin-cc-seg" role="radiogroup" aria-label={he.adminFilterScope}>
            <button
              type="button"
              role="radio"
              aria-checked={scope === "hide_suspected_qa"}
              className={`admin-cc-seg-btn${scope === "hide_suspected_qa" ? " is-active" : ""}`}
              onClick={() => setScope("hide_suspected_qa")}
            >
              {he.adminFilterScopeReal}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={scope === "all"}
              className={`admin-cc-seg-btn${scope === "all" ? " is-active" : ""}`}
              onClick={() => setScope("all")}
            >
              {he.adminFilterScopeAll}
            </button>
          </div>
        </div>
        <div className="admin-cc-filter-group">
          <span className="admin-cc-filter-label">{he.adminFilterTime}</span>
          <div className="admin-cc-seg" role="radiogroup" aria-label={he.adminFilterTime}>
            {(
              [
                ["24h", he.adminFilterTime24h],
                ["7d", he.adminFilterTime7d],
                ["30d", he.adminFilterTime30d],
                ["all", he.adminFilterTimeAll],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={time === value}
                className={`admin-cc-seg-btn${time === value ? " is-active" : ""}`}
                onClick={() => setTime(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="admin-cc-filter-note">{he.adminFilterClassifierNote}</p>
      </div>

      <section className="admin-cc-status-strip" aria-label={he.adminSystemStatus}>
        {healthItems.map((item) => {
          const st = healthToStatus(item.tone);
          return (
            <div key={item.key} className={`admin-cc-status-chip is-${item.tone}`}>
              <span className="admin-cc-status-name">{item.label}</span>
              <Status label={st.label} tone={st.tone} />
              {item.meta ? (
                <span className="admin-cc-status-meta ltr-meta" dir="ltr">
                  {item.meta}
                </span>
              ) : null}
            </div>
          );
        })}
      </section>

      <div className="admin-cc-grid">
        <div className="admin-cc-main">
          <section className="admin-cc-panel admin-cc-attention" aria-labelledby="admin-cc-attention-title">
            <div className="admin-cc-panel-head">
              <h2 id="admin-cc-attention-title" className="admin-cc-panel-title">
                {he.adminAttentionTitle}
              </h2>
              <Link to="/admin/invitations" className="admin-cc-panel-link">
                {he.adminAttentionViewAll}
              </Link>
            </div>
            {loading ? <p className="admin-cc-muted">{he.loading}</p> : null}
            {!loading && groupedAttention.length === 0 ? (
              <div className="admin-cc-empty">
                <p className="admin-cc-empty-title">{he.adminAttentionEmptyTitle}</p>
                <p className="admin-cc-empty-body">{he.adminAttentionEmpty}</p>
              </div>
            ) : null}
            <ul className="admin-cc-attention-list">
              {groupedAttention.map((item) => (
                <li key={item.id} className={`admin-cc-attention-row ${severityToneClass(item.severity)}`}>
                  <div className="admin-cc-attention-copy">
                    <div className="admin-cc-attention-top">
                      <Badge className={`admin-cc-sev ${severityToneClass(item.severity)}`}>
                        {severityPriorityLabel(item.severity)}
                      </Badge>
                      {item.count > 1 ? (
                        <span className="admin-cc-count tabular-nums ltr-meta" dir="ltr">
                          ×{item.count}
                        </span>
                      ) : null}
                    </div>
                    <p className="admin-cc-attention-title">{item.title}</p>
                    {item.count > 1 ? (
                      <p className="admin-cc-attention-detail">
                        {he.adminAttentionGroupedBreakdown(item.realCount, item.suspectedQaCount)}
                      </p>
                    ) : item.sampleDetail ? (
                      <p className="admin-cc-attention-detail">{item.sampleDetail}</p>
                    ) : null}
                    {item.created_at ? (
                      <p className="admin-cc-attention-meta ltr-meta" dir="ltr">
                        {formatWhen(item.created_at)}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    variant="secondary"
                    className="admin-cc-row-action"
                    onClick={() => void navigate({ to: item.href })}
                  >
                    {he.adminAttentionOpen}
                  </Button>
                </li>
              ))}
            </ul>
          </section>

          <section className="admin-cc-panel" aria-labelledby="admin-cc-funnel-title">
            <div className="admin-cc-panel-head">
              <h2 id="admin-cc-funnel-title" className="admin-cc-panel-title">
                {he.adminFunnelTitle}
              </h2>
            </div>
            {!funnel ? (
              <p className="admin-cc-muted">{he.adminFunnelUnavailable}</p>
            ) : (
              <>
                <p className="admin-cc-funnel-note">{he.adminFunnelDataNote}</p>
                <ol className="admin-cc-funnel" dir="ltr">
                  {funnelStages.map((stage, idx) => (
                    <li key={stage.id} className="admin-cc-funnel-step">
                      {idx > 0 ? (
                        <span className="admin-cc-funnel-arrow" aria-hidden>
                          →
                        </span>
                      ) : null}
                      <div className="admin-cc-funnel-card">
                        <span className="admin-cc-funnel-count tabular-nums ltr-meta" dir="ltr">
                          {stage.count}
                        </span>
                        <span className="admin-cc-funnel-label">{stage.label}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </section>

          <section className="admin-cc-panel" aria-labelledby="admin-cc-ws-title">
            <div className="admin-cc-panel-head">
              <h2 id="admin-cc-ws-title" className="admin-cc-panel-title">
                {he.adminBetaWorkspacesTitle}
              </h2>
              <Link to="/admin/organizations" className="admin-cc-panel-link">
                {he.adminOrgs}
              </Link>
            </div>
            {workspaces.length === 0 && !loading ? (
              <p className="admin-cc-muted">{he.adminBetaWorkspacesEmpty}</p>
            ) : null}
            <ul className="admin-cc-row-list">
              {workspaces.map((ws: AdminBetaWorkspaceCard) => (
                <li key={ws.id} className="admin-cc-data-row">
                  <div className="admin-cc-data-main">
                    <p className="admin-cc-data-title">{ws.name}</p>
                    <div className="admin-cc-chip-row">
                      <Badge>{ws.status}</Badge>
                      <Badge className={ws.has_owner ? "" : "admin-cc-chip-warn"}>
                        {ws.has_owner ? he.adminBetaWsOwner : he.adminBetaWsNoOwner}
                      </Badge>
                      <span className="admin-cc-meta-inline">
                        {he.adminBetaWsMembers}{" "}
                        <span className="tabular-nums ltr-meta" dir="ltr">
                          {ws.member_count}
                        </span>
                      </span>
                      <span className="admin-cc-meta-inline">
                        {he.adminBetaWsPending}{" "}
                        <span className="tabular-nums ltr-meta" dir="ltr">
                          {ws.pending_invites}
                        </span>
                      </span>
                      {ws.created_at ? (
                        <span className="admin-cc-meta-inline ltr-meta" dir="ltr">
                          {formatWhen(ws.created_at)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    className="admin-cc-row-action"
                    onClick={() => void navigate({ to: "/admin/organizations" })}
                  >
                    {he.adminAttentionOpen}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="admin-cc-side">
          <section className="admin-cc-panel" aria-labelledby="admin-cc-snap-title">
            <div className="admin-cc-panel-head">
              <h2 id="admin-cc-snap-title" className="admin-cc-panel-title">
                {he.adminSnapshotTitle}
              </h2>
            </div>
            <div className="admin-cc-snap-grid">
              {snapshot.map((m) => {
                const display = loading && m.value === undefined ? "…" : m.value === undefined ? "—" : String(m.value);
                return (
                  <button
                    type="button"
                    key={m.key}
                    className={`admin-cc-snap-card${m.warn ? " is-warn" : ""}`}
                    onClick={() => void navigate({ to: m.to })}
                  >
                    <span className="admin-cc-snap-value tabular-nums ltr-meta" dir="ltr">
                      {display}
                    </span>
                    <span className="admin-cc-snap-label">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="admin-cc-panel" aria-labelledby="admin-cc-inv-title">
            <div className="admin-cc-panel-head">
              <h2 id="admin-cc-inv-title" className="admin-cc-panel-title">
                {he.adminInviteHealthTitle}
              </h2>
              <Link to="/admin/invitations" className="admin-cc-panel-link">
                {he.adminInvitations}
              </Link>
            </div>
            <div className="admin-cc-invite-summary">
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
            {pending.length === 0 && !loading ? (
              <p className="admin-cc-muted">{he.adminInviteListEmpty}</p>
            ) : null}
            <ul className="admin-cc-row-list">
              {pending.map((inv: AdminPendingInviteCard) => {
                const klass = classifyInviteEmail(inv.email);
                return (
                  <li key={inv.id} className="admin-cc-data-row is-stack">
                    <div className="admin-cc-data-main">
                      <p className="admin-cc-data-title ltr-meta" dir="ltr">
                        {inv.email}
                      </p>
                      <p className="admin-cc-meta-line">
                        {inv.workspace_name ?? "—"} · {inv.role_key} · {inviteStatusLabel(String(inv.status))}
                        {inv.age_hours !== undefined ? ` · ${he.adminInviteAge} ${he.adminInviteHours(inv.age_hours)}` : null}
                      </p>
                      <Badge className={klass === "suspected_qa" ? "admin-cc-chip-muted" : ""}>
                        {classLabel(klass)}
                      </Badge>
                    </div>
                    <div className="admin-cc-row-actions">
                      <Button variant="secondary" loading={reissuePending} onClick={() => onReissue(inv.id)}>
                        {he.adminInviteReissue}
                      </Button>
                      <Button variant="ghost" loading={revokePending} onClick={() => onRevoke(inv.id)}>
                        {he.adminInviteRevoke}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => void navigate({ to: "/admin/invitations" })}
                      >
                        {he.adminAttentionOpen}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="admin-cc-panel" aria-labelledby="admin-cc-fb-title">
            <div className="admin-cc-panel-head">
              <h2 id="admin-cc-fb-title" className="admin-cc-panel-title">
                {he.adminOpenFeedbackTitle}
              </h2>
              <Link to="/admin/feedback" className="admin-cc-panel-link">
                {he.adminOpenFeedbackAll}
              </Link>
            </div>
            <div className="admin-cc-fb-summary">
              <span>
                {he.adminFeedbackOpenCount}{" "}
                <b className="tabular-nums ltr-meta" dir="ltr">
                  {data?.feedback_open ?? feedback.open}
                </b>
              </span>
              <span>
                {he.adminFeedbackHighCount}{" "}
                <b className="tabular-nums ltr-meta" dir="ltr">
                  {feedback.high}
                </b>
              </span>
            </div>
            {feedback.real.length === 0 && !loading ? (
              <div className="admin-cc-empty">
                <p className="admin-cc-empty-title">{he.adminFeedbackEmptyTitle}</p>
                <p className="admin-cc-empty-body">{he.adminOpenFeedbackEmptyReal}</p>
              </div>
            ) : null}
            <ul className="admin-cc-row-list">
              {feedback.real.map((fb: AdminFeedbackCard) => (
                <li key={fb.id} className={`admin-cc-data-row ${severityToneClass(fb.severity)}`}>
                  <div className="admin-cc-data-main">
                    <p className="admin-cc-data-title">{fb.title || fb.ticket_id || fb.id}</p>
                    <p className="admin-cc-meta-line">
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
            {feedback.qa.length > 0 ? (
              <details className="admin-cc-qa-group">
                <summary>
                  {he.adminFeedbackQaGroup} ({feedback.qa.length})
                </summary>
                <ul className="admin-cc-row-list">
                  {feedback.qa.map((fb) => (
                    <li key={fb.id} className="admin-cc-data-row is-muted">
                      <div className="admin-cc-data-main">
                        <p className="admin-cc-data-title">{fb.title || fb.ticket_id || fb.id}</p>
                        <p className="admin-cc-meta-line">
                          {fb.severity ?? "—"} · {formatWhen(fb.created_at)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </section>

          <section className="admin-cc-panel" aria-labelledby="admin-cc-act-title">
            <div className="admin-cc-panel-head">
              <h2 id="admin-cc-act-title" className="admin-cc-panel-title">
                {he.adminActivityTitle}
              </h2>
              <Link to="/admin/audit" className="admin-cc-panel-link">
                {he.adminAudit}
              </Link>
            </div>
            {activityGrouped.length === 0 && !loading ? (
              <p className="admin-cc-muted">{he.adminActivityEmpty}</p>
            ) : null}
            <ul className="admin-cc-activity-list">
              {activityGrouped.map((ev) => (
                <li key={ev.id} className="admin-cc-activity-item">
                  <span className="admin-cc-activity-icon" aria-hidden>
                    ●
                  </span>
                  <div className="admin-cc-activity-body">
                    <p className="admin-cc-activity-title">
                      {ev.title}
                      {ev.count > 1 ? (
                        <span className="admin-cc-count tabular-nums ltr-meta" dir="ltr">
                          {" "}
                          ×{ev.count}
                        </span>
                      ) : null}
                    </p>
                    {ev.sampleSummary ? <p className="admin-cc-meta-line">{ev.sampleSummary}</p> : null}
                    <p className="admin-cc-activity-meta">
                      <span className="ltr-meta" dir="ltr">
                        {formatTimeRange(ev.firstAt, ev.lastAt)}
                      </span>
                      <span className="admin-cc-activity-raw ltr-meta" dir="ltr">
                        {ev.action}
                      </span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      <div className="admin-cc-utilities">
        <details
          className="admin-cc-panel admin-cc-utility"
          open={systemOpen}
          onToggle={(e) => setSystemOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="admin-cc-utility-summary">{he.adminSystemDetailsTitle}</summary>
          <dl className="admin-cc-deploy-grid">
            <div>
              <dt>{he.adminDeployEnv}</dt>
              <dd className="ltr-meta" dir="ltr">
                {system?.app_env ?? he.adminDeployUnavailable}
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
                {system?.api_version ?? he.adminDeployUnavailable}
              </dd>
            </div>
            <div>
              <dt>{he.adminDeployGitSha}</dt>
              <dd className="ltr-meta" dir="ltr">
                {WEB_BUILD.gitSha ?? he.adminDeployUnavailable}
              </dd>
            </div>
          </dl>
        </details>

        <section className="admin-cc-panel admin-cc-utility" aria-labelledby="admin-cc-rid-title">
          <h2 id="admin-cc-rid-title" className="admin-cc-panel-title">
            {he.adminRequestIdShortTitle}
          </h2>
          <p className="admin-cc-muted">{he.adminRequestIdNoSearch}</p>
          <div className="admin-cc-rid-row">
            <Input
              id="admin-request-id"
              label={he.adminRequestIdInputLabel}
              value={requestId}
              onChange={(ev) => setRequestId(ev.target.value)}
              placeholder="req_…"
              className="admin-cc-rid-input"
            />
            <Button
              variant="secondary"
              disabled={!requestId.trim()}
              onClick={() => {
                void navigator.clipboard.writeText(requestId.trim()).then(() => {
                  setCopiedRid(true);
                  window.setTimeout(() => setCopiedRid(false), 1500);
                });
              }}
            >
              {copiedRid ? he.adminInviteCopied : he.adminRequestIdCopy}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
