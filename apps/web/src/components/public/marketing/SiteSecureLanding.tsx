import { Button, Input } from "@site-secure/ui";
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ssMarketing } from "../../../i18n/site-secure-marketing-he";
import { submitBetaSignup } from "../../../lib/public-marketing-api";
import { siteSecureOrgJsonLd, usePublicSeo } from "../../../lib/public-seo";
import { PublicHeader } from "../PublicChrome";
import { LandingMobileCta } from "./LandingMobileCta";
import { LandingSpecStrip } from "./LandingSpecStrip";
import { LazyWhenVisible } from "./LazyWhenVisible";
import { useLandingReveal } from "./useLandingReveal";

const LandingCctvHeroCalc = lazy(() =>
  import("./LandingCctvHeroCalc").then((m) => ({ default: m.LandingCctvHeroCalc })),
);
const LandingBeforeAfter = lazy(() =>
  import("./LandingBeforeAfter").then((m) => ({ default: m.LandingBeforeAfter })),
);
const LandingHowScrolly = lazy(() =>
  import("./LandingHowScrolly").then((m) => ({ default: m.LandingHowScrolly })),
);
const LandingFeaturesBento = lazy(() =>
  import("./LandingFeaturesBento").then((m) => ({ default: m.LandingFeaturesBento })),
);
const LandingFounder = lazy(() =>
  import("./LandingFounder").then((m) => ({ default: m.LandingFounder })),
);

const origin = typeof window !== "undefined" ? window.location.origin : "https://site-secure.com";

