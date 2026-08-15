import { cn, Drawer, Dropdown, DropdownItem, Status } from "@site-secure/ui";
import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { he } from "../i18n/he";
import { appNav, bottomNav, isNavSelected, planLabel, roleLabel } from "../lib/app-nav";
import { can, canAny } from "../lib/can";
import { useDocumentMeta } from "../lib/document-meta";
import { dayGreeting } from "../lib/greeting";
import { useSession } from "../lib/session";
import { AppBottomNav } from "./AppBottomNav";
import { NavIcon } from "./NavIcon";

export function AppShell({ children }: { children: ReactNode }) {
  const { session, signOut } = useSession();
  const navigate = useNavigate();
  const membership = session?.memberships[0];
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const features = membership?.features ?? [];
  const roleKey = membership?.role_key;
  const groups = appNav(roleKey, features);
  const tabs = bottomNav(roleKey, features);
  const displayName = session?.profile?.full_name?.trim() || session?.email || he.brand;
  useDocumentMeta({
    title: `${membership?.workspace_name ?? he.brand} — ${he.homeTitle}`,
    robots: "noindex, nofollow",
  });

  const navList = (tone: "dark" | "light") => (
    <nav aria-label="ראשי" className="flex flex-col gap-6 p-3">
      {groups.map((group) => (
        <div key={group.id} className="flex flex-col gap-1">
          <p
            className={cn(
              "public-mono px-3 text-[10px] tracking-[0.16em]",
              tone === "dark" ? "text-[var(--color-auth-muted)]" : "text-fg-muted",
            )}
          >
            {group.label}
          </p>
          {group.items.map((item) => {
            const selected = isNavSelected(item.to, pathname);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "ops-sidebar-link flex items-center gap-2 rounded-[var(--radius-control)] px-3 py-2 text-sm",
                  "focus-visible:outline-2 focus-visible:outline-offset-2",
                  tone === "dark"
                    ? "focus-visible:outline-[var(--color-auth-accent)]"
                    : "focus-visible:outline-focus",
                  selected
                    ? tone === "dark"
                      ? "border-s-2 border-[var(--color-auth-accent)] bg-[var(--color-auth-elevated)] font-semibold text-[var(--color-auth-fg)]"
                      : "border-s-2 border-action bg-bg-subtle font-semibold text-fg"
                    : tone === "dark"
                      ? "border-s-2 border-transparent text-[var(--color-auth-muted)] hover:bg-[var(--color-auth-elevated)] hover:text-[var(--color-auth-fg)]"
                      : "border-s-2 border-transparent text-fg-muted hover:bg-bg-subtle hover:text-fg",
                )}
                aria-current={selected ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                <NavIcon
                  name={item.icon}
                  active={selected}
                  className="size-4 shrink-0"
                />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="ops-shell flex min-h-dvh">
      <a href="#main" className="skip-link">
        דלגו לתוכן
      </a>
      <aside className="ops-sidebar hidden w-60 shrink-0 lg:flex lg:flex-col">
        <div className="border-b border-[var(--color-auth-border)] px-4 py-4">
          <p className="text-sm font-semibold tracking-[-0.02em] text-[var(--color-auth-fg)]">{he.brand}</p>
          <p className="public-mono mt-1 text-[10px] tracking-[0.16em] text-[var(--color-auth-muted)]">
            {he.opsPlatform}
          </p>
          <p className="mt-4 truncate text-sm font-medium text-[var(--color-auth-fg)]">
            {membership?.workspace_name}
          </p>
          <p className="text-xs text-[var(--color-auth-muted)]">
            {roleLabel(roleKey)}
            {membership?.plan_key ? ` · ${planLabel(membership.plan_key)}` : ""}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">{navList("dark")}</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 items-center justify-between gap-3 border-b border-border bg-bg-1 px-4 py-2 lg:px-6">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-fg lg:text-base">
              {dayGreeting()}
              {session?.profile?.full_name ? ` · ${session.profile.full_name}` : ""}
            </p>
            <div className="mt-0.5 hidden items-center gap-3 sm:flex">
              <p className="truncate text-xs text-fg-muted">
                {membership?.workspace_name} · {he.overviewKicker}
              </p>
              <Status label={he.statusOperational} tone="success" />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="sm:hidden">
              <Status label={he.statusOperational} tone="success" />
            </span>
            <Dropdown
              label={
                <span className="flex max-w-48 flex-col items-start text-start">
                  <span className="max-w-40 truncate text-sm font-medium">{displayName}</span>
                  <span className="ltr-meta max-w-40 truncate text-[11px] text-fg-muted">{session?.email}</span>
                </span>
              }
            >
              <div className="border-b border-border px-3 py-2">
                <p className="truncate text-sm font-medium text-fg">{displayName}</p>
                <p className="ltr-meta truncate text-xs text-fg-muted">{session?.email}</p>
                <p className="mt-1 text-xs text-fg-muted">
                  {roleLabel(roleKey)}
                  {membership?.plan_key ? ` · ${planLabel(membership.plan_key)}` : ""}
                </p>
              </div>
              {can(roleKey, "workspace.edit", features) ? (
                <DropdownItem onClick={() => void navigate({ to: "/app/settings" })}>{he.navSettings}</DropdownItem>
              ) : null}
              {canAny(roleKey, ["settings.general", "workspace.edit"], features) ? (
                <DropdownItem onClick={() => void navigate({ to: "/app/settings/security" })}>
                  {he.navSecurity}
                </DropdownItem>
              ) : null}
              {can(roleKey, "users.view", features) ? (
                <DropdownItem onClick={() => void navigate({ to: "/app/settings/users" })}>{he.navUsers}</DropdownItem>
              ) : null}
              <DropdownItem onClick={() => void signOut()}>{he.signOut}</DropdownItem>
            </Dropdown>
          </div>
        </header>
        <main id="main" className="ops-main flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
      <AppBottomNav items={tabs} pathname={pathname} moreOpen={open} onMore={() => setOpen(true)} />
      <Drawer open={open} onClose={() => setOpen(false)} title={he.navMore}>
        {navList("light")}
      </Drawer>
    </div>
  );
}
