import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { he } from "../../i18n/he";
import { displayWorkspaceName } from "../../lib/quotes";
import { workforceBottomNav, workforceNavGroups } from "../../lib/workforce-nav";
import { useOnlineStatus } from "../../lib/use-online-status";
import { useSession } from "../../lib/session";
import { workspaceSystemChecks } from "../../lib/workspace-header";
import { AppBottomNav } from "../AppBottomNav";
import { SidebarAccount, SidebarBrand, SidebarNav } from "../AppSidebar";
import { UserAccountMenu } from "../UserAccountMenu";
import { WorkspaceSwitcher } from "../WorkspaceSwitcher";
import { WorkspaceSystemStatus } from "../WorkspaceSystemStatus";

const COLLAPSE_KEY = "site-secure-workforce-sidebar-collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

export function WorkforceProductShell({ children }: { children?: ReactNode }) {
  const { session, signOut } = useSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const membership = session?.memberships[0];
  const roleKey = membership?.role_key;
  const features = membership?.features ?? [];
  const permissions = membership?.permissions;
  const workspaceActive = membership?.workspace_status === "active";
  const online = useOnlineStatus();
  const displayName = session?.profile?.full_name?.trim() || session?.email || he.brand;
  const workspaceLabel = displayWorkspaceName(membership?.workspace_name) || he.workforceTitle;
  const groups = workforceNavGroups({ roleKey, features, permissions });
  const tabs = workforceBottomNav({ roleKey, features, permissions });
  const checks = workspaceSystemChecks({
    workspaceStatus: membership?.workspace_status,
    hasSession: Boolean(session),
    sessionError: null,
    online,
    authenticated: Boolean(session),
  });
  const account = {
    displayName,
    email: session?.email,
    roleKey,
    planKey: membership?.plan_key,
    canSettings: false,
    canSecurity: false,
    canUsers: false,
    onSettings: () => void navigate({ to: "/platform" }),
    onSecurity: () => void navigate({ to: "/platform" }),
    onUsers: () => void navigate({ to: "/platform" }),
    onSignOut: () => void signOut(),
    onAdmin: () => void navigate({ to: "/admin" }),
    isBeta: Boolean(membership?.is_beta),
    recognitionBadges: session?.profile?.recognition_badges ?? [],
    isPlatformAdmin: Boolean(session?.is_platform_admin),
  };

  useEffect(() => {
    setCollapsed(readCollapsed());
  }, []);

  const toggleCollapse = () => {
    setCollapsed((value) => {
      const next = !value;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <div
      className={`ops-shell flex min-h-dvh${collapsed ? " is-sidebar-collapsed" : ""}`}
      data-testid="workforce-product-shell"
    >
      <a href="#main" className="skip-link">
        דלגו לתוכן
      </a>
      <aside
        className="ops-sidebar"
        aria-label={he.workforceTitle}
        data-testid="workforce-nav"
        data-collapsed={collapsed ? "true" : "false"}
      >
        <SidebarBrand
          workspaceName={workspaceLabel}
          planKey={membership?.plan_key}
          workspaceActive={workspaceActive}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
        />
        <div className={collapsed ? "px-1 pb-2" : "px-3 pb-2"}>
          <WorkspaceSwitcher collapsed={collapsed} />
        </div>
        <div className="ops-sidebar-scroll">
          <SidebarNav groups={groups} pathname={pathname} collapsed={collapsed} />
        </div>
        <SidebarAccount {...account} collapsed={collapsed} />
      </aside>
      <div className="ops-content flex min-w-0 flex-1 flex-col">
        <header className="ops-topbar lg:px-6">
          <div className="min-w-0">
            <p className="ops-topbar-title">{workspaceLabel}</p>
            <p className="ops-topbar-meta">{he.workforceProductLine}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Link
              to="/platform"
              className="inline-flex min-h-10 items-center rounded-[var(--radius-control)] border border-border bg-bg-1 px-3 text-sm text-fg-muted transition-colors duration-200 hover:bg-bg-subtle hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {he.platformHomeTitle}
            </Link>
            <WorkspaceSystemStatus checks={checks} />
            <div className="lg:hidden">
              <UserAccountMenu {...account} />
            </div>
          </div>
        </header>
        <main id="main" className="ops-main flex-1 p-4 lg:p-6">
          <div className="ss-module-main">{children ?? <Outlet />}</div>
        </main>
      </div>
      <AppBottomNav items={tabs} pathname={pathname} />
    </div>
  );
}