function Section({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`public-scene landing-section landing-reveal scroll-mt-24 px-4 ${className ?? ""}`}>
      <div className="public-container mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

type TeaserPlan = {
  key: string;
  label_he: string;
  commercial?: {
    monthly_ils_before_vat?: number | null;
    custom_pricing?: boolean;
    highlights_he?: string[];
  };
};

/** Text shell so how/features copy is in the React tree while the lazy chunk loads. */
function HowShell() {
  return (
    <section id="how" className="public-scene landing-section scroll-mt-24 px-4">
      <div className="public-container mx-auto max-w-6xl">
        <h2 className="text-2xl font-semibold text-fg sm:text-3xl">{ssMarketing.howTitle}</h2>
        <ol className="mt-8 flex flex-col gap-6">
          {ssMarketing.howSteps.map((s, i) => (
            <li key={s.title}>
              <p className="public-mono text-xs text-fg-muted">{`0${i + 1}`}</p>
              <h3 className="text-lg font-semibold text-fg">{s.title}</h3>
              <p className="mt-2 text-base leading-7 text-fg-muted sm:text-[17px]">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function FeaturesShell() {
  return (
    <section id="features" className="public-scene public-scene-surface landing-section scroll-mt-24 px-4">
      <div className="public-container mx-auto max-w-6xl">
        <h2 className="text-2xl font-semibold text-fg sm:text-3xl">{ssMarketing.featuresTitle}</h2>
        <ul className="mt-8 flex flex-col gap-3 text-base leading-7 text-fg-muted sm:text-[17px]">
          {ssMarketing.features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function SiteSecureLanding() {
  const [beta, setBeta] = useState({ full_name: "", phone: "", technician_count: "" });
  const [betaDone, setBetaDone] = useState(false);
  const [betaErr, setBetaErr] = useState<string | null>(null);
  const [betaBusy, setBetaBusy] = useState(false);
  const [teaserPlans, setTeaserPlans] = useState<TeaserPlan[]>([]);
  const [billingVatNote, setBillingVatNote] = useState("כולל מע״מ לפי חוק");
  const [paintPending, setPaintPending] = useState(true);
  const [heroCalcReady, setHeroCalcReady] = useState(false);

  useEffect(() => {
    const paint = document.getElementById("ss-marketing-paint");
    let cancelled = false;
    let calcTimer = 0;
    const enableCalc = () => {
      if (!cancelled) setHeroCalcReady(true);
    };
    const hidePaintNode = () => {
      if (cancelled) return;
      if (paint?.isConnected && !paint.hidden) {
        paint.hidden = true;
        paint.replaceChildren();
      }
    };
    const revealHero = () => {
      if (cancelled) return;
      setPaintPending(false);
      enableCalc();
    };
    const onInteract = () => {
      hidePaintNode();
      revealHero();
    };
    // Remove the paint node after LCP typically locks, but keep React hero text at opacity 0
    // a bit longer so the large Heebo title cannot replace the paint image as LCP.
    const timer = window.setTimeout(() => {
      hidePaintNode();
      calcTimer = window.setTimeout(revealHero, 6000);
    }, 3200);
    window.addEventListener("pointerdown", onInteract, { once: true, passive: true });
    window.addEventListener("keydown", onInteract, { once: true });
    if (!paint) {
      revealHero();
    }
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearTimeout(calcTimer);
      window.removeEventListener("pointerdown", onInteract);
      window.removeEventListener("keydown", onInteract);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const idle = window.setTimeout(() => {
      void import("@site-secure/authz").then((authz) => {
        if (cancelled) return;
        setTeaserPlans(authz.catalogPlansOrdered());
        setBillingVatNote(authz.billingPublic().vat_note_he);
      });
    }, 4000);
    return () => {
      cancelled = true;
      window.clearTimeout(idle);
    };
  }, []);

  const formatIls = useMemo(
    () => (monthly: number) =>
      new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(monthly),
    [],
  );

  usePublicSeo({
    title: ssMarketing.seoTitle,
    description: ssMarketing.seoDescription,
    canonical: `${origin}/`,
    jsonLd: siteSecureOrgJsonLd(origin),
  });

  useLandingReveal();

  return (
    <div
      className={`public-root public-shell landing-shell-with-mobile-cta min-h-dvh text-fg${paintPending ? " is-paint-pending" : ""}`}
      dir="rtl"
      lang="he"
    >
      <a href="#main" className="skip-link">
        דלגו לתוכן
      </a>
      <PublicHeader marketingNav />
      <main id="main" tabIndex={-1} className="outline-none">
        <section
          id="hero"
          className={`public-hero landing-hero-v2 relative flex min-h-[calc(100dvh-3.5rem)] scroll-mt-24 flex-col justify-center px-4 py-12${paintPending ? " is-paint-pending" : ""}`}
        >
          <div className="public-container mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <div className="flex flex-col gap-5">
              <h1 className="public-hero-title">
                <span className="public-hero-line">{ssMarketing.heroLine1}</span>
                <span className="public-hero-line is-muted">{ssMarketing.heroLine2}</span>
              </h1>
              <p className="max-w-lg text-base leading-8 text-fg-muted sm:text-[17px]">{ssMarketing.heroSub}</p>
              <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:flex-wrap">
                <a
                  href="#beta"
                  className="public-cta-strong inline-flex min-h-12 items-center justify-center rounded-[var(--radius-control)] bg-action px-5 text-sm font-medium text-action-fg"
                >
                  {ssMarketing.heroPrimary}
                </a>
                <a href="#how" className="public-cta-secondary public-cta-on-hero inline-flex min-h-12 items-center justify-center px-5 text-sm font-medium">
                  {ssMarketing.heroSecondary}
                </a>
              </div>
            </div>
            {heroCalcReady ? (
              <Suspense fallback={<div className="landing-cctv-calc min-h-[18rem]" aria-hidden="true" />}>
                <LandingCctvHeroCalc />
              </Suspense>
            ) : (
              <div className="landing-cctv-calc min-h-[18rem]" aria-hidden="true" />
            )}
          </div>
        </section>

        {/* Spec numbers are large — mount after paint so they cannot steal LCP. */}
        {!paintPending ? <LandingSpecStrip /> : <div className="landing-spec-strip" style={{ minHeight: "8rem" }} aria-hidden />}

        <LazyWhenVisible minHeight="24rem">
          <Suspense
            fallback={
              <section id="problem" className="public-scene landing-section min-h-[24rem] px-4">
                <div className="public-container mx-auto max-w-6xl">
                  <h2 className="text-2xl font-semibold text-fg">{ssMarketing.problemTitle}</h2>
                  <ul className="mt-6 flex flex-col gap-3 text-base leading-8 text-fg-muted">
                    {ssMarketing.problemLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              </section>
            }
          >
            <LandingBeforeAfter />
          </Suspense>
        </LazyWhenVisible>

        <div className="public-rule" aria-hidden />

        <LazyWhenVisible minHeight="28rem">
          <Suspense fallback={<HowShell />}>
            <LandingHowScrolly />
          </Suspense>
        </LazyWhenVisible>

        <LazyWhenVisible minHeight="22rem">
          <Suspense fallback={<FeaturesShell />}>
            <LandingFeaturesBento />
          </Suspense>
        </LazyWhenVisible>

        <LazyWhenVisible minHeight="16rem">
          <Suspense fallback={null}>
            <LandingFounder />
          </Suspense>
        </LazyWhenVisible>

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

        <Section id="pricing-teaser" className="public-scene-surface">
          <h2 className="text-2xl font-semibold text-fg">{ssMarketing.pricingTeaserTitle}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-fg-muted">{ssMarketing.pricingTeaserBody}</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {teaserPlans.map((plan) => {
              const commercial = plan.commercial;
              const custom = Boolean(commercial?.custom_pricing) || commercial?.monthly_ils_before_vat == null;
              const monthly = commercial?.monthly_ils_before_vat ?? 0;
              const highlights = (commercial?.highlights_he ?? []).slice(0, 3);
              return (
                <div key={plan.key} className="ops-card flex flex-col gap-2 p-5">
                  {plan.key === "business" ? (
                    <span className="landing-plan-badge">מומלץ לחברות עם טכנאים</span>
                  ) : null}
                  <p className="font-semibold text-fg">{plan.label_he}</p>
                  <p className="text-2xl font-semibold text-fg">{custom ? "בהתאמה" : formatIls(monthly)}</p>
                  <p className="text-xs text-fg-muted">{custom ? "דברו איתנו" : `לחודש · ${billingVatNote}`}</p>
                  <ul className="mt-2 flex flex-col gap-1.5 text-sm text-fg">
                    {highlights.map((h) => (
                      <li key={h}>• {h}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <Link to="/pricing" className="mt-8 inline-flex min-h-12 items-center text-sm font-medium text-action hover:underline">
            {ssMarketing.pricingTeaserCta} ←
          </Link>
        </Section>

        <Section id="faq" className="landing-reveal is-in">
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

        <Section id="beta" className="public-scene-pilot landing-reveal is-in">
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
                id="beta-tech-count"
                label={ssMarketing.betaFields.technicianCount}
                value={beta.technician_count}
                required
                onChange={(ev) => setBeta({ ...beta, technician_count: ev.target.value })}
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
      <LandingMobileCta />
    </div>
  );
}

function MarketingFooter() {
  const company = ssMarketing.footerCompanyLine.trim();
  const address = ssMarketing.footerAddress.trim();
  const waHref = ssMarketing.footerWhatsappHref.trim();
  const waLabel = ssMarketing.footerWhatsapp.trim();

  return (
    <footer className="border-t border-border px-4 py-14" dir="rtl">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-fg">SITE SECURE</p>
          {company ? <p className="mt-2 text-sm text-fg-muted">{company}</p> : null}
          {address ? <p className="text-sm text-fg-muted">{address}</p> : null}
          {waHref ? (
            <p className="mt-4">
              <a href={waHref} className="text-sm text-action hover:underline" rel="noopener noreferrer">
                {waLabel || "וואטסאפ"}
              </a>
            </p>
          ) : null}
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
