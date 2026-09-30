import type { ReactNode } from "react";
import { useDocumentMeta } from "../../lib/document-meta";
import { afterAuthPath } from "../../lib/auth-routes";
import { useSession } from "../../lib/session";
import { CtaLink, PublicFooter, PublicHeader } from "./PublicChrome";
import { PublicLocaleProvider, usePublicCopy, usePublicLocale } from "./PublicLocaleProvider";
import {
  FrictionStrip,
  OpsFlowStrip,
  ProductShot,
  ProofList,
  SecurityArch,
} from "./PublicSurfaces";

/** Served from /public/landing-v2 — optimized copies of Docs/landing-v2-snapshots. */
const shots = {
  quoteBuilder: "/landing-v2/01-quote-builder-desktop.jpg",
  quotePricing: "/landing-v2/02-quote-review-desktop.jpg",
  siteFile: "/landing-v2/03-site-file-desktop.jpg",
  assets: "/landing-v2/03b-site-equipment-desktop.jpg",
  today: "/landing-v2/05-today-mobile.jpg",
  fieldJob: "/landing-v2/06-fieldjob-mobile.jpg",
} as const;

function HeroEntry({ size = "default" }: { size?: "default" | "strong" }) {
  const { user, session, error } = useSession();
  const t = usePublicCopy();
  const className = size === "strong" ? "public-cta-strong" : undefined;
  if (!user) {
    return (
      <CtaLink to="/register" className={className}>
        {t.joinPilot}
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

function SecondaryExplore({ href = "/#quotes", className }: { href?: string; className?: string }) {
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
        <section className="public-hero relative flex min-h-[calc(100dvh-3.5rem)] flex-col justify-center px-4 py-12 sm:py-14 lg:py-16">
          <div className="public-container mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(22rem,1.1fr)] lg:gap-12 xl:gap-14">
            <div className="flex max-w-xl flex-col gap-5 lg:gap-6">
              <p className="public-mono text-[11px] tracking-[0.2em] text-fg-muted">{t.heroEyebrow}</p>
              <h1 className="public-hero-title">
                <span className="public-hero-line text-fg">{t.heroLine1}</span>
                <span className="public-hero-line is-muted">{t.heroLine2}</span>
              </h1>
              <div className="flex max-w-lg flex-col gap-2.5">
                <p className="text-lg leading-7 text-fg sm:text-[1.2rem] sm:leading-8">{t.heroSupport}</p>
                <p className="text-[15px] leading-7 text-fg-muted">{t.heroLead}</p>
              </div>
              <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
                <HeroEntry />
                <SecondaryExplore />
              </div>
            </div>
            <ProductShot
              src={shots.quoteBuilder}
              alt={t.heroShotAlt}
              label={t.heroShotLabel}
              variant="hero"
              priority
            />
          </div>
        </section>

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

        <Scene id="assets" index={t.assetsIndex} density="tight" className="public-scene-control">
          <div className="public-split lg:grid-cols-[minmax(0,1.1fr)_minmax(16rem,22rem)] lg:items-start lg:gap-12">
            <div className="public-split-object order-2 mt-8 lg:order-1 lg:mt-0">
              <ProductShot src={shots.assets} alt={t.assetsShotAlt} label={t.assetsShotLabel} variant="desktop" />
            </div>
            <div className="public-split-copy order-1 lg:order-2">
              <Manifest lines={[t.assetsA, t.assetsB]} />
              <p className="mt-4 max-w-sm text-[15px] leading-7 text-fg-muted sm:text-base sm:leading-8">
                {t.assetsSub}
              </p>
              <ProofList items={t.assetsProof} />
            </div>
          </div>
        </Scene>

        <div className="public-rule" aria-hidden />

        <Scene id="field" index={t.fieldIndex} className="public-scene-field">
          <div className="public-split lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] lg:items-center lg:gap-14">
            <div className="public-split-copy">
              <Manifest lines={[t.fieldA, t.fieldB]} />
              <p className="mt-4 max-w-md text-[15px] leading-7 text-fg-muted sm:text-base sm:leading-8">{t.fieldSub}</p>
              <ProofList items={t.fieldProof} />
              <p className="public-mono mt-6 text-[11px] tracking-[0.18em] text-fg-muted">{t.fieldOfficeLabel}</p>
            </div>
            <div className="public-split-object mt-8 lg:mt-0">
              <div className="public-field-pair">
                <ProductShot
                  src={shots.today}
                  alt={t.fieldTodayAlt}
                  label={t.fieldShotLabel}
                  variant="mobile"
                />
                <ProductShot
                  src={shots.fieldJob}
                  alt={t.fieldJobAlt}
                  label={t.fieldJobLabel}
                  variant="mobile"
                  className="public-field-secondary"
                />
              </div>
            </div>
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
