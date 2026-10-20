import type { ReactNode } from "react";
import { useDocumentMeta } from "../../lib/document-meta";
import { afterAuthPath, guestEntryPath } from "../../lib/auth-routes";
import { useSession } from "../../lib/session";
import { CtaLink, PublicFooter, PublicHeader } from "./PublicChrome";
import { PublicLocaleProvider, usePublicCopy, usePublicLocale } from "./PublicLocaleProvider";
import {
  ComplementStrip,
  FrictionStrip,
  HeroStage,
  OpsFlowStrip,
  ProductGrid,
  ProductShot,
  ProofList,
  SecurityArch,
  SolutionGroups,
} from "./PublicSurfaces";

/** Served from /public/landing-v2 — optimized copies of Docs/landing-v2-snapshots. */
const shots = {
  quotePricing: "/landing-v2/02-quote-review-desktop.jpg",
  siteFile: "/landing-v2/03-site-file-desktop.jpg",
} as const;

function HeroEntry({ size = "default" }: { size?: "default" | "strong" }) {
  const { user, session, error } = useSession();
  const t = usePublicCopy();
  const className = size === "strong" ? "public-cta-strong" : undefined;
  if (!user) {
    return (
      <CtaLink to={guestEntryPath()} className={className}>
        {t.enterWorkspace}
      </CtaLink>
    );
  }
  if (error && !session) {
    return (
      <CtaLink to="/login" className={className}>
        {t.sessionUnavailable}
      </CtaLink>
    );
  }
  const hasWorkspace = Boolean(session?.has_workspace);
  return (
    <CtaLink to={afterAuthPath(hasWorkspace)} className={className}>
      {hasWorkspace ? t.enterWorkspace : t.continueOnboarding}
    </CtaLink>
  );
}

function Manifest({ lines, mutedFrom = 1 }: { lines: string[]; mutedFrom?: number }) {
  return (
    <h2 className="public-manifest">
      {lines.map((line, i) => (
        <span key={line} className={i >= mutedFrom ? "public-manifest-line is-muted" : "public-manifest-line"}>
          {line}
        </span>
      ))}
    </h2>
  );
}

function Scene({
  id,
  index,
  className,
  density = "default",
  children,
}: {
  id: string;
  index?: string;
  className?: string;
  density?: "default" | "tight" | "air";
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`public-scene public-scene-${density} scroll-mt-24 px-4 ${className ?? ""}`}
    >
      <div className="public-container mx-auto max-w-6xl">
        {index ? <p className="public-mono mb-5 text-[11px] tracking-[0.2em] text-fg-muted sm:mb-6">{index}</p> : null}
        {children}
      </div>
    </section>
  );
}

function SecondaryExplore({ href = "/#products", className }: { href?: string; className?: string }) {
  const t = usePublicCopy();
  return (
    <a href={href} className={className ?? "public-cta-secondary"}>
      {t.seeProduct}
    </a>
  );
}

