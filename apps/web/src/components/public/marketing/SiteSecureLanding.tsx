import { Button, Input, Textarea } from "@site-secure/ui";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { billingPublic, catalogPlansOrdered, formatIls } from "@site-secure/authz";
import { ssMarketing } from "../../../i18n/site-secure-marketing-he";
import { submitBetaSignup } from "../../../lib/public-marketing-api";
import { siteSecureOrgJsonLd, usePublicSeo } from "../../../lib/public-seo";
import { ProductShot } from "../PublicSurfaces";
import { PublicHeader } from "../PublicChrome";

const origin = typeof window !== "undefined" ? window.location.origin : "https://site-secure.com";

function Section({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`public-scene scroll-mt-24 px-4 py-12 sm:py-14 ${className ?? ""}`}>
      <div className="public-container mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

export function SiteSecureLanding() {
  useEffect(() => {
    document.getElementById("ss-marketing-paint")?.remove();
  }, []);

  const [beta, setBeta] = useState({ full_name: "", phone: "", business_name: "", technician_count: "", trade_focus: "" });
  const [betaDone, setBetaDone] = useState(false);
  const [betaErr, setBetaErr] = useState<string | null>(null);
  const [betaBusy, setBetaBusy] = useState(false);
  const teaserPlans = useMemo(() => catalogPlansOrdered().slice(0, 3), []);
  const billing = billingPublic();

  usePublicSeo({
    title: ssMarketing.seoTitle,
    description: ssMarketing.seoDescription,
    canonical: `${origin}/`,
    jsonLd: siteSecureOrgJsonLd(origin),
  });

  return (
    <div className="public-root public-shell min-h-dvh text-fg" dir="rtl" lang="he">
      <a href="#main" className="skip-link">
        דלגו לתוכן
      </a>
      <PublicHeader marketingNav />
      <main id="main" tabIndex={-1} className="outline-none">
        <section
          id="hero"
          className="public-hero public-hero-band relative flex min-h-[calc(100dvh-3.5rem)] scroll-mt-24 flex-col justify-center px-4 py-12"
        >
          <div className="public-container mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <div className="flex flex-col gap-5">
              <p className="public-mono text-[11px] tracking-[0.2em] text-fg-muted">SITE SECURE</p>
              <h1 className="public-hero-title">
                <span className="public-hero-line">{ssMarketing.heroLine1}</span>
                <span className="public-hero-line is-muted">{ssMarketing.heroLine2}</span>
              </h1>
              <p className="max-w-lg text-base leading-8 text-fg-muted">{ssMarketing.heroSub}</p>
              <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:flex-wrap">
                <Link
                  to="/register"
                  className="public-cta-strong inline-flex min-h-12 items-center justify-center rounded-[var(--radius-control)] bg-action px-5 text-sm font-medium text-action-fg"
                >
                  {ssMarketing.heroPrimary}
                </Link>
                <a href="#how" className="public-cta-secondary inline-flex min-h-12 items-center justify-center px-5 text-sm font-medium">
                  {ssMarketing.heroSecondary}
                </a>
              </div>
            </div>
            <ProductShot
              src="/landing-v2/02-quote-review-desktop.jpg"
              alt="צילום מסך של SITE SECURE — בונה הצעות מחיר"
              label="SITE SECURE · הצעות מחיר"
              variant="desktop"
              priority
            />
          </div>
        </section>

        <Section id="problem">
          <h2 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">{ssMarketing.problemTitle}</h2>
          <ul className="mt-6 flex flex-col gap-3 text-base leading-8 text-fg-muted">
            {ssMarketing.problemLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Section>

        <div className="public-rule" aria-hidden />

        <Section id="how">
          <h2 className="text-2xl font-semibold text-fg sm:text-3xl">{ssMarketing.howTitle}</h2>
          <ol className="mt-10 grid gap-8 lg:grid-cols-2">
            {ssMarketing.howSteps.map((step, i) => (
              <li key={step.title} className="flex flex-col gap-4">
                <p className="public-mono text-xs text-fg-muted">{`0${i + 1}`}</p>
                <h3 className="text-lg font-semibold text-fg">{step.title}</h3>
                <p className="text-sm leading-7 text-fg-muted">{step.body}</p>
                <ProductShot src={step.shot} alt={step.shotAlt} label={step.title} variant="desktop" />
              </li>
            ))}
          </ol>
        </Section>

        <Section id="features" className="public-scene-surface">
          <h2 className="text-2xl font-semibold text-fg">{ssMarketing.featuresTitle}</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {ssMarketing.features.map((f) => (
              <li key={f} className="rounded-[var(--radius-control)] border border-border bg-public-elevated px-4 py-3 text-sm leading-7">
                {f}
              </li>
            ))}
          </ul>
        </Section>

        <Section id="audience">
          <h2 className="text-2xl font-semibold text-fg">{ssMarketing.audienceTitle}</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {ssMarketing.audience.map((row) => (
              <article key={row.title} className="ops-card p-5">
                <h3 className="font-semibold text-fg">{row.title}</h3>
                <p className="mt-2 text-sm leading-7 text-fg-muted">{row.body}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section id="compare">
          <h2 className="text-2xl font-semibold text-fg">{ssMarketing.compareTitle}</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-fg-muted">
                  <th className="py-3 pe-4 text-start font-medium">נושא</th>
                  <th className="py-3 px-4 text-start font-medium">אקסל + וואטסאפ</th>
                  <th className="py-3 ps-4 text-start font-medium">SITE SECURE</th>
                </tr>
              </thead>
              <tbody>
                {ssMarketing.compareRows.map((row) => (
                  <tr key={row.topic} className="border-b border-border/70">
                    <td className="py-3 pe-4 font-medium text-fg">{row.topic}</td>
                    <td className="py-3 px-4 text-fg-muted">{row.legacy}</td>
                    <td className="py-3 ps-4 text-fg">{row.ss}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="pricing-teaser" className="public-scene-surface">
          <h2 className="text-2xl font-semibold text-fg">{ssMarketing.pricingTeaserTitle}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-fg-muted">{ssMarketing.pricingTeaserBody}</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {teaserPlans.map((plan) => {
              const monthly = plan.commercial?.monthly_ils_before_vat ?? 0;
              return (
                <div key={plan.key} className="ops-card flex flex-col gap-2 p-5">
                  <p className="font-semibold text-fg">{plan.label_he}</p>
                  <p className="text-2xl font-semibold text-fg">{formatIls(monthly)}</p>
                  <p className="text-xs text-fg-muted">לחודש · {billing.vat_note_he}</p>
                </div>
              );
            })}
          </div>
          <Link to="/pricing" className="mt-8 inline-flex min-h-12 items-center text-sm font-medium text-action hover:underline">
            {ssMarketing.pricingTeaserCta} ←
          </Link>
        </Section>

        <Section id="faq">
          <h2 className="text-2xl font-semibold text-fg">{ssMarketing.faqTitle}</h2>
          <div className="mt-6 flex flex-col gap-4">
            {ssMarketing.faq.map((item) => (
              <details key={item.q} className="ops-card group px-4 py-3">
                <summary className="cursor-pointer text-sm font-medium text-fg">{item.q}</summary>
                <p className="mt-2 text-sm leading-7 text-fg-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </Section>

        <Section id="beta" className="public-scene-pilot">
          <h2 className="text-2xl font-semibold text-fg sm:text-3xl">{ssMarketing.betaTitle}</h2>
          <p className="mt-2 text-sm text-fg-muted">{ssMarketing.betaHint}</p>
          {betaDone ? (
            <p className="mt-6 text-base font-medium text-fg" role="status">
              {ssMarketing.betaSuccess}
            </p>
          ) : (
            <form
              className="mt-8 grid max-w-xl gap-4"
              onSubmit={(ev) => {
                ev.preventDefault();
                setBetaBusy(true);
                setBetaErr(null);
                void submitBetaSignup({ ...beta, source: "landing" })
                  .then(() => setBetaDone(true))
                  .catch((e: Error) => setBetaErr(e.message))
                  .finally(() => setBetaBusy(false));
              }}
            >
              <Input
                id="beta-name"
                label={ssMarketing.betaFields.fullName}
                value={beta.full_name}
                required
                onChange={(ev) => setBeta({ ...beta, full_name: ev.target.value })}
              />
              <Input
                id="beta-phone"
                label={ssMarketing.betaFields.phone}
                value={beta.phone}
                required
                dir="ltr"
                onChange={(ev) => setBeta({ ...beta, phone: ev.target.value })}
              />
              <Input
                id="beta-business"
                label={ssMarketing.betaFields.businessName}
                value={beta.business_name}
                required
                onChange={(ev) => setBeta({ ...beta, business_name: ev.target.value })}
              />
              <Input
                id="beta-tech-count"
                label={ssMarketing.betaFields.technicianCount}
                value={beta.technician_count}
                required
                onChange={(ev) => setBeta({ ...beta, technician_count: ev.target.value })}
              />
              <Textarea
                id="beta-trade"
                label={ssMarketing.betaFields.tradeFocus}
                value={beta.trade_focus}
                required
                rows={3}
                onChange={(ev) => setBeta({ ...beta, trade_focus: ev.target.value })}
              />
              {betaErr ? <p className="text-sm text-destructive">{betaErr}</p> : null}
              <Button type="submit" disabled={betaBusy} className="min-h-12 w-full sm:w-auto">
                {ssMarketing.heroPrimary}
              </Button>
            </form>
          )}
        </Section>
      </main>
      <MarketingFooter />
    </div>
  );
}

function MarketingFooter() {
  return (
    <footer className="border-t border-border px-4 py-14" dir="rtl">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-fg">SITE SECURE</p>
          <p className="mt-2 text-sm text-fg-muted">{ssMarketing.footerCompanyLine}</p>
          <p className="text-sm text-fg-muted">{ssMarketing.footerAddress}</p>
          <p className="mt-4">
            <a href={ssMarketing.footerWhatsappHref} className="text-sm text-action hover:underline" rel="noopener noreferrer">
              {ssMarketing.footerWhatsapp}
            </a>
          </p>
        </div>
        <nav className="flex flex-col gap-2 text-sm text-fg-muted" aria-label="משפטי">
          <Link to="/legal/$slug" params={{ slug: "terms" }}>
            תנאי שימוש
          </Link>
          <Link to="/legal/$slug" params={{ slug: "privacy" }}>
            מדיניות פרטיות
          </Link>
          <Link to="/legal/$slug" params={{ slug: "cancellation" }}>
            מדיניות ביטול
          </Link>
          <Link to="/legal/$slug" params={{ slug: "accessibility" }}>
            {ssMarketing.accessibility}
          </Link>
          <Link to="/legal/$slug" params={{ slug: "security" }}>
            אבטחת מידע
          </Link>
          <Link to="/pricing">מחירון</Link>
          <Link to="/tools/cctv-storage">מחשבון אחסון CCTV</Link>
        </nav>
      </div>
      <p className="mx-auto mt-10 max-w-6xl text-xs text-fg-muted">© {new Date().getFullYear()} Aegis Spectra</p>
    </footer>
  );
}