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
  layout = "stack",
  children,
}: {
  id: string;
  index?: string;
  className?: string;
  density?: "default" | "tight" | "air";
  layout?: "stack" | "split-start" | "split-end" | "object-wide";
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`public-scene public-scene-${density} public-layout-${layout} scroll-mt-24 px-4 ${className ?? ""}`}
    >
      <div className="public-container mx-auto max-w-6xl">
        {index ? <p className="public-mono mb-5 text-[11px] tracking-[0.2em] text-fg-muted sm:mb-6">{index}</p> : null}
        {children}
      </div>
    </section>
  );
}

function SecondaryExplore({ className }: { className?: string }) {
  return (
    <a href="/#site-file" className={className ?? "public-cta-secondary"}>
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
        <section className="public-hero relative flex min-h-[calc(100dvh-3.5rem)] flex-col justify-center px-4 py-12 sm:py-14 lg:py-16">
          <div className="public-container mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(21rem,1.08fr)] lg:gap-12 xl:gap-16">
            <div className="flex max-w-xl flex-col gap-5 lg:gap-6">
              <p className="public-mono text-[11px] tracking-[0.2em] text-fg-muted">{pub.heroEyebrow}</p>
              <h1 className="public-hero-title">
                <span className="public-hero-line text-fg">{pub.heroLine1}</span>
                <span className="public-hero-line is-muted">{pub.heroLine2}</span>
              </h1>
              <div className="flex max-w-lg flex-col gap-2.5">
                <p className="ltr-meta text-lg leading-7 text-fg sm:text-[1.2rem] sm:leading-8">{pub.heroSupport}</p>
                <p className="ltr-meta text-[15px] leading-7 text-fg-muted">{pub.heroLead}</p>
                <p dir="rtl" lang="he" className="public-hero-he mt-1 max-w-md self-stretch text-start">
                  {pub.heroHebrew1}
                  <span className="public-hero-he-sep" aria-hidden>
                    {" · "}
                  </span>
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

        <Scene id="pain" index={pub.s01} className="public-scene-chaos" density="air">
          <Manifest lines={[pub.chaosA, pub.chaosB]} />
          <div className="mt-10 lg:mt-12">
            <ChaosChain />
          </div>
        </Scene>

        <div className="public-rule" aria-hidden />

        <Scene id="site-file" index={pub.s02} className="public-scene-surface" layout="object-wide">
          <div className="public-split lg:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)] lg:items-start lg:gap-12 xl:gap-14">
            <div className="public-split-copy">
              <Manifest lines={[pub.siteFileA, pub.siteFileB]} />
              <p className="ltr-meta mt-4 max-w-sm text-[15px] leading-7 text-fg-muted sm:text-base sm:leading-8">
                {pub.siteFileSub}
              </p>
            </div>
            <div className="public-split-object mt-8 lg:mt-0">
              <SiteFileStage />
            </div>
          </div>
        </Scene>

        <div className="public-rule" aria-hidden />

        <Scene id="twin" index={pub.s03} className="public-scene-control" density="tight" layout="split-end">
          <div className="public-split lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start lg:gap-12">
            <div className="public-split-object order-2 lg:order-1 mt-8 lg:mt-0">
              <TwinExplorer />
            </div>
            <div className="public-split-copy order-1 lg:order-2 lg:pt-2">
              <Manifest lines={[pub.twinA, pub.twinB]} />
              <p className="ltr-meta mt-4 max-w-md text-[15px] leading-7 text-fg-muted sm:text-base sm:leading-8">
                {pub.twinSub}
              </p>
            </div>
          </div>
        </Scene>

        <div className="public-rule" aria-hidden />

        <Scene id="operations" index={pub.s04} layout="object-wide">
          <Manifest lines={[pub.opsA, pub.opsB]} />
          <p className="ltr-meta mt-4 max-w-xl text-[15px] leading-7 text-fg-muted sm:text-base sm:leading-8">
            {pub.opsSub}
          </p>
          <div className="mt-8 lg:mt-10">
            <OpsChain />
          </div>
        </Scene>

        <div className="public-rule" aria-hidden />

        <Scene id="field" index={pub.s05} className="public-scene-field" layout="split-start">
          <div className="public-split lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] lg:items-center lg:gap-14">
            <div className="public-split-copy">
              <Manifest lines={[pub.fieldA, pub.fieldB]} />
              <p className="ltr-meta mt-4 max-w-md text-[15px] leading-7 text-fg-muted sm:text-base sm:leading-8">
                {pub.fieldSub}
              </p>
              <p className="public-mono mt-6 text-[11px] tracking-[0.18em] text-fg-muted">OFFICE → FIELD</p>
            </div>
            <div className="public-split-object mt-8 lg:mt-0">
              <FieldPhone />
            </div>
          </div>
        </Scene>

        <div className="public-rule" aria-hidden />

        <Scene id="intelligence" index={pub.s06} className="public-scene-product" density="tight" layout="split-start">
          <div className="public-split lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start lg:gap-12">
            <div className="public-split-copy">
              <p className="public-concept-badge mb-4">{pub.intelConceptBadge}</p>
              <Manifest lines={[pub.intelTitle]} mutedFrom={99} />
              <p className="ltr-meta mt-4 max-w-md text-[15px] leading-7 text-fg-muted sm:text-base sm:leading-8">
                {pub.intelSub}
              </p>
            </div>
            <div className="public-split-object mt-8 max-w-xl lg:mt-0 lg:max-w-none">
              <IntelligencePanel />
            </div>
          </div>
        </Scene>

        <div className="public-rule" aria-hidden />

        <Scene id="security" index={pub.s07} density="tight">
          <div className="max-w-3xl">
            <Manifest lines={[pub.securityTitleA, pub.securityTitleB]} />
            <p className="ltr-meta mt-4 text-[15px] leading-7 text-fg-muted sm:text-base sm:leading-8">
              {pub.securitySub}
            </p>
          </div>
          <div className="mt-8 lg:mt-10">
            <SecurityArch />
          </div>
        </Scene>

        <div className="public-rule" aria-hidden />

        <Scene id="pilot" className="public-scene-pilot" density="air">
          <div className="public-pilot-panel">
            <h2 className="ltr-meta max-w-3xl text-[2rem] font-semibold leading-[1.08] tracking-[-0.035em] text-fg sm:text-5xl lg:text-[3.1rem]">
              {pub.pilotTitle}
            </h2>
            <p className="ltr-meta mt-5 max-w-xl text-[15px] leading-7 text-fg-muted sm:mt-6 sm:text-base">{pub.pilotBody}</p>
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
