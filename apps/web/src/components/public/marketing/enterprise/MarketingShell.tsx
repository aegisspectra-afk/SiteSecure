import { Menu, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useRouterState } from "@tanstack/react-router";
import { ensureGaBootstrap, trackMarketingEvent } from "../../../../lib/marketing-analytics";
import { useLandingReveal } from "../useLandingReveal";
import { BrandBdi } from "./BrandBdi";
import { SupportPanel } from "./SupportPanel";
import { KNOWLEDGE_ARTICLES } from "./knowledge-articles";
import {
  FOOTER_COMPANY_LINKS,
  FOOTER_LEGAL_LINKS,
  FOOTER_PLATFORM_LINKS,
  HEADER_PRIMARY_LINKS,
  MARKETING_ROUTES,
} from "./marketing-routes";

const MIN_KNOWLEDGE_ARTICLES = 3;
const footerCompanyLinks = FOOTER_COMPANY_LINKS.filter(
  (l) =>
    l.href !== MARKETING_ROUTES.knowledge || KNOWLEDGE_ARTICLES.length >= MIN_KNOWLEDGE_ARTICLES,
);

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
  const menuDialogId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useLandingReveal(".mkt-reveal", pathname);

  useEffect(() => {
    ensureGaBootstrap();
  }, []);

  useEffect(() => {
    trackMarketingEvent("page_view", { path: pathname });
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevPadding = document.body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPadding;
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      menuBtnRef.current?.focus();
    };
  }, [open]);

  const isCurrent = (href: string) =>
    href === MARKETING_ROUTES.home
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div
      ref={rootRef}
      className={`mkt-root${darkNav ? " mkt-shell-dark-nav" : ""}`}
      dir="rtl"
      lang="he"
    >
      <a href="#main" className="skip-link">
        דלגו לתוכן
      </a>
      <header className={`mkt-nav${scrolled ? " is-scrolled" : " is-top"}`}>
        <div className="mkt-nav-inner">
          <Link to={MARKETING_ROUTES.home} className="mkt-nav-brand">
            <BrandBdi name="SITE SECURE" />
          </Link>
          <nav className="mkt-nav-links" aria-label="ניווט ראשי">
            {HEADER_PRIMARY_LINKS.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="mkt-nav-link"
                aria-current={isCurrent(item.href) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
            <Link
              to={MARKETING_ROUTES.login}
              className="mkt-nav-link"
              aria-current={isCurrent(MARKETING_ROUTES.login) ? "page" : undefined}
            >
              כניסה
            </Link>
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
          <button
            type="button"
            ref={menuBtnRef}
            className="mkt-nav-menu-btn"
            aria-label="תפריט"
            aria-expanded={open}
            aria-controls={menuDialogId}
            onClick={() => setOpen(true)}
          >
            <Menu className="size-5" aria-hidden />
          </button>
        </div>
      </header>

      {open && rootRef.current
        ? createPortal(
            <div
              id={menuDialogId}
              className="mkt-fullscreen"
              role="dialog"
              aria-modal="true"
              aria-label="תפריט"
            >
              <div className="mkt-fullscreen-top">
                <p className="mkt-nav-brand">
                  <BrandBdi name="SITE SECURE" />
                </p>
                <button
                  type="button"
                  ref={closeBtnRef}
                  className="mkt-nav-menu-btn"
                  aria-label="סגור"
                  onClick={() => setOpen(false)}
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              <nav aria-label="תפריט מלא" className="mkt-fullscreen-nav">
                {HEADER_PRIMARY_LINKS.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className="mkt-fullscreen-link"
                    aria-current={isCurrent(item.href) ? "page" : undefined}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  to={MARKETING_ROUTES.login}
                  className="mkt-fullscreen-link"
                  aria-current={isCurrent(MARKETING_ROUTES.login) ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  כניסה
                </Link>
              </nav>
              <div className="mkt-fullscreen-cta">
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
              </div>
            </div>,
            rootRef.current,
          )
        : null}

      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>

      <MarketingFooter />
      <SupportPanel />
    </div>
  );
}

function MarketingFooter() {
  return (
    <footer className="mkt-footer">
      <div className="mkt-container mkt-footer-grid">
        <div>
          <p className="mkt-nav-brand">
            <BrandBdi name="SITE SECURE" />
          </p>
          <p className="mt-3 text-sm leading-7">
            <BrandBdi name="Aegis Spectra" />
          </p>
          <p className="mt-2 text-sm leading-7">מהסיור באתר ועד תעודת המסירה — בעברית.</p>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-semibold text-[var(--mkt-on-dark)]">פלטפורמה</p>
          {FOOTER_PLATFORM_LINKS.map((l) => (
            <Link key={l.href} to={l.href}>
              {l.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-semibold text-[var(--mkt-on-dark)]">חברה</p>
          {footerCompanyLinks.map((l) => (
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
      <p className="mkt-container mt-10 text-xs">
        © {new Date().getFullYear()} <BrandBdi name="Aegis Spectra" />
      </p>
    </footer>
  );
}
