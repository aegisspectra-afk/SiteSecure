import { Button, Drawer, cn } from "@site-secure/ui";
import { Menu } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { afterAuthPath } from "../../lib/auth-routes";
import { useSession } from "../../lib/session";
import { ThemePicker, type ThemePickerLabels } from "../ThemePicker";
import { LegalNav } from "./LegalNav";
import { PublicLangPicker } from "./PublicLangPicker";
import { usePublicLocale } from "./PublicLocaleProvider";

function usePublicThemeLabels(): ThemePickerLabels {
  const { t } = usePublicLocale();
  return useMemo(
    () => ({
      group: t.themeLabel,
      light: t.themeLight,
      dark: t.themeDark,
      system: t.themeSystem,
      systemHint: t.themeSystemHint,
    }),
    [t.themeDark, t.themeLabel, t.themeLight, t.themeSystem, t.themeSystemHint],
  );
}

export function PublicHeader() {
  const { user, session, error, signOut } = useSession();
  const { t, dir } = usePublicLocale();
  const themeLabels = usePublicThemeLabels();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const nav = [
    { href: "#platform", label: t.navPlatform },
    { href: "#products", label: t.navProducts },
    { href: "#solutions", label: t.navSolutions },
    { href: "#security", label: t.navSecurity },
    { href: "#contact", label: t.navContact },
  ] as const;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const workspaceCta = user
    ? error && !session
      ? { to: "/login" as const, label: t.sessionUnavailable }
      : {
          to: afterAuthPath(Boolean(session?.has_workspace)),
          label: session?.has_workspace ? t.enterWorkspace : t.continueOnboarding,
        }
    : null;

  const links = (
    <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:gap-3 xl:gap-5" dir={dir}>
      {nav.map((item) => (
        <a
          key={item.href}
          href={`/${item.href}`}
          className="rounded-[var(--radius-control)] px-1 py-2 text-[13px] tracking-[0.04em] text-fg-muted transition-colors duration-200 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          onClick={() => setOpen(false)}
        >
          {item.label}
        </a>
      ))}
    </div>
  );

  /* Desktop chrome: language + theme stay LTR so they never flip with locale. */
  const chromeControls = (
    <div className="flex shrink-0 items-center gap-2" dir="ltr">
      <PublicLangPicker id="public-lang-header" compact />
      <ThemePicker
        id="public-theme-header"
        compact
        hideLabel
        labels={themeLabels}
        lockDir="ltr"
      />
    </div>
  );

  const actions = (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-2">
      {workspaceCta ? (
        <>
          <Link
            to={workspaceCta.to}
            className="inline-flex min-h-10 items-center justify-center rounded-[var(--radius-control)] bg-action px-3.5 text-sm font-medium text-action-fg transition-[background-color,transform] duration-200 hover:bg-action-hover"
            onClick={() => setOpen(false)}
          >
            {workspaceCta.label}
          </Link>
          <button
            type="button"
            className="inline-flex min-h-10 items-center justify-center rounded-[var(--radius-control)] px-2.5 text-sm font-medium text-fg-muted transition-colors duration-200 hover:text-fg"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
          >
            {t.signOut}
          </button>
        </>
      ) : (
        <>
          <Link
            to="/login"
            className="inline-flex min-h-10 items-center justify-center rounded-[var(--radius-control)] px-2.5 text-sm font-medium text-fg-muted transition-colors duration-200 hover:text-fg"
            onClick={() => setOpen(false)}
          >
            {t.login}
          </Link>
          <Link
            to="/login"
            className="inline-flex min-h-10 items-center justify-center rounded-[var(--radius-control)] bg-action px-3.5 text-sm font-medium text-action-fg transition-[background-color,transform] duration-200 hover:bg-action-hover"
            onClick={() => setOpen(false)}
          >
            {t.enterWorkspace}
          </Link>
          <Link
            to="/register"
            className="inline-flex min-h-10 items-center justify-center rounded-[var(--radius-control)] px-2.5 text-sm font-medium text-fg-muted transition-colors duration-200 hover:text-fg lg:hidden"
            onClick={() => setOpen(false)}
          >
            {t.joinPilot}
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
      /* Chrome layout stays RTL so brand + controls do not jump when locale flips. */
      dir="rtl"
    >
      <div className="public-nav-inner mx-auto flex min-w-0 max-w-6xl items-center gap-3 px-4 py-3 lg:gap-4">
        <Link
          to="/"
          className="public-nav-brand shrink-0 text-sm font-semibold text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {t.platformBrand}
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center lg:flex" aria-label={t.navAria}>
          {links}
        </nav>

        {/* Desktop: utilities then CTAs on the trailing edge — no absolute overlap. */}
        <div className="hidden shrink-0 items-center gap-3 lg:flex">
          {chromeControls}
          {actions}
        </div>

        {/* Below lg: only the menu trigger — theme + language live in the drawer. */}
        <div className="ms-auto lg:hidden">
          <Button variant="ghost" className="min-w-11" aria-label={t.menu} onClick={() => setOpen(true)}>
            <Menu className="size-5" aria-hidden />
          </Button>
        </div>
      </div>
      <Drawer open={open} onClose={() => setOpen(false)} title={t.platformBrand}>
        <div className="flex flex-col gap-6 p-4" dir={dir}>
          <div className="flex flex-col gap-2">
            <p className="text-xs text-fg-muted">{t.themeLabel}</p>
            <ThemePicker id="public-theme-drawer" labels={themeLabels} lockDir="ltr" />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xs text-fg-muted">{t.languageLabel}</p>
            <PublicLangPicker id="public-lang-drawer" />
          </div>
          {links}
          {actions}
        </div>
      </Drawer>
    </header>
  );
}

export function PublicFooter() {
  const { t, dir } = usePublicLocale();
  const productLinks = t.productCards.map((card) => ({
    href: card.id === "site_secure" ? "/#quotes" : `/#product-${card.id}`,
    label: card.name,
  }));
  return (
    <footer className="border-t border-border px-4 py-16" dir={dir}>
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))]">
        <div>
          <Link
            to="/"
            className="text-sm font-semibold tracking-[0.22em] text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {t.platformBrand}
          </Link>
          <p className="mt-5 whitespace-pre-line text-sm leading-7 tracking-[0.06em] text-fg-muted">{t.footerTag}</p>
        </div>

        <div>
          <p className="public-mono text-[11px] tracking-[0.18em] text-fg-muted">{t.footerPlatform}</p>
          <nav className="mt-4 flex flex-col gap-3 text-sm" aria-label={t.footerPlatform}>
            <a href="/#platform" className="text-fg-muted transition-colors hover:text-fg">
              {t.navPlatform}
            </a>
            <a href="/#products" className="text-fg-muted transition-colors hover:text-fg">
              {t.navProducts}
            </a>
            <a href="/#solutions" className="text-fg-muted transition-colors hover:text-fg">
              {t.navSolutions}
            </a>
            <a href="/#security" className="text-fg-muted transition-colors hover:text-fg">
              {t.navSecurity}
            </a>
          </nav>
        </div>

        <div>
          <p className="public-mono text-[11px] tracking-[0.18em] text-fg-muted">{t.footerProducts}</p>
          <nav className="mt-4 flex flex-col gap-3 text-sm" aria-label={t.footerProducts}>
            {productLinks.map((item) => (
              <a key={item.href} href={item.href} className="text-fg-muted transition-colors hover:text-fg">
                {item.label}
              </a>
            ))}
            <a href="/#contact" className="text-fg-muted transition-colors hover:text-fg">
              {t.footerContact}
            </a>
          </nav>
        </div>

        <div>
          <p className="public-mono text-[11px] tracking-[0.18em] text-fg-muted">{t.footerLegal}</p>
          <div className="mt-4" dir="rtl">
            <LegalNav className="flex-col items-start gap-y-3 text-fg-muted" />
          </div>
          <nav className="mt-3 flex flex-col gap-3 text-sm" aria-label={t.footerCompany}>
            <a href="/#pilot" className="text-fg-muted transition-colors hover:text-fg">
              {t.footerEarlyAccess}
            </a>
            <Link to="/register" className="text-fg-muted transition-colors hover:text-fg">
              {t.joinPilot}
            </Link>
          </nav>
        </div>
      </div>
      <p className="ltr-meta mx-auto mt-14 max-w-6xl text-xs tracking-[0.04em] text-fg-muted">{t.footerCopyright}</p>
    </footer>
  );
}

export function CtaLink({
  to,
  children,
  variant = "primary",
  className,
}: {
  to: "/login" | "/register" | "/app" | "/onboarding" | "/platform";
  children: string;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-[var(--radius-control)] px-5 text-sm font-medium transition-[background-color,border-color] duration-200",
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
