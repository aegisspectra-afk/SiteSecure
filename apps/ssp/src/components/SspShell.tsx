import { Button } from "@site-secure/ui";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { he } from "../i18n/he";
import { platformHomeUrl } from "../lib/env";
import { useOrg } from "../lib/org";
import { productRoleLabelHe } from "../lib/productAuthz";
import { useSession } from "../lib/session";

type NavItem = { to: string; label: string; exact?: boolean; show: boolean };

export function SspShell() {
  const { session, signOut } = useSession();
  const { org, productRole, sspCan } = useOrg();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const canSeeSites = sspCan("ssp.sites.view") || sspCan("ssp.forms.view");
  const canSeeForms = sspCan("ssp.forms.view");
  const canSeeWork = canSeeForms || sspCan("ssp.submissions.view") || sspCan("ssp.dashboard.view");

  const canSeeTemplates =
    canSeeForms || sspCan("ssp.patrols.view") || sspCan("ssp.settings.view") || sspCan("ssp.org.view");
  const ops: NavItem[] = [
    {
      to: "/",
      label: he.navDashboard,
      exact: true,
      show: sspCan("ssp.dashboard.view") || canSeeForms,
    },
    {
      to: "/alerts",
      label: he.navOpsCenter,
      show: sspCan("ssp.dashboard.view") || sspCan("ssp.events.view") || canSeeWork,
    },
    { to: "/patrols", label: he.navPatrolsMain, show: sspCan("ssp.patrols.view") },
    { to: "/activity", label: he.navWork, show: canSeeWork },
    { to: "/events", label: he.navEventsHub, show: sspCan("ssp.events.view") },
    { to: "/sites", label: he.navSites, show: canSeeSites },
    { to: "/mobility", label: he.navMobility, show: canSeeSites },
    {
      to: "/users",
      label: he.navUsers,
      show: canSeeSites || sspCan("ssp.officers.view") || sspCan("ssp.org.view"),
    },
    { to: "/messages", label: he.navMessages, show: canSeeWork },
    { to: "/templates", label: he.navTemplatesHub, show: canSeeTemplates },
  ];
  const utility: NavItem[] = [{ to: "/scan", label: he.navScan, show: sspCan("ssp.scans.create") }];

  function renderGroup(title: string, items: NavItem[]) {
    const visible = items.filter((item) => item.show);
    if (!visible.length) return null;
    return (
      <div className="flex flex-col gap-1">
        <p className="px-2 text-[11px] font-medium uppercase tracking-wide text-fg-muted">{title}</p>
        <div className="flex flex-col gap-0.5">
          {visible.map((tab) => {
            const active = tab.exact ? pathname === tab.to : pathname === tab.to || pathname.startsWith(`${tab.to}/`);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={
                  active
                    ? "rounded-md bg-bg-subtle px-3 py-2 text-sm font-medium text-fg"
                    : "rounded-md px-3 py-2 text-sm text-fg-muted hover:bg-bg-subtle hover:text-fg"
                }
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row" data-testid="ssp-shell" dir="rtl">
      <aside
        className="ssp-print-hide w-full shrink-0 border-b border-border bg-bg px-3 py-4 lg:w-64 lg:border-b-0 lg:border-e"
        aria-label={he.sspTitle}
        data-testid="ssp-nav"
      >
        <div className="mb-4 px-2">
          <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">{he.platformBrand}</p>
          <h1 className="mt-1 text-lg font-semibold tracking-tight text-fg">{he.brand}</h1>
          <p className="mt-0.5 text-xs text-fg-muted">{he.sspProductLine}</p>
          {session?.memberships[0]?.workspace_name ? (
            <p className="mt-1 text-xs text-fg-muted">{session.memberships[0].workspace_name}</p>
          ) : null}
          <p className="mt-2 text-xs text-fg-muted" data-testid="ssp-shell-org">
            {org?.company ? `${org.company.name} · ${org.company.company_id}` : he.orgNoCompany}
            {" · "}
            {he.roleBadge}: {productRoleLabelHe(productRole)}
          </p>
        </div>
        <nav className="flex flex-col gap-4">
          {renderGroup(he.navOps, ops)}
          {renderGroup(he.navScan, utility)}
        </nav>
        <div className="mt-6 flex flex-wrap gap-2 px-2">
          <Button type="button" variant="ghost" onClick={() => window.location.assign(platformHomeUrl())}>
            {he.backToPlatform}
          </Button>
          <Button type="button" variant="secondary" onClick={() => void signOut()}>
            {he.signOut}
          </Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
