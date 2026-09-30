import { ErrorState, PageHeader, Status, type StatusTone } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Fingerprint,
  KeyRound,
  Lock,
  MonitorSmartphone,
  ScrollText,
  Shield,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { LottieAnimation } from "../../../components/lottie";
import { RequireAnyPermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { roleLabel } from "../../../lib/app-nav";
import { can } from "../../../lib/can";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/settings/security")({
  component: SecurityPage,
});

type UiStatus = "ok" | "available" | "limited" | "unavailable";

const SIGNAL_COPY: Record<
  string,
  { title: string; body: string; icon: LucideIcon; primary?: boolean }
> = {
  authentication: {
    title: he.securityStatusAuthTitle,
    body: he.securityStatusAuthBody,
    icon: Fingerprint,
    primary: true,
  },
  rbac: {
    title: he.securityStatusRbacTitle,
    body: he.securityStatusRbacBody,
    icon: KeyRound,
    primary: true,
  },
  tenant_isolation: {
    title: he.securityStatusTenantTitle,
    body: he.securityStatusTenantBody,
    icon: ShieldCheck,
    primary: true,
  },
  audit_logging: {
    title: he.securityStatusAuditTitle,
    body: he.securityStatusAuditBody,
    icon: ScrollText,
    primary: true,
  },
  sessions: {
    title: he.securityStatusSessionsTitle,
    body: he.securityStatusSessionsBody,
    icon: MonitorSmartphone,
    primary: true,
  },
  mfa: {
    title: he.securityStatusMfaTitle,
    body: he.securityStatusMfaBody,
    icon: Lock,
    primary: true,
  },
  api_security: {
    title: he.securityStatusApiTitle,
    body: he.securityStatusApiBody,
    icon: Shield,
    primary: false,
  },
};

function mapUiStatus(status: "healthy" | "not_in_plan" | "not_built"): UiStatus {
  if (status === "healthy") return "ok";
  if (status === "not_in_plan") return "limited";
  return "unavailable";
}

function statusLabel(status: UiStatus): string {
  if (status === "ok") return he.securityChipOk;
  if (status === "available") return he.securityChipAvailable;
  if (status === "limited") return he.securityChipLimited;
  return he.securityChipUnavailable;
}

function statusTone(status: UiStatus): StatusTone {
  if (status === "ok" || status === "available") return "success";
  if (status === "limited") return "warning";
  return "neutral";
}

function rolePlainDescription(roleKey: string | undefined): string {
  if (!roleKey) return he.securityAccessRoleFallback;
  const map = he.rbacRoleDescriptions as Record<string, string>;
  if (roleKey === "administrator") return map.admin || he.securityAccessRoleFallback;
  return map[roleKey] || he.securityAccessRoleFallback;
}

function SecurityPage() {
  return (
    <RequireAnyPermission permissions={["settings.general", "workspace.edit"]}>
      <SecurityBody />
    </RequireAnyPermission>
  );
}

