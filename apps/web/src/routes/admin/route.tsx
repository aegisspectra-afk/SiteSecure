import { Button, ErrorState, cn } from "@site-secure/ui";
import { Link, Navigate, Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { FeedbackCenter } from "../../components/FeedbackCenter";
import { UserAccountMenu } from "../../components/UserAccountMenu";
import { he } from "../../i18n/he";
import { guestEntryPath } from "../../lib/auth-routes";
import { useDocumentMeta } from "../../lib/document-meta";
import { useSession } from "../../lib/session";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

type NavItem = {
  to: string;
  labelKey:
    | "adminTitle"
    | "adminOrgs"
    | "adminInvitations"
    | "adminUsers"
    | "adminFeedback"
    | "adminAudit"
    | "adminBeta"
    | "adminBadges"
    | "adminFlags";
  exact?: boolean;
};

const NAV_GROUPS: Array<{
  labelKey: "adminNavGroupOps" | "adminNavGroupAdvanced";
  items: NavItem[];
}> = [
  {
    labelKey: "adminNavGroupOps",
    items: [
      { to: "/admin", labelKey: "adminTitle", exact: true },
      { to: "/admin/organizations", labelKey: "adminOrgs" },
      { to: "/admin/invitations", labelKey: "adminInvitations" },
      { to: "/admin/users", labelKey: "adminUsers" },
      { to: "/admin/feedback", labelKey: "adminFeedback" },
      { to: "/admin/audit", labelKey: "adminAudit" },
    ],
  },
  {
    labelKey: "adminNavGroupAdvanced",
    items: [
      { to: "/admin/beta", labelKey: "adminBeta" },
      { to: "/admin/badges", labelKey: "adminBadges" },
      { to: "/admin/flags", labelKey: "adminFlags" },
    ],
  },
];

function BrandMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2.75 20.25 8v5.2c0 4.35-3.35 8.05-8.25 9.8-4.9-1.75-8.25-5.45-8.25-9.8V8L12 2.75Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M12 7.25 16 11l-4 3.75L8 11l4-3.75Z" fill="currentColor" opacity="0.28" />
      <path
        d="M12 7.25 16 11l-4 3.75L8 11l4-3.75Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AdminLayout() {
  const { loading, user, session, error, refresh, signOut } = useSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useDocumentMeta({
    title: `${he.adminOpsCenterTitle} — ${he.brand}`,
    robots: "noindex, nofollow",
  });

  if (loading) {
    return (
      <div className="ops-shell admin-ops admin-ops-loading">
        <p className="p-6 text-sm text-fg-muted">{he.loading}</p>
      </div>
    );
  }
  if (!user) return <Navigate to={guestEntryPath()} />;
  if (error && !session) {
    return (
      <ErrorState
        title={he.apiUnavailable}
        description={error}
        action={
          <Button variant="secondary" onClick={() => void refresh()}>
            {he.retry}
          </Button>
        }
      />
    );
  }
  if (!session?.is_platform_admin) {
    return <ErrorState title={he.adminNoAccess} description={he.forbiddenBody} />;
  }

  const activeLabel =
    NAV_GROUPS.flatMap((group) => group.items).find((item) =>
      item.exact ? pathname === item.to || pathname === `${item.to}/` : pathname.startsWith(item.to),
    )?.labelKey ?? "adminTitle";

  const displayName = session.profile?.full_name?.trim() || session.email || he.brand;
  const membership = session.memberships[0];

  return (
    <div className="ops-shell admin-ops">
      <aside className="ops-sidebar admin-ops-sidebar" aria-label={he.adminNav}>
        <div className="ops-sidebar-brand">
          <div className="ops-sidebar-brand-row">
            <div className="ops-sidebar-brand-identity">
              <BrandMark className="ops-sidebar-brand-mark" />
              <div className="ops-sidebar-brand-copy min-w-0 flex-1">
                <p className="ops-sidebar-workspace-name">{he.brand}</p>
                <p className="ops-sidebar-workspace-meta">{he.adminPlatformBadge}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="ops-sidebar-scroll">
          <nav className="ops-sidebar-nav admin-ops-nav">
            {NAV_GROUPS.map((group) => (
              <div key={group.labelKey} className="ops-sidebar-group admin-ops-nav-group">
                <p className="ops-sidebar-group-label admin-ops-nav-label">{he[group.labelKey]}</p>
                <div className="ops-sidebar-group-items admin-ops-nav-items">
                  {group.items.map((item) => {
                    const active = item.exact
                      ? pathname === item.to || pathname === `${item.to}/`
                      : pathname.startsWith(item.to);
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={cn("ops-sidebar-link admin-ops-nav-link", active && "is-active")}
                        aria-current={active ? "page" : undefined}
                      >
                        {he[item.labelKey]}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        <div className="admin-ops-sidebar-footer">
          <p className="admin-ops-sidebar-email ltr-meta" title={session.email ?? undefined}>
            {session.email}
          </p>
          <Button
            variant="secondary"
            className="w-full justify-center"
            onClick={() => void navigate({ to: "/app/dashboard" })}
          >
            {he.adminBackApp}
          </Button>
          <Button variant="ghost" className="w-full justify-center" onClick={() => void signOut()}>
            {he.signOut}
          </Button>
        </div>
      </aside>

      <div className="ops-content admin-ops-content">
        <header className="ops-topbar admin-ops-topbar">
          <div className="min-w-0">
            <p className="ops-topbar-kicker">{he.adminPlatformBadge}</p>
            <p className="ops-topbar-title">{he[activeLabel]}</p>
          </div>
          <div className="admin-ops-topbar-actions">
            <Button
              variant="secondary"
              className="admin-ops-topbar-back"
              onClick={() => void navigate({ to: "/app/dashboard" })}
            >
              {he.adminBackApp}
            </Button>
            <UserAccountMenu
              displayName={displayName}
              email={session.email}
              roleKey={membership?.role_key}
              planKey={membership?.plan_key}
              canSettings={false}
              canSecurity={false}
              onSettings={() => void navigate({ to: "/app/settings" })}
              onSecurity={() => void navigate({ to: "/app/settings/security" })}
              onSignOut={() => void signOut()}
              isBeta={Boolean(membership?.is_beta)}
              isPlatformAdmin
              recognitionBadges={session.profile?.recognition_badges ?? []}
            />
          </div>
        </header>

        <nav className="admin-ops-mobile-nav" aria-label={he.adminNav}>
          {NAV_GROUPS.flatMap((group) => group.items).map((item) => {
            const active = item.exact
              ? pathname === item.to || pathname === `${item.to}/`
              : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn("admin-ops-mobile-link", active && "is-active")}
                aria-current={active ? "page" : undefined}
              >
                {he[item.labelKey]}
              </Link>
            );
          })}
        </nav>

        <main id="main" className="ops-main admin-ops-main">
          <Outlet />
        </main>
      </div>
      <FeedbackCenter />
    </div>
  );
}