function PublicHomeBody() {
  const t = usePublicCopy();
  const { dir, locale } = usePublicLocale();

  useDocumentMeta({
    title: t.pageTitle,
    description: t.pageDescription,
    robots: "index, follow",
  });

  return (
    <div className="public-root public-shell min-h-dvh text-fg" dir={dir} lang={locale}>
      <a href="#main" className="skip-link">
        {t.skipToContent}
      </a>
      <PublicHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        <section
          id="platform"
          className="public-hero public-hero-band relative flex min-h-[calc(100dvh-3.5rem)] scroll-mt-24 flex-col justify-center px-4 py-12 sm:py-14 lg:py-16"
        >
          <div className="public-container mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(22rem,1.1fr)] lg:gap-12 xl:gap-14">
            <div className="flex min-w-0 max-w-xl flex-col gap-5 lg:gap-6">
              <p className="public-mono text-[11px] tracking-[0.2em] text-fg-muted">{t.heroEyebrow}</p>
              <h1 className="public-hero-title">
                <span className="public-hero-line">{t.heroLine1}</span>
                <span className="public-hero-line is-muted">{t.heroLine2}</span>
              </h1>
              <p className="max-w-lg text-[15px] leading-7 text-fg-muted sm:text-base sm:leading-8">{t.heroSupport}</p>
              <div className="flex flex-col gap-3 pt-1 md:flex-row md:flex-wrap md:items-center">
                <HeroEntry />
                <SecondaryExplore className="public-cta-secondary public-cta-on-hero" />
              </div>
            </div>
            <HeroStage />
          </div>
        </section>

        <div className="public-rule" aria-hidden />

        <Scene id="products" index={t.productsIndex} className="public-scene-product">
          <Manifest lines={[t.productsTitle]} mutedFrom={99} />
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-fg-muted sm:text-base">{t.productsSub}</p>
          <div className="mt-8 lg:mt-10">
            <ProductGrid />
          </div>
        </Scene>

        <div className="public-rule" aria-hidden />

        <Scene id="quotes" index={t.quoteIndex} className="public-scene-product">
          <div className="public-split lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)] lg:items-start lg:gap-12 xl:gap-14">
            <div className="public-split-copy">
              <Manifest lines={[t.quoteA, t.quoteB]} />
              <p className="mt-4 max-w-sm text-[15px] leading-7 text-fg-muted sm:text-base sm:leading-8">{t.quoteSub}</p>
              <ProofList items={t.quoteProof} />
              <div className="mt-8">
                <a href="/#flow" className="public-cta-secondary">
                  {t.quoteCta}
                </a>
              </div>
            </div>
            <div className="public-split-object mt-8 lg:mt-0">
              <ProductShot
                src={shots.quotePricing}
                alt={t.quoteShotAlt}
                label={t.quoteShotLabel}
                variant="desktop"
              />
            </div>
          </div>
        </Scene>

        <div className="public-rule" aria-hidden />

        <Scene id="flow" index={t.flowIndex} density="tight" className="public-scene-surface">
          <Manifest lines={[t.flowTitle]} mutedFrom={99} />
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-fg-muted sm:text-base">{t.flowSub}</p>
          <div className="mt-8 lg:mt-10">
            <OpsFlowStrip />
          </div>
          <div className="mt-10 lg:mt-12">
            <ComplementStrip />
          </div>
        </Scene>

        <div className="public-rule" aria-hidden />

        <Scene id="site-file" index={t.siteIndex} className="public-scene-surface">
          <div className="public-split lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)] lg:items-start lg:gap-12">
            <div className="public-split-copy">
              <Manifest lines={[t.siteFileA, t.siteFileB]} />
              <p className="mt-4 max-w-sm text-[15px] leading-7 text-fg-muted sm:text-base sm:leading-8">
                {t.siteFileSub}
              </p>
              <ProofList items={t.siteProof} />
            </div>
            <div className="public-split-object mt-8 lg:mt-0">
              <ProductShot src={shots.siteFile} alt={t.siteShotAlt} label={t.siteShotLabel} variant="desktop" />
            </div>
          </div>
        </Scene>

        <div className="public-rule" aria-hidden />

        <Scene id="solutions" index={t.solutionsIndex} className="public-scene-control">
          <Manifest lines={[t.solutionsTitle]} mutedFrom={99} />
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-fg-muted sm:text-base">{t.solutionsSub}</p>
          <div className="mt-8 lg:mt-10">
            <SolutionGroups />
          </div>
        </Scene>

        <div className="public-rule" aria-hidden />

        <Scene id="friction" index={t.frictionIndex} density="tight" className="public-scene-chaos">
          <Manifest lines={[t.frictionA, t.frictionB]} />
          <div className="mt-8 lg:mt-10">
            <FrictionStrip />
          </div>
        </Scene>

        <div className="public-rule" aria-hidden />

        <Scene id="security" index={t.securityIndex} density="tight">
          <div className="max-w-3xl">
            <Manifest lines={[t.securityTitleA, t.securityTitleB]} />
            <p className="mt-4 text-[15px] leading-7 text-fg-muted sm:text-base sm:leading-8">{t.securitySub}</p>
          </div>
          <div className="mt-8 lg:mt-10">
            <SecurityArch />
          </div>
        </Scene>

        <div className="public-rule" aria-hidden />

        <Scene id="contact" index={t.contactIndex} density="tight" className="public-scene-surface">
          <div className="max-w-xl">
            <Manifest lines={[t.contactTitle]} mutedFrom={99} />
            <p className="mt-4 text-[15px] leading-7 text-fg-muted sm:text-base">{t.contactBody}</p>
            <p className="mt-5 text-sm text-fg-muted">
              <span>{t.contactEmailLabel}: </span>
              <a
                href={`mailto:${t.contactEmail}`}
                className="ltr-meta text-action hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                dir="ltr"
              >
                {t.contactEmail}
              </a>
            </p>
          </div>
        </Scene>

        <div className="public-rule" aria-hidden />

        <Scene id="pilot" className="public-scene-pilot" density="air">
          <div className="public-pilot-panel">
            <h2 className="max-w-3xl text-[2rem] font-semibold leading-[1.08] tracking-[-0.035em] text-fg sm:text-5xl lg:text-[3.1rem]">
              {t.pilotTitle}
            </h2>
            <p className="mt-5 max-w-xl text-[15px] leading-7 text-fg-muted sm:mt-6 sm:text-base">{t.pilotBody}</p>
            <div className="mt-9 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:items-center">
              <HeroEntry size="strong" />
              <SecondaryExplore />
            </div>
          </div>
        </Scene>
      </main>
      <PublicFooter />
    </div>
  );
}

export function PublicHome() {
  return (
    <PublicLocaleProvider>
      <PublicHomeBody />
    </PublicLocaleProvider>
  );
}
