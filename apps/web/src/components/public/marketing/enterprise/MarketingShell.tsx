import { Menu, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useRouterState } from "@tanstack/react-router";
import { ensureGaBootstrap, trackMarketingEvent } from "../../../../lib/marketing-analytics";
import { useLandingReveal } from "../useLandingReveal";
import {
  FOOTER_LEGAL_LINKS,
  HEADER_COMPANY_LINKS,
  HEADER_FLAT_LINKS,
  HEADER_PLATFORM_LINKS,
  MARKETING_ROUTES,
} from "./marketing-routes";

export function MarketingShell({
  children,
  darkNav = true,
}: {
  children: ReactNode;
  darkNav?: boolean;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useLandingReveal(".mkt-reveal", pathname);

  useEffect(() => {
    ensureGaBootstrap();
  }, []);

  useEffect(() => {
    trackMarketingEvent("page_view", { path: pathname });
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const desktopLinks = (
    <>
      {HEADER_FLAT_LINKS.map((item) => (
        <Link
          key={item.href}
          to={item.href}
          aria-current={isCurrent(item.href) ? "page" : undefined}
          onClick={() => setOpen(false)}
        >
          {item.label}
        </Link>
      ))}
      <Link to={MARKETING_ROUTES.login} onClick={() => setOpen(false)}>
        כניסה
      </Link>
    </>
  );

  return (
    <div className={`mkt-root${darkNav ? " mkt-shell-dark-nav" : ""}`} dir="rtl" lang="he">
      <a href="#main" className="skip-link">
        דלגו לתוכן
      </a>
      <header className={`mkt-nav${scrolled ? " is-scrolled" : " is-top"}`}>
        <div className="mkt-nav-inner">
          <Link to={MARKETING_ROUTES.home} className="mkt-nav-brand">
            SITE SECURE
          </Link>
          <nav className="mkt-nav-links" aria-label="ניווט ראשי">
            {desktopLinks}
          </nav>
          <div className="mkt-nav-actions">
            <Link
              to={MARKETING_ROUTES.register}
              className="mkt-btn mkt-btn-primary"
              onClick={() => trackMarketingEvent("cta_click", { cta: "nav_get_started" })}
            >
              התחילו בחינם
            </Link>
          </div>
          <button type="button" className="mkt-nav-menu-btn" aria-label="תפריט" onClick={() => setOpen(true)}>
            <Menu className="size-5" aria-hidden />
          </button>
        </div>
      </header>

      {open
        ? createPortal(
            <div className="mkt-fullscreen" role="dialog" aria-modal="true" aria-label="תפריט">
              <div className="flex items-center justify-between">
                <p className="mkt-nav-brand">SITE SECURE</p>
                <button type="button" className="mkt-nav-menu-btn" aria-label="סגור" onClick={() => setOpen(false)}>
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              <nav aria-label="תפריט מלא" className="grid gap-6">
                <div className="grid gap-2">
                  <p className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--mkt-on-dark-muted)]">
                    פלטפורמה
                  </p>
                  {HEADER_PLATFORM_LINKS.map((item) => (
                    <Link key={item.href} to={item.href} onClick={() => setOpen(false)}>
                      {item.label}
                    </Link>
                  ))}
                </div>
                <div className="grid gap-2">
                  <p className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--mkt-on-dark-muted)]">
                    חברה
                  </p>
                  {HEADER_COMPANY_LINKS.map((item) => (
                    <Link key={item.href} to={item.href} onClick={() => setOpen(false)}>
                      {item.label}
                    </Link>
                  ))}
                </div>
                <div className="grid gap-2">
                  <p className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--mkt-on-dark-muted)]">
                    חשבון
                  </p>
                  <Link to={MARKETING_ROUTES.login} onClick={() => setOpen(false)}>
                    כניסה
                  </Link>
                  <Link to={MARKETING_ROUTES.register} onClick={() => setOpen(false)}>
                    הרשמה
                  </Link>
                </div>
              </nav>
              <Link
                to={MARKETING_ROUTES.register}
                className="mkt-btn mkt-btn-primary"
                onClick={() => {
                  setOpen(false);
                  trackMarketingEvent("cta_click", { cta: "nav_mobile_get_started" });
                }}
              >
                התחילו בחינם
              </Link>
            </div>,
            document.body,
          )
        : null}

      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>

      <MarketingFooter />
    </div>
  );
}

function MarketingFooter() {
  return (
    <footer className="mkt-footer">
      <div className="mkt-container mkt-footer-grid">
        <div>
          <p className="mkt-nav-brand">SITE SECURE</p>
          <p className="mt-3 text-sm leading-7">Aegis Spectra</p>
          <p className="mt-2 text-sm leading-7">כל העסק שלך. מערכת אחת. שליטה מלאה.</p>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-semibold text-[var(--mkt-on-dark)]">פלטפורמה</p>
          {HEADER_PLATFORM_LINKS.map((l) => (
            <Link key={l.href} to={l.href}>
              {l.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-semibold text-[var(--mkt-on-dark)]">חברה</p>
          {HEADER_COMPANY_LINKS.map((l) => (
            <Link key={l.href} to={l.href}>
              {l.label}
            </Link>
          ))}
          <Link to={MARKETING_ROUTES.register}>הרשמה</Link>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-semibold text-[var(--mkt-on-dark)]">משפטי</p>
          {FOOTER_LEGAL_LINKS.map((l) => (
            <Link key={l.slug} to="/legal/$slug" params={{ slug: l.slug }}>
              {l.label}
            </Link>
          ))}
        </div>
      </div>
      <p className="mkt-container mt-10 text-xs">© {new Date().getFullYear()} Aegis Spectra</p>
    </footer>
  );
}
