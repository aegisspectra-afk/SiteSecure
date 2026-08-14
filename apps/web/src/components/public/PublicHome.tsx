import type { ReactNode } from "react";
import { pub } from "../../i18n/public-he";
import { useDocumentMeta } from "../../lib/document-meta";
import { CtaLink, PublicFooter, PublicHeader } from "./PublicChrome";
import { ChaosChain, FieldPhone, HeroConsole, OpsChain, SecurityArch, SiteFileStage, TwinExplorer } from "./PublicSurfaces";

function Manifest({ lines, mutedFrom = 1 }: { lines: string[]; mutedFrom?: number }) {
  return (
    <p className="ltr-meta text-4xl font-semibold leading-[0.95] tracking-[-0.045em] text-fg sm:text-6xl">
      {lines.map((line, i) => (
        <span key={line} className={i >= mutedFrom ? "mt-2 block text-fg-muted" : "block"}>
          {line}
        </span>
      ))}
    </p>
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
    <section id={id} className={`scroll-mt-24 px-4 py-24 lg:py-32 ${className ?? ""}`}>
      <div className="mx-auto max-w-6xl">
        {index ? <h2 className="public-mono mb-8 text-[11px] tracking-[0.22em] text-fg-muted">{index}</h2> : null}
        {children}
      </div>
    </section>
  );
}

export function PublicHome() {
  useDocumentMeta({
    title: pub.pageTitle,
    description: pub.pageDescription,
    robots: "index, follow",
  });

  return (
    <div className="public-root public-shell min-h-dvh text-fg">
      <a href="#main" className="skip-link">
        {pub.skipToContent}
      </a>
      <PublicHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        <section className="flex min-h-[calc(100dvh-3.5rem)] flex-col justify-center px-4 py-12" dir="ltr">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,42%)]">
            <div className="flex max-w-xl flex-col gap-7">
              <h1 className="text-[2.7rem] font-semibold leading-[0.9] tracking-[-0.05em] text-fg sm:text-7xl">
                <span className="block">{pub.heroLine1}</span>
                <span className="mt-2 block text-fg-muted">{pub.heroLine2}</span>
              </h1>
              <div dir="rtl" className="flex flex-col gap-2 text-lg leading-8 text-fg">
                <p>
                  {pub.heroHebrew1}
                  <br />
                  {pub.heroHebrew2}
                </p>
                <p className="text-base text-fg-muted">{pub.heroLead}</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row" dir="rtl">
                <CtaLink to="/register">{pub.joinPilot}</CtaLink>
                <a
                  href="#site-file"
                  className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius-control)] border border-border px-5 text-sm font-medium text-fg hover:bg-public-elevated"
                >
                  {pub.seeProduct}
                </a>
              </div>
            </div>
            <HeroConsole />
          </div>
        </section>

        <Scene id="pain" index={pub.s01} className="public-scene-chaos">
          <Manifest lines={[pub.chaosA, pub.chaosB]} />
          <div className="mt-16">
            <ChaosChain />
          </div>
        </Scene>

        <Scene id="site-file" index={pub.s02}>
          <Manifest lines={[pub.siteFileA, pub.siteFileB]} />
          <div className="mt-14">
            <SiteFileStage />
          </div>
        </Scene>

        <Scene id="twin" index={pub.s03} className="public-scene-control">
          <Manifest lines={[pub.twinA, pub.twinB]} />
          <div className="mt-14">
            <TwinExplorer />
          </div>
        </Scene>

        <Scene id="operations" index={pub.s04}>
          <Manifest lines={[pub.opsA, pub.opsB]} />
          <div className="mt-16">
            <OpsChain />
          </div>
        </Scene>

        <Scene id="field" index={pub.s05} className="public-scene-field">
          <Manifest lines={[pub.fieldA, pub.fieldB]} />
          <div className="mt-14">
            <FieldPhone />
          </div>
        </Scene>

        <Scene id="security" index={pub.s06}>
          <Manifest lines={[pub.securityTitle]} mutedFrom={99} />
          <div className="mt-16">
            <SecurityArch />
          </div>
        </Scene>

        <Scene id="pilot" className="public-scene-product">
          <h2 className="ltr-meta text-5xl font-semibold tracking-[-0.05em] text-fg sm:text-6xl">{pub.pilotTitle}</h2>
          <p dir="rtl" className="mt-6 max-w-md text-base leading-7 text-fg-muted">
            {pub.pilotBody}
          </p>
          <div className="mt-8">
            <CtaLink to="/register">{pub.joinPilot}</CtaLink>
          </div>
        </Scene>
      </main>
      <PublicFooter />
    </div>
  );
}
