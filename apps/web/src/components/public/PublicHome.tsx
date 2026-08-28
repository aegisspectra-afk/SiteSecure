import type { ReactNode } from "react";
import { pub } from "../../i18n/public-he";
import { useDocumentMeta } from "../../lib/document-meta";
import { afterAuthPath } from "../../lib/auth-routes";
import { useSession } from "../../lib/session";
import { CtaLink, PublicFooter, PublicHeader } from "./PublicChrome";
import {
  ChaosChain,
  FieldPhone,
  HeroConsole,
  IntelligencePanel,
  MetricsStrip,
  OpsChain,
  SecurityArch,
  SiteFileStage,
  TwinExplorer,
} from "./PublicSurfaces";

function HeroEntry({ size = "default" }: { size?: "default" | "strong" }) {
  const { user, session, error } = useSession();
  const className = size === "strong" ? "public-cta-strong" : undefined;
  if (!user) return <CtaLink to="/register" className={className}>{pub.joinPilot}</CtaLink>;
  if (error && !session) return <CtaLink to="/login" className={className}>{pub.sessionUnavailable}</CtaLink>;
  return (
    <CtaLink to={afterAuthPath(Boolean(session?.has_workspace))} className={className}>
      {session?.has_workspace ? pub.enterWorkspace : pub.continueOnboarding}
    </CtaLink>
  );
}

