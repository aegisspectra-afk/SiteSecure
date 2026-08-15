import { Button, Drawer, cn } from "@site-secure/ui";
import { Menu } from "lucide-react";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { pub } from "../../i18n/public-he";
import { afterAuthPath } from "../../lib/auth-routes";
import { useSession } from "../../lib/session";
import { LegalNav } from "./LegalNav";

const nav = [
  { href: "#operations", label: pub.navPlatform },
  { href: "#site-file", label: pub.navSiteFile },
  { href: "#twin", label: pub.navTwin },
  { href: "#security", label: pub.navSecurity },
] as const;

export function PublicHeader() {
  const { user, session, error, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const email = user?.email ?? session?.email ?? null;
  const workspaceCta = user
    ? error && !session
      ? { to: "/login" as const, label: pub.sessionUnavailable }
      : {
          to: afterAuthPath(Boolean(session?.has_workspace)),
          label: session?.has_workspace ? pub.enterWorkspace : pub.continueOnboarding,
        }
    : null;

  const links = (
    <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:gap-8">
      {nav.map((item) => (
        <a
          key={item.href}
          href={`/${item.href}`}
          className="ltr-meta rounded-[var(--radius-control)] px-2 py-2 text-[13px] tracking-[0.08em] text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          onClick={() => setOpen(false)}
        >
          {item.label}
        </a>
      ))}
    </div>
  );

  const actions = (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
      {workspaceCta ? (
        <>
          <p className="ltr-meta max-w-56 truncate text-xs tracking-[0.04em] text-fg-muted" title={email ?? undefined}>
            {email ?? pub.signedInUnknown}
          </p>
          <Link
            to={workspaceCta.to}
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] bg-action px-4 text-sm font-medium text-action-fg hover:bg-action-hover"
            onClick={() => setOpen(false)}
          >
            {workspaceCta.label}
          </Link>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] px-3 text-sm font-medium text-fg-muted hover:text-fg"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
          >
            {pub.signOut}
          </button>
        </>
      ) : (
        <>
          <Link
            to="/login"
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] px-3 text-sm font-medium text-fg-muted hover:text-fg"
            onClick={() => setOpen(false)}
          >
            {pub.login}
          </Link>
          <Link
            to="/register"
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] bg-action px-4 text-sm font-medium text-action-fg hover:bg-action-hover"
            onClick={() => setOpen(false)}
          >
            {pub.joinPilot}
          </Link>
        </>
      )}
    </div>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-public-bg/90 backdrop-blur-sm" dir="ltr">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link
          to="/"
          className="ltr-meta text-sm font-semibold tracking-[0.2em] text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {pub.brand}
        </Link>
        <nav className="hidden lg:flex" aria-label="שיווק">
          {links}
        </nav>
        <div className="hidden lg:flex">{actions}</div>
        <Button variant="ghost" className="min-w-11 lg:hidden" aria-label={pub.menu} onClick={() => setOpen(true)}>
          <Menu className="size-5" aria-hidden />
        </Button>
      </div>
      <Drawer open={open} onClose={() => setOpen(false)} title={pub.brand}>
        <div className="flex flex-col gap-6 p-4">
          {links}
          {actions}
        </div>
      </Drawer>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border px-4 py-12" dir="ltr">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <div>
          <Link
            to="/"
            className="ltr-meta text-sm font-semibold tracking-[0.2em] text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {pub.brand}
          </Link>
          <p className="ltr-meta mt-4 max-w-sm text-sm leading-6 tracking-[0.08em] text-fg-muted">{pub.footerTag}</p>
          <p className="ltr-meta mt-6 text-[11px] tracking-[0.16em] text-fg-muted">{pub.operator}</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-3 text-sm" aria-label="כותרת תחתונה">
          <a href="/#operations" className="ltr-meta text-fg-muted hover:text-fg">
            {pub.navPlatform}
          </a>
          <a href="/#security" className="ltr-meta text-fg-muted hover:text-fg">
            {pub.navSecurity}
          </a>
          <a href="/#site-file" className="ltr-meta text-fg-muted hover:text-fg">
            {pub.navSiteFile}
          </a>
          <a href="/#pilot" className="ltr-meta text-fg-muted hover:text-fg">
            {pub.pilotTitle}
          </a>
        </nav>
        <div dir="rtl">
          <LegalNav className="text-fg-muted" />
        </div>
        <p className="ltr-meta text-xs text-fg-muted">{pub.footerLegal}</p>
      </div>
    </footer>
  );
}

export function CtaLink({
  to,
  children,
  variant = "primary",
}: {
  to: "/login" | "/register" | "/app" | "/onboarding";
  children: string;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex min-h-12 items-center justify-center rounded-[var(--radius-control)] px-5 text-sm font-medium",
        variant === "primary"
          ? "bg-action text-action-fg hover:bg-action-hover"
          : "border border-border bg-bg-subtle text-fg hover:bg-public-elevated",
      )}
    >
      {children}
    </Link>
  );
}
