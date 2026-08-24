import { Button, ErrorState, cn } from "@site-secure/ui";
import { Link, Navigate, Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { FeedbackCenter } from "../../components/FeedbackCenter";
import { he } from "../../i18n/he";
import { guestEntryPath } from "../../lib/auth-routes";
import { useSession } from "../../lib/session";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", labelKey: "adminTitle" as const, exact: true },
  { to: "/admin/organizations", labelKey: "adminOrgs" as const, exact: false },
  { to: "/admin/users", labelKey: "adminUsers" as const, exact: false },
  { to: "/admin/feedback", labelKey: "adminFeedback" as const, exact: false },
  { to: "/admin/flags", labelKey: "adminFlags" as const, exact: false },
  { to: "/admin/beta", labelKey: "adminBeta" as const, exact: false },
];

function AdminLayout() {
  const { loading, user, session, error, refresh, signOut } = useSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (loading) return <p className="p-6 text-sm text-fg-muted">{he.loading}</p>;
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
      <nav className="admin-nav" aria-label={he.adminNav}>
        {NAV.map((item) => {
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(active && "is-active")}
              aria-current={active ? "page" : undefined}
            >
              {he[item.labelKey]}
            </Link>
          );
        })}
        <Button variant="secondary" className="ms-auto lg:ms-0 lg:mt-auto" onClick={() => void navigate({ to: "/app" })}>
          {he.adminBackApp}
        </Button>
        <Button variant="ghost" onClick={() => void signOut()}>
          {he.signOut}
        </Button>
      </nav>
      <main id="main" className="flex-1 p-4 lg:p-6">
        <Outlet />
      </main>
      <FeedbackCenter />
    </div>
  );
}
