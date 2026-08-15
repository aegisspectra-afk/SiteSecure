import { cn, Drawer, Dropdown, DropdownItem } from "@site-secure/ui";
import { Menu } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { he } from "../i18n/he";
import { appNav, roleLabel } from "../lib/app-nav";
import { useDocumentMeta } from "../lib/document-meta";
import { useSession } from "../lib/session";

export function AppShell({ children }: { children: ReactNode }) {
  const { session, signOut } = useSession();
  const membership = session?.memberships[0];
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  useDocumentMeta({
    title: `${he.brand} — ${he.homeTitle}`,
    robots: "noindex, nofollow",
  });
  const groups = appNav(membership?.role_key, membership?.features ?? []);

  const navList = (
    <nav aria-label="ראשי" className="flex flex-col gap-6 p-3">
      {groups.map((group) => (
        <div key={group.id} className="flex flex-col gap-1">
          <p className="public-mono px-3 text-[10px] tracking-[0.16em] text-fg-muted">{group.label}</p>
          {group.items.map((item) => {
            const selected =
              item.to === "/app/settings"
                ? pathname === "/app/settings" || pathname === "/app/settings/"
                : pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-[var(--radius-control)] px-3 py-2 text-sm",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                  selected
                    ? "border-s-2 border-action bg-bg-subtle font-semibold text-fg"
                    : "border-s-2 border-transparent text-fg-muted hover:bg-bg-subtle hover:text-fg",
                )}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-dvh bg-bg-0">
      <a href="#main" className="skip-link">
        דלגו לתוכן
      </a>
      <aside className="hidden w-60 shrink-0 border-e border-border bg-bg-1 lg:flex lg:flex-col">
        <div className="border-b border-border px-4 py-4">
          <p className="text-sm font-semibold text-fg">{he.brand}</p>
          <p className="mt-2 truncate text-sm text-fg">{membership?.workspace_name}</p>
          <p className="text-xs text-fg-muted">{roleLabel(membership?.role_key)}</p>
        </div>
        <div className="flex-1 overflow-y-auto">{navList}</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-3 border-b border-border bg-bg-1 px-4">
          <button
            type="button"
            className="rounded-[var(--radius-control)] p-2 hover:bg-bg-subtle lg:hidden"
            aria-label={he.menu}
            onClick={() => setOpen(true)}
          >
            <Menu className="size-5" />
          </button>
          <p className="truncate text-sm font-medium text-fg">{membership?.workspace_name}</p>
          <Dropdown label={<span className="max-w-40 truncate text-sm">{session?.email}</span>}>
            <DropdownItem onClick={() => void signOut()}>{he.signOut}</DropdownItem>
          </Dropdown>
        </header>
        <main id="main" className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
      <Drawer open={open} onClose={() => setOpen(false)} title={he.brand}>
        {navList}
      </Drawer>
    </div>
  );
}
