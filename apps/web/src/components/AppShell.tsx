import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { he } from "../i18n/he";
import {
  appNav,
  bottomNav,
  isMoreNavSelected,
  isWorkNavSelected,
  mobileMoreNav,
  mobileWorkNav,
} from "../lib/app-nav";
import { can, canAny } from "../lib/can";
import { useDocumentMeta } from "../lib/document-meta";
import { useOnlineStatus } from "../lib/use-online-status";
import { useSession } from "../lib/session";
import { workspaceSystemChecks } from "../lib/workspace-header";
import { CommandPalette, useCommandPaletteHotkey } from "./CommandPalette";
import { AppBottomNav } from "./AppBottomNav";
import { FeedbackCenter } from "./FeedbackCenter";
import { MobileMoreSheet } from "./MobileMoreSheet";
import { MobileWorkSheet } from "./MobileWorkSheet";
import { SidebarAccount, SidebarBrand, SidebarExternal, SidebarNav } from "./AppSidebar";
import { UserAccountMenu } from "./UserAccountMenu";
import { WorkspaceSystemStatus } from "./WorkspaceSystemStatus";
import { Search } from "lucide-react";

const COLLAPSE_KEY = "site-secure-sidebar-collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

export function AppShell({ children }: { children: ReactNode }) {
  const { session, user, error, signOut } = useSession();
  const navigate = useNavigate();
  const membership = session?.memberships[0];
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [moreOpen, setMoreOpen] = useState(false);
  const [workOpen, setWorkOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const features = membership?.features ?? [];
  const roleKey = membership?.role_key;
  const groups = appNav(roleKey, features);
  const tabs = bottomNav(roleKey, features);
  const workItems = mobileWorkNav(roleKey, features);
  const moreGroups = mobileMoreNav(roleKey, features);
  const displayName = session?.profile?.full_name?.trim() || session?.email || he.brand;
  const workspaceActive = membership?.workspace_status === "active";
  const online = useOnlineStatus();
  const checks = workspaceSystemChecks({
    workspaceStatus: membership?.workspace_status,
    hasSession: Boolean(session),
    sessionError: error,
    online,
    authenticated: Boolean(user),
  });
  const account = {
    displayName,
    email: session?.email,
    roleKey,
    planKey: membership?.plan_key,
    canSettings: can(roleKey, "workspace.edit", features),
    canSecurity: canAny(roleKey, ["settings.general", "workspace.edit"], features),
    canUsers: can(roleKey, "users.view", features),
    onSettings: () => void navigate({ to: "/app/settings" }),
    onSecurity: () => void navigate({ to: "/app/settings/security" }),
    onUsers: () => void navigate({ to: "/app/settings/users" }),
    onSignOut: () => void signOut(),
    onAdmin: () => void navigate({ to: "/admin" }),
    isBeta: Boolean(membership?.is_beta),
    isPlatformAdmin: Boolean(session?.is_platform_admin),
  };
  useDocumentMeta({
    title: `${membership?.workspace_name ?? he.brand} — ${he.homeTitle}`,
    robots: "noindex, nofollow",
  });

  useEffect(() => {
    setCollapsed(readCollapsed());
  }, []);

  useEffect(() => {
    function onSidebarCollapse(event: Event) {
      const detail = (event as CustomEvent<{ collapsed?: boolean }>).detail;
      if (typeof detail?.collapsed !== "boolean") return;
      setCollapsed(detail.collapsed);
      try {
        localStorage.setItem(COLLAPSE_KEY, detail.collapsed ? "1" : "0");
      } catch {
        /* ignore */
      }
    }
    window.addEventListener("site-secure:sidebar-collapse", onSidebarCollapse);
    return () => window.removeEventListener("site-secure:sidebar-collapse", onSidebarCollapse);
  }, []);

  useEffect(() => {
    const onQuoteWorkspace = /^\/app\/quotes\/[^/]+/.test(pathname);
    if (!onQuoteWorkspace) return;
    setCollapsed(true);
  }, [pathname]);

  useEffect(() => {
    setMoreOpen(false);
    setWorkOpen(false);
    setCommandOpen(false);
  }, [pathname]);

  useCommandPaletteHotkey(() => setCommandOpen(true));

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

  const brand = (
    <SidebarBrand
      workspaceName={membership?.workspace_name}
      planKey={membership?.plan_key}
      workspaceActive={workspaceActive}
      collapsed={collapsed}
      onToggleCollapse={toggleCollapse}
    />
  );

  return (
    <div className={`ops-shell flex min-h-dvh${collapsed ? " is-sidebar-collapsed" : ""}`}>
      <a href="#main" className="skip-link">
        דלגו לתוכן
      </a>
      <aside className="ops-sidebar" aria-label={he.navDesktop} data-collapsed={collapsed ? "true" : "false"}>
        {brand}
        <div className="ops-sidebar-scroll">
          <SidebarNav groups={groups} pathname={pathname} collapsed={collapsed} />
        </div>
        <SidebarExternal collapsed={collapsed} />
        <SidebarAccount {...account} collapsed={collapsed} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-bg-1 px-4 py-3 lg:px-6">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-fg lg:text-base">
              {membership?.workspace_name ?? he.brand}
            </p>
            <p className="mt-0.5 text-xs text-fg-muted">
              {workspaceActive ? he.workspaceActive : he.workspaceInactive}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <button
              type="button"
              className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] border border-border bg-bg-1 px-3 text-sm text-fg-muted hover:bg-bg-subtle hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              onClick={() => setCommandOpen(true)}
              aria-label={he.commandOpenSearch}
            >
              <Search className="size-4" aria-hidden />
              <span className="hidden sm:inline">{he.commandOpenSearch}</span>
              <kbd className="ltr-meta hidden rounded border border-border px-1.5 py-0.5 text-[10px] text-fg-subtle md:inline">
                Ctrl K
              </kbd>
            </button>
            <WorkspaceSystemStatus checks={checks} />
            <div className="lg:hidden">
              <UserAccountMenu {...account} />
            </div>
          </div>
        </header>
        <main id="main" className="ops-main flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
      <FeedbackCenter />
      <AppBottomNav
        items={tabs}
        pathname={pathname}
        moreOpen={moreOpen}
        workOpen={workOpen}
        workActive={isWorkNavSelected(pathname, workItems)}
        moreActive={isMoreNavSelected(pathname, moreGroups, workItems)}
        onMore={() => {
          setWorkOpen(false);
          setMoreOpen(true);
        }}
        onWork={() => {
          setMoreOpen(false);
          setWorkOpen(true);
        }}
      />
      <MobileWorkSheet open={workOpen} onClose={() => setWorkOpen(false)} pathname={pathname} items={workItems} />
      <MobileMoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        pathname={pathname}
        roleKey={roleKey}
        features={features}
        workspaceName={membership?.workspace_name}
        planKey={membership?.plan_key}
        workspaceActive={workspaceActive}
        displayName={displayName}
        email={session?.email}
        canSettings={account.canSettings}
        isBeta={Boolean(membership?.is_beta)}
        isPlatformAdmin={Boolean(session?.is_platform_admin)}
        onSettings={account.onSettings}
        onAdmin={() => void navigate({ to: "/admin" })}
        onSignOut={account.onSignOut}
      />
    </div>
  );
}