function Manifest({ lines, mutedFrom = 1 }: { lines: string[]; mutedFrom?: number }) {
  return (
    <h2 className="public-manifest ltr-meta">
      {lines.map((line, i) => (
        <span key={line} className={i >= mutedFrom ? "mt-2 block text-fg-muted" : "block text-fg"}>
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
  children,
}: {
  id: string;
  index?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`public-scene scroll-mt-24 px-4 py-20 sm:py-24 lg:py-28 ${className ?? ""}`}>
      <div className="public-container mx-auto max-w-6xl">
        {index ? <p className="public-mono mb-7 text-[11px] tracking-[0.2em] text-fg-muted">{index}</p> : null}
        {children}
      </div>
    </section>
  );
}

function SecondaryExplore({ className }: { className?: string }) {
  return (
    <a href="#site-file" className={className ?? "public-cta-secondary"}>
      {pub.seeProduct}
    </a>
  );
}

export function PublicHome() {
  useDocumentMeta({
    title: pub.pageTitle,
    description: pub.pageDescription,
    robots: "index, follow",
  });

  return (
    <div className="public-root public-shell min-h-dvh text-fg" dir="ltr">
      <a href="#main" className="skip-link">
        {pub.skipToContent}
      </a>
      <PublicHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        <section className="public-hero relative flex min-h-[calc(100dvh-3.5rem)] flex-col justify-center px-4 py-14 sm:py-16 lg:py-20">
          <div className="public-container mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(20rem,1.05fr)] lg:gap-14 xl:gap-16">
            <div className="flex max-w-xl flex-col gap-6 lg:gap-7">
              <p className="public-mono text-[11px] tracking-[0.2em] text-fg-muted">{pub.heroEyebrow}</p>
              <h1 className="public-hero-title">
                <span className="block text-fg">{pub.heroLine1}</span>
                <span className="mt-1.5 block text-fg-muted sm:mt-2">{pub.heroLine2}</span>
              </h1>
              <div className="flex max-w-lg flex-col gap-3">
                <p className="ltr-meta text-lg leading-8 text-fg sm:text-[1.2rem] sm:leading-8">{pub.heroSupport}</p>
                <p className="ltr-meta text-[15px] leading-7 text-fg-muted">{pub.heroLead}</p>
                <p dir="rtl" className="mt-1 max-w-md self-stretch text-start text-sm leading-7 text-fg-muted">
                  {pub.heroHebrew1}
                  <br />
                  {pub.heroHebrew2}
                </p>
              </div>
              <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
                <HeroEntry />
                <SecondaryExplore />
              </div>
            </div>
            <HeroConsole />
          </div>
        </section>

        <div className="public-rule" aria-hidden />

        <Scene id="pain" index={pub.s01} className="public-scene-chaos">
          <Manifest lines={[pub.chaosA, pub.chaosB]} />
          <div className="mt-14 lg:mt-16">
            <ChaosChain />
          </div>
        </Scene>

        <div className="public-rule" aria-hidden />

        <Scene id="site-file" index={pub.s02} className="public-scene-surface">
          <Manifest lines={[pub.siteFileA, pub.siteFileB]} />
          <p className="ltr-meta mt-5 max-w-xl text-[15px] leading-7 text-fg-muted sm:text-base sm:leading-8">
            {pub.siteFileSub}
          </p>
          <div className="mt-12 lg:mt-14">
            <SiteFileStage />
          </div>
        </Scene>

        <div className="public-rule" aria-hidden />

        <Scene id="twin" index={pub.s03} className="public-scene-control">
          <Manifest lines={[pub.twinA, pub.twinB]} />
          <p className="ltr-meta mt-5 max-w-xl text-[15px] leading-7 text-fg-muted sm:text-base sm:leading-8">
            {pub.twinSub}
          </p>
          <div className="mt-12 lg:mt-14">
            <TwinExplorer />
          </div>
        </Scene>

        <div className="public-rule" aria-hidden />

        <Scene id="operations" index={pub.s04}>
          <Manifest lines={[pub.opsA, pub.opsB]} />
          <div className="mt-14 lg:mt-16">
            <OpsChain />
          </div>
        </Scene>

        <div className="public-rule" aria-hidden />

        <Scene id="field" index={pub.s05} className="public-scene-field">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,24rem)] lg:gap-16">
            <div>
              <Manifest lines={[pub.fieldA, pub.fieldB]} />
              <p className="ltr-meta mt-5 max-w-md text-[15px] leading-7 text-fg-muted sm:text-base sm:leading-8">
                {pub.fieldSub}
              </p>
              <p className="public-mono mt-8 text-[11px] tracking-[0.18em] text-fg-muted">OFFICE → FIELD</p>
            </div>
            <FieldPhone />
          </div>
        </Scene>

        <div className="public-rule" aria-hidden />

        <Scene id="intelligence" index={pub.s06} className="public-scene-product">
          <Manifest lines={[pub.intelTitle]} mutedFrom={99} />
          <p className="ltr-meta mt-5 max-w-xl text-[15px] leading-7 text-fg-muted sm:text-base sm:leading-8">
            {pub.intelSub}
          </p>
          <div className="mt-12 max-w-2xl lg:mt-14">
            <IntelligencePanel />
          </div>
        </Scene>

        <div className="public-rule" aria-hidden />

        <Scene id="security" index={pub.s07}>
          <Manifest lines={[pub.securityTitleA, pub.securityTitleB]} />
          <p className="ltr-meta mt-5 max-w-xl text-[15px] leading-7 text-fg-muted sm:text-base sm:leading-8">
            {pub.securitySub}
          </p>
          <div className="mt-12 lg:mt-14">
            <SecurityArch />
          </div>
        </Scene>

        <div className="public-rule" aria-hidden />

        <Scene id="numbers" className="public-scene-control">
          <h2 className="public-mono text-[11px] tracking-[0.2em] text-fg-muted">{pub.metricsTitle}</h2>
          <div className="mt-10 lg:mt-12">
            <MetricsStrip />
          </div>
        </Scene>

        <div className="public-rule" aria-hidden />

        <Scene id="pilot" className="public-scene-pilot">
          <div className="public-pilot-panel">
            <h2 className="ltr-meta max-w-3xl text-[2rem] font-semibold leading-[1.05] tracking-[-0.045em] text-fg sm:text-5xl lg:text-[3.25rem]">
              {pub.pilotTitle}
            </h2>
            <p className="ltr-meta mt-6 max-w-xl text-[15px] leading-7 text-fg-muted sm:text-base">{pub.pilotBody}</p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
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
