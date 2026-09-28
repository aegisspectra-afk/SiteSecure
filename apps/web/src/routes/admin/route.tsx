import { Button, ErrorState, cn } from "@site-secure/ui";
import { Link, Navigate, Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { FeedbackCenter } from "../../components/FeedbackCenter";
import { he } from "../../i18n/he";
import { guestEntryPath } from "../../lib/auth-routes";
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
    | "adminBeta"
    | "adminBadges"
    | "adminFeedback"
    | "adminAudit"
    | "adminFlags";
  exact?: boolean;
};

const NAV_GROUPS: Array<{ labelKey: "adminNavGroupOps" | "adminNavGroupBeta" | "adminNavGroupSystem"; items: NavItem[] }> = [
  {
    labelKey: "adminNavGroupOps",
    items: [
      { to: "/admin", labelKey: "adminTitle", exact: true },
      { to: "/admin/organizations", labelKey: "adminOrgs" },
      { to: "/admin/invitations", labelKey: "adminInvitations" },
      { to: "/admin/users", labelKey: "adminUsers" },
    ],
  },
  {
    labelKey: "adminNavGroupBeta",
    items: [
      { to: "/admin/beta", labelKey: "adminBeta" },
      { to: "/admin/badges", labelKey: "adminBadges" },
      { to: "/admin/feedback", labelKey: "adminFeedback" },
    ],
  },
  {
    labelKey: "adminNavGroupSystem",
    items: [
      { to: "/admin/audit", labelKey: "adminAudit" },
      { to: "/admin/flags", labelKey: "adminFlags" },
    ],
  },
];

function AdminLayout() {
  const { loading, user, session, error, refresh, signOut } = useSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (loading) {
    return (
      <div className="admin-shell admin-shell-loading">
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

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar" aria-label={he.adminNav}>
        <div className="admin-brand">
          <p className="admin-brand-mark">SITE SECURE</p>
          <p className="admin-brand-role">{he.adminPlatformBadge}</p>
          <p className="admin-brand-email ltr-meta">{session?.email}</p>
        </div>

        <nav className="admin-nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.labelKey} className="admin-nav-group">
              <p className="admin-nav-group-label">{he[group.labelKey]}</p>
              {group.items.map((item) => {
                const active = item.exact ? pathname === item.to || pathname === `${item.to}/` : pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn("admin-nav-link", active && "is-active")}
                    aria-current={active ? "page" : undefined}
                  >
                    {he[item.labelKey]}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
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

      <div className="admin-main-column">
        <header className="admin-topbar">
          <div>
            <p className="admin-topbar-kicker">{he.adminPlatformTitle}</p>
            <p className="admin-topbar-title">{he.adminConsoleTitle}</p>
          </div>
          <div className="admin-topbar-meta">
            <span className="admin-pill">{he.adminPillInternal}</span>
            <span className="ltr-meta text-xs text-fg-muted">{session?.email}</span>
          </div>
        </header>
        <main id="main" className="admin-main">
          <Outlet />
        </main>
      </div>
      <FeedbackCenter />
    </div>
  );
}
