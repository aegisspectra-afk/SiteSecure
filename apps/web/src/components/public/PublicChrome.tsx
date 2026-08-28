import { Button, Drawer, cn } from "@site-secure/ui";
import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
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
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const workspaceCta = user
    ? error && !session
      ? { to: "/login" as const, label: pub.sessionUnavailable }
      : {
          to: afterAuthPath(Boolean(session?.has_workspace)),
          label: session?.has_workspace ? pub.enterWorkspace : pub.continueOnboarding,
        }
    : null;

  const links = (
    <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:gap-7">
      {nav.map((item) => (
        <a
          key={item.href}
          href={`/${item.href}`}
          className="ltr-meta rounded-[var(--radius-control)] px-1.5 py-2 text-[13px] tracking-[0.06em] text-fg-muted transition-colors duration-200 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
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
          <Link
            to={workspaceCta.to}
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] bg-action px-4 text-sm font-medium text-action-fg transition-[background-color,transform] duration-200 hover:bg-action-hover"
            onClick={() => setOpen(false)}
          >
            {workspaceCta.label}
          </Link>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] px-3 text-sm font-medium text-fg-muted transition-colors duration-200 hover:text-fg"
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
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] px-3 text-sm font-medium text-fg-muted transition-colors duration-200 hover:text-fg"
            onClick={() => setOpen(false)}
          >
            {pub.login}
          </Link>
          <Link
            to="/register"
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] bg-action px-4 text-sm font-medium text-action-fg transition-[background-color,transform] duration-200 hover:bg-action-hover"
            onClick={() => setOpen(false)}
          >
            {pub.joinPilot}
          </Link>
        </>
      )}
    </div>
  );

  return (
    <header
      className={cn(
        "public-nav sticky top-0 z-40 border-b transition-[background-color,border-color,backdrop-filter] duration-300",
        scrolled ? "public-nav-scrolled" : "public-nav-top",
      )}
      dir="ltr"
    >
      <div className="public-nav-inner relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link
          to="/"
          className="ltr-meta relative z-10 text-sm font-semibold tracking-[0.22em] text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {pub.brand}
        </Link>
        <nav className="pointer-events-none absolute inset-x-0 hidden justify-center lg:flex" aria-label="Marketing">
          <div className="pointer-events-auto">{links}</div>
        </nav>
        <div className="relative z-10 hidden lg:flex">{actions}</div>
        <div className="relative z-10 lg:hidden">
          <Button variant="ghost" className="min-w-11" aria-label={pub.menu} onClick={() => setOpen(true)}>
            <Menu className="size-5" aria-hidden />
          </Button>
        </div>
      </div>
      <Drawer open={open} onClose={() => setOpen(false)} title={pub.brand}>
        <div className="flex flex-col gap-6 p-4" dir="ltr">
          {links}
          {actions}
        </div>
      </Drawer>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border px-4 py-16" dir="ltr">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))]">
        <div>
          <Link
            to="/"
            className="ltr-meta text-sm font-semibold tracking-[0.22em] text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {pub.brand}
          </Link>
          <p className="ltr-meta mt-5 whitespace-pre-line text-sm leading-7 tracking-[0.06em] text-fg-muted">
            {pub.footerTag}
          </p>
        </div>

        <div>
          <p className="public-mono text-[11px] tracking-[0.18em] text-fg-muted">{pub.footerPlatform}</p>
          <nav className="mt-4 flex flex-col gap-3 text-sm" aria-label="Platform">
            <a href="/#operations" className="ltr-meta text-fg-muted transition-colors hover:text-fg">
              {pub.navPlatform}
            </a>
            <a href="/#site-file" className="ltr-meta text-fg-muted transition-colors hover:text-fg">
              {pub.navSiteFile}
            </a>
            <a href="/#twin" className="ltr-meta text-fg-muted transition-colors hover:text-fg">
              {pub.navTwin}
            </a>
            <a href="/#security" className="ltr-meta text-fg-muted transition-colors hover:text-fg">
              {pub.navSecurity}
            </a>
          </nav>
        </div>

        <div>
          <p className="public-mono text-[11px] tracking-[0.18em] text-fg-muted">{pub.footerCompany}</p>
          <nav className="mt-4 flex flex-col gap-3 text-sm" aria-label="Company">
            <a href="/#pilot" className="ltr-meta text-fg-muted transition-colors hover:text-fg">
              {pub.footerEarlyAccess}
            </a>
            <a href="mailto:info@aegisspectra.co.il" className="ltr-meta text-fg-muted transition-colors hover:text-fg">
              {pub.footerContact}
            </a>
          </nav>
        </div>

        <div>
          <p className="public-mono text-[11px] tracking-[0.18em] text-fg-muted">{pub.footerLegal}</p>
          <div className="mt-4" dir="rtl">
            <LegalNav className="flex-col items-start gap-y-3 text-fg-muted" />
          </div>
        </div>
      </div>
      <p className="ltr-meta mx-auto mt-14 max-w-6xl text-xs tracking-[0.04em] text-fg-muted">{pub.footerCopyright}</p>
    </footer>
  );
}

export function CtaLink({
  to,
  children,
  variant = "primary",
  className,
}: {
  to: "/login" | "/register" | "/app" | "/onboarding";
  children: string;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex min-h-12 items-center justify-center rounded-[var(--radius-control)] px-5 text-sm font-medium transition-[background-color,border-color] duration-200",
        variant === "primary"
          ? "bg-action text-action-fg hover:bg-action-hover"
          : "border border-border bg-transparent text-fg hover:bg-public-elevated",
        className,
      )}
    >
      {children}
    </Link>
  );
}
