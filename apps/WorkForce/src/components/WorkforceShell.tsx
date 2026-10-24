import { Button } from "@site-secure/ui";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { he } from "../i18n/he";
import { openConfiguredUrl, platformHomeUrl } from "../lib/env";
import {
  NAV_GROUP_LABEL,
  splitWorkforceMobileNav,
  workforceNavItems,
  type WorkforceNavGroup,
  type WorkforceNavItem,
} from "../lib/nav";
import { useSession } from "../lib/session";

const GROUP_ORDER: WorkforceNavGroup[] = ["ops", "requests", "self", "admin"];

function navActive(pathname: string, to: WorkforceNavItem["to"]): boolean {
  return to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);
}

function NavLink({ item, pathname, onNavigate }: { item: WorkforceNavItem; pathname: string; onNavigate?: () => void }) {
  const active = navActive(pathname, item.to);
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      className={
        active
          ? "rounded-md bg-bg-subtle px-3 py-2 text-sm font-medium text-fg"
          : "rounded-md px-3 py-2 text-sm text-fg-muted hover:bg-bg-subtle hover:text-fg"
      }
    >
      {item.label}
    </Link>
  );
}

export function WorkforceShell() {
  const { session, signOut } = useSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const membership = session?.memberships[0];
  const items = workforceNavItems({
    roleKey: membership?.role_key,
    features: membership?.features ?? [],
    permissions: membership?.permissions ?? null,
  });
  const { primary, overflow } = splitWorkforceMobileNav(items);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  const account = (
    <div className="flex flex-wrap gap-2 px-2">
      {platformHomeUrl() ? (
        <Button type="button" variant="ghost" onClick={() => openConfiguredUrl(platformHomeUrl())}>
          {he.backToPlatform}
        </Button>
      ) : null}
      <Button type="button" variant="secondary" onClick={() => void signOut()}>
        {he.signOut}
      </Button>
    </div>
  );

  return (
    <div className="wf-shell" data-testid="workforce-product-shell" dir="rtl">
      <header className="wf-topbar lg:hidden">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-fg-muted">{he.platformBrand}</p>
          <h1 className="text-base font-semibold tracking-tight text-fg">{he.brand}</h1>
        </div>
        {membership?.workspace_name ? (
          <p className="wf-topbar-workspace text-xs text-fg-muted">{membership.workspace_name}</p>
        ) : null}
      </header>

      <aside className="wf-sidebar hidden lg:flex" aria-label={he.brand} data-testid="workforce-nav">
        <div className="mb-4 px-2">
          <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">{he.platformBrand}</p>
          <h1 className="mt-1 text-lg font-semibold tracking-tight text-fg">{he.brand}</h1>
          <p className="mt-0.5 text-xs text-fg-muted">{he.productLine}</p>
          {membership?.workspace_name ? (
            <p className="mt-1 text-xs text-fg-muted">{membership.workspace_name}</p>
          ) : null}
        </div>
        <nav className="flex flex-col gap-3">
          {GROUP_ORDER.map((group) => {
            const grouped = items.filter((item) => item.group === group);
            if (!grouped.length) return null;
            return (
              <div key={group} className="flex flex-col gap-0.5">
                <p className="px-2 text-[11px] font-medium uppercase tracking-wide text-fg-muted">
                  {NAV_GROUP_LABEL[group]}
                </p>
                {grouped.map((tab) => (
                  <NavLink key={tab.to} item={tab} pathname={pathname} />
                ))}
              </div>
            );
          })}
        </nav>
        <div className="mt-6">{account}</div>
      </aside>

      <main id="main" className="wf-main">
        <div className="wf-page">
          <Outlet />
        </div>
      </main>

      <nav className="wf-bottom-nav lg:hidden" aria-label={he.brand}>
        {primary.map((item) => {
          const active = navActive(pathname, item.to);
          return (
            <Link key={item.to} to={item.to} className={active ? "is-active" : undefined}>
              {item.label}
            </Link>
          );
        })}
        {overflow.length ? (
          <button type="button" className={moreOpen ? "is-active" : undefined} aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)}>
            {he.navMore}
          </button>
        ) : null}
      </nav>

      {moreOpen ? (
        <div className="wf-more-root lg:hidden" role="presentation">
          <button type="button" className="wf-more-backdrop" aria-label={he.closeDetails} onClick={() => setMoreOpen(false)} />
          <div className="wf-more-sheet" role="dialog" aria-modal="true" aria-labelledby="wf-more-title">
            <div className="wf-more-head">
              <h2 id="wf-more-title">{he.navMoreTitle}</h2>
              <Button type="button" variant="ghost" onClick={() => setMoreOpen(false)}>
                {he.closeDetails}
              </Button>
            </div>
            <nav className="flex flex-col gap-1">
              {overflow.map((item) => (
                <NavLink key={item.to} item={item} pathname={pathname} onNavigate={() => setMoreOpen(false)} />
              ))}
            </nav>
            <div className="mt-4">{account}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