function SecurityBody() {
  const { session, api } = useSession();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const features = membership?.features ?? [];
  const grants = membership?.permissions ?? null;
  const roleKey = membership?.role_key;
  const canRoles = can(roleKey, "roles.manage", features, grants);
  const canAudit = can(roleKey, "audit.view", features, grants);
  const [techOpen, setTechOpen] = useState(false);

  const query = useQuery({
    queryKey: ["security", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getSecurityCenter(workspaceId!),
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;
  if (query.isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <LottieAnimation name="scan" size={80} />
        <p className="text-sm text-fg-muted" role="status">
          {he.loading}
        </p>
      </div>
    );
  }
  if (query.isError || !query.data) return <ErrorState title={he.securityError} />;

  const byKey = Object.fromEntries(query.data.signals.map((s) => [s.key, s]));
  const primaryKeys = ["authentication", "rbac", "tenant_isolation", "audit_logging", "sessions", "mfa"] as const;
  const protectionItems = [
    he.securityProtectTenant,
    he.securityProtectServerAuthz,
    he.securityProtectApi,
    he.securityProtectDocuments,
  ];

  return (
    <div className="settings-security" data-testid="settings-security">
      <header className="settings-security-header">
        <PageHeader title={he.securityTitle} description={he.securityLead} />
      </header>

      <section className="settings-security-section" aria-labelledby="security-status-heading">
        <h2 id="security-status-heading" className="settings-section-title">
          {he.securityStatusHeading}
        </h2>
        <ul className="settings-security-status-list">
          {primaryKeys.map((key) => {
            const signal = byKey[key];
            const copy = SIGNAL_COPY[key];
            if (!copy) return null;
            const uiStatus = signal ? mapUiStatus(signal.status) : "unavailable";
            // Audit available when healthy + user can view → show available chip language
            const chipStatus: UiStatus =
              key === "audit_logging" && uiStatus === "ok" && canAudit ? "available" : uiStatus;
            const Icon = copy.icon;
            return (
              <li key={key} className="settings-security-status-row">
                <span className="settings-security-status-icon" aria-hidden>
                  <Icon size={18} strokeWidth={1.7} />
                </span>
                <div className="settings-security-status-copy min-w-0">
                  <div className="settings-security-status-title-row">
                    <p className="settings-security-status-title">{copy.title}</p>
                    <Status label={statusLabel(chipStatus)} tone={statusTone(chipStatus)} />
                  </div>
                  <p className="settings-security-status-body">{copy.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="settings-security-section" aria-labelledby="security-account-heading">
        <h2 id="security-account-heading" className="settings-section-title">
          {he.securityAccountHeading}
        </h2>
        <dl className="settings-security-account-grid">
          <div className="settings-security-account-item">
            <dt>{he.email}</dt>
            <dd className="ltr-meta" dir="ltr">
              {session?.email || "—"}
            </dd>
          </div>
          <div className="settings-security-account-item">
            <dt>{he.roleCaption}</dt>
            <dd>{roleLabel(roleKey) || "—"}</dd>
          </div>
          <div className="settings-security-account-item">
            <dt>{he.workspaceName}</dt>
            <dd>{membership?.workspace_name || "—"}</dd>
          </div>
        </dl>

        <div className="settings-security-action-card" data-testid="settings-security-password">
          <div className="min-w-0">
            <p className="settings-security-action-title">{he.securityPasswordResetTitle}</p>
            <p className="settings-security-action-body">{he.securityPasswordResetBody}</p>
          </div>
          <Link to="/forgot-password" className="settings-security-action-cta">
            {he.securityPasswordResetCta}
          </Link>
        </div>
      </section>

      <section className="settings-security-section" aria-labelledby="security-access-heading">
        <h2 id="security-access-heading" className="settings-section-title">
          {he.securityAccessHeading}
        </h2>
        <div className="settings-security-access-card">
          <span className="settings-security-status-icon" aria-hidden>
            <UserRound size={18} strokeWidth={1.7} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="settings-security-status-title">{roleLabel(roleKey) || he.roleCaption}</p>
            <p className="settings-security-status-body">{rolePlainDescription(roleKey)}</p>
            <p className="settings-security-access-ws">{membership?.workspace_name || "—"}</p>
          </div>
        </div>
        {canRoles || canAudit ? (
          <div className="settings-security-access-links">
            {canRoles ? (
              <Link to="/app/settings/roles" className="settings-security-link">
                {he.securityManageRolesCta}
              </Link>
            ) : null}
            {canAudit ? (
              <Link
                to="/app/settings/audit"
                className="settings-security-link"
                data-testid="settings-security-audit-link"
              >
                {he.securityAuditCta}
              </Link>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="settings-security-section" aria-labelledby="security-protect-heading">
        <h2 id="security-protect-heading" className="settings-section-title">
          {he.securityProtectHeading}
        </h2>
        <ul className="settings-security-protect-list">
          {protectionItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <button
          type="button"
          className="settings-security-tech-toggle"
          aria-expanded={techOpen}
          onClick={() => setTechOpen((v) => !v)}
        >
          {he.securityTechToggle}
        </button>
        {techOpen ? (
          <div className="settings-security-tech-panel" role="region" aria-label={he.securityTechToggle}>
            <p className="settings-security-status-body ltr-meta" dir="ltr">
              {he.securityTechBody}
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
