import { Drawer } from "@site-secure/ui";
import { useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { he } from "../i18n/he";
import { appNav, bottomNav } from "../lib/app-nav";
import { can, canAny } from "../lib/can";
import { useDocumentMeta } from "../lib/document-meta";
import { dayGreeting } from "../lib/greeting";
import { useOnlineStatus } from "../lib/use-online-status";
import { useSession } from "../lib/session";
import { greetingLine, workspaceSystemChecks } from "../lib/workspace-header";
import { AppBottomNav } from "./AppBottomNav";
import { SidebarAccount, SidebarBrand, SidebarExternal, SidebarNav } from "./AppSidebar";
import { UserAccountMenu } from "./UserAccountMenu";
import { WorkspaceSystemStatus } from "./WorkspaceSystemStatus";

export function AppShell({ children }: { children: ReactNode }) {
  const { session, user, error, signOut } = useSession();
  const navigate = useNavigate();
  const membership = session?.memberships[0];
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const features = membership?.features ?? [];
  const roleKey = membership?.role_key;
  const groups = appNav(roleKey, features);
  const tabs = bottomNav(roleKey, features);
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
  const greeting = greetingLine(dayGreeting(), session?.profile?.full_name);
  const statusLabel = workspaceActive ? he.statusOperational : he.workspaceInactive;
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
  };
  useDocumentMeta({
    title: `${membership?.workspace_name ?? he.brand} — ${he.homeTitle}`,
    robots: "noindex, nofollow",
  });

  const nav = <SidebarNav groups={groups} pathname={pathname} onNavigate={() => setOpen(false)} />;
  const external = <SidebarExternal onNavigate={() => setOpen(false)} />;
  const brand = (
    <SidebarBrand
      workspaceName={membership?.workspace_name}
      roleKey={roleKey}
      planKey={membership?.plan_key}
    />
  );

  return (
    <div className="ops-shell flex min-h-dvh">
      <a href="#main" className="skip-link">
        דלגו לתוכן
      </a>
      <aside className="ops-sidebar" aria-label={he.navDesktop}>
        {brand}
        <div className="ops-sidebar-scroll">{nav}</div>
        {external}
        <SidebarAccount {...account} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-border bg-bg-1 px-4 py-3 lg:px-6">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-fg lg:text-base">{greeting}</p>
            <p className="public-mono mt-1 truncate text-[10px] tracking-[0.16em] text-fg-muted">
              {membership?.workspace_name} · {he.overviewKicker}
            </p>
            <p className="mt-1 text-sm text-fg">{statusLabel}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
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
      <AppBottomNav items={tabs} pathname={pathname} moreOpen={open} onMore={() => setOpen(true)} />
      <Drawer open={open} onClose={() => setOpen(false)} title={he.navMore}>
        {brand}
        {nav}
        {external}
        <SidebarAccount {...account} />
      </Drawer>
    </div>
  );
}