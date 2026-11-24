import { ChevronDown, Menu, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useRouterState } from "@tanstack/react-router";
import { ensureGaBootstrap, trackMarketingEvent } from "../../../../lib/marketing-analytics";
import { useLandingReveal } from "../useLandingReveal";
import { SupportPanel } from "./SupportPanel";
import {
  FOOTER_LEGAL_LINKS,
  HEADER_COMPANY_LINKS,
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
  const [mega, setMega] = useState<"platform" | "company" | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const megaId = useId();
  const menuDialogId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLHeaderElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useLandingReveal(".mkt-reveal", pathname);

  useEffect(() => {
    ensureGaBootstrap();
  }, []);

  useEffect(() => {
    trackMarketingEvent("page_view", { path: pathname });
    setMega(null);
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
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      menuBtnRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!mega) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMega(null);
    };
    const onPointer = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setMega(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [mega]);

  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

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
      <header className={`mkt-nav${scrolled ? " is-scrolled" : " is-top"}`} ref={navRef}>
        <div className="mkt-nav-inner">
          <Link to={MARKETING_ROUTES.home} className="mkt-nav-brand">
            SITE SECURE
          </Link>
          <nav className="mkt-nav-links" aria-label="ניווט ראשי">
            <div className="mkt-mega-wrap">
              <button
                type="button"
                className={`mkt-mega-trigger${mega === "platform" ? " is-open" : ""}`}
                aria-expanded={mega === "platform"}
                aria-controls={`${megaId}-platform`}
                onClick={() => setMega((v) => (v === "platform" ? null : "platform"))}
              >
                פלטפורמה
                <ChevronDown className="size-4" aria-hidden />
              </button>
              {mega === "platform" ? (
                <div id={`${megaId}-platform`} className="mkt-mega" role="region" aria-label="תפריט פלטפורמה">
                  <div className="mkt-mega-grid">
                    {HEADER_PLATFORM_LINKS.map((item) => (
                      <Link
                        key={item.href}
                        to={item.href}
                        className="mkt-mega-item"
                        aria-current={isCurrent(item.href) ? "page" : undefined}
                        onClick={() => setMega(null)}
                      >
                        <strong>{item.label}</strong>
                        <span>{megaBlurb(item.href)}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mkt-mega-wrap">
              <button
                type="button"
                className={`mkt-mega-trigger${mega === "company" ? " is-open" : ""}`}
                aria-expanded={mega === "company"}
                aria-controls={`${megaId}-company`}
                onClick={() => setMega((v) => (v === "company" ? null : "company"))}
              >
                חברה
                <ChevronDown className="size-4" aria-hidden />
              </button>
              {mega === "company" ? (
                <div id={`${megaId}-company`} className="mkt-mega" role="region" aria-label="תפריט חברה">
                  <div className="mkt-mega-grid">
                    {HEADER_COMPANY_LINKS.map((item) => (
                      <Link
                        key={item.href}
                        to={item.href}
                        className="mkt-mega-item"
                        aria-current={isCurrent(item.href) ? "page" : undefined}
                        onClick={() => setMega(null)}
                      >
                        <strong>{item.label}</strong>
                        <span>{megaBlurb(item.href)}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <Link to={MARKETING_ROUTES.login}>כניסה</Link>
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
              <div className="flex items-center justify-between">
                <p className="mkt-nav-brand">SITE SECURE</p>
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

function megaBlurb(href: string): string {
  switch (href) {
    case MARKETING_ROUTES.product:
      return "סקירת מודולים וסיור מודרך";
    case MARKETING_ROUTES.solutions:
      return "לפי סוג עסק וצוות";
    case MARKETING_ROUTES.pricing:
      return "מסלולים מהקטלוג בפועל";
    case MARKETING_ROUTES.cctvTool:
      return "חישוב אחסון חינמי";
    case MARKETING_ROUTES.about:
      return "Aegis Spectra ו־SITE SECURE";
    case MARKETING_ROUTES.contact:
      return "מכירות, תמיכה והדגמה";
    case MARKETING_ROUTES.knowledge:
      return "מאמרים וסינון לפי נושא";
    default:
      return "";
  }
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
