import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { he } from "../../i18n/he";

const NAV = [
  { to: "/portal" as const, label: he.portalNavHome },
  { to: "/portal/quotes" as const, label: he.portalSectionQuotes },
  { to: "/portal/installations" as const, label: he.portalSectionInstallations },
  { to: "/portal/warranties" as const, label: he.portalSectionWarranties },
  { to: "/portal/service" as const, label: he.portalNavServiceForm },
] as const;

export function PortalShell({
  title,
  brand,
  children,
  onSignOut,
}: {
  title: string;
  brand?: string;
  children: ReactNode;
  onSignOut?: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-6">
      <header className="mb-4 flex flex-col gap-3">
        <motionProxy className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.14em] text-fg-muted">{brand || he.portalDefaultBrand}</p>
            <h1 className="text-xl font-semibold text-fg">{title}</h1>
          </div>
          {onSignOut ? (
            <button
              type="button"
              className="rounded-[var(--radius-control)] border border-border px-3 py-2 text-sm text-fg"
              onClick={onSignOut}
            >
              {he.portalSignOut}
            </button>
          ) : null}
        </motionProxy>
        <nav className="flex flex-wrap gap-2" aria-label={he.portalNavLabel}>
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-full border border-border px-3 py-1.5 text-sm text-fg hover:bg-bg-muted"
              activeProps={{ className: "bg-action text-action-fg border-action" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex flex-1 flex-col gap-4">{children}</main>
      <footer className="mt-8 border-t border-border pt-4 text-center text-xs text-fg-muted">
        {he.portalFooterCreated}
      </footer>
    </div>
  );
}

/** Avoid pulling motion lib into portal shell — tiny wrapper for flex row */
function motionProxy({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={className}>{children}</div>;
}