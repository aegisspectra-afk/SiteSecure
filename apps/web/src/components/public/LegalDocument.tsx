import { Link } from "@tanstack/react-router";
import { legal, type LegalPage, type LegalSlug } from "../../i18n/legal-he";
import { pub } from "../../i18n/public-he";
import { useDocumentMeta } from "../../lib/document-meta";
import { LegalContact, LegalNav } from "./LegalNav";
import { PublicFooter, PublicHeader } from "./PublicChrome";

export function LegalDocument({ slug }: { slug: LegalSlug }) {
  const page: LegalPage = legal.pages[slug];
  useDocumentMeta({
    title: `${page.title} — ${pub.brand}`,
    description: page.lead,
    robots: "index, follow",
  });

  return (
    <div className="public-root public-shell min-h-dvh text-fg">
      <a href="#legal-content" className="skip-link">
        {pub.skipToContent}
      </a>
      <PublicHeader />
      <main id="legal-content" tabIndex={-1} className="outline-none">
        <article className="px-4 py-16 lg:py-24" dir="rtl">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
            <header className="flex flex-col gap-4">
              <p className="public-mono text-[11px] tracking-[0.22em] text-fg-muted">{legal.kicker}</p>
              <h1 className="text-4xl font-semibold tracking-[-0.04em] text-fg sm:text-5xl">{page.title}</h1>
              <p className="max-w-2xl text-base leading-7 text-fg-muted">{page.lead}</p>
              {page.updated ? (
                <p className="text-sm text-fg-muted">
                  {legal.updatedPrefix} {page.updated}
                </p>
              ) : null}
            </header>

            <LegalNav current={slug} className="border-y border-border py-4" />

            <div className="flex flex-col gap-12">
              {page.sections.map((section) => (
                <section key={section.title} className="flex flex-col gap-4">
                  <h2 className="text-xl font-semibold tracking-[-0.03em] text-fg">{section.title}</h2>
                  {section.blocks.map((block, i) => {
                    if (block.type === "p") {
                      return (
                        <p key={`${section.title}-p-${i}`} className="text-sm leading-7 text-fg">
                          {block.text}
                        </p>
                      );
                    }
                    if (block.type === "list") {
                      return (
                        <ul key={`${section.title}-list-${i}`} className="flex list-disc flex-col gap-2 ps-5">
                          {block.items.map((item) => (
                            <li key={item} className="text-sm leading-7 text-fg">
                              {item}
                            </li>
                          ))}
                        </ul>
                      );
                    }
                    return (
                      <LegalContact
                        key={`${section.title}-${block.title}-${i}`}
                        title={block.title}
                        email={block.email}
                        phone={block.phone}
                        extra={block.extra}
                      />
                    );
                  })}
                </section>
              ))}
            </div>

            <section id="contact" className="flex flex-col gap-4 border-t border-border pt-10">
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-fg">{legal.moreTitle}</h2>
              <p className="text-sm leading-7 text-fg-muted">{legal.moreBody}</p>
              <LegalContact
                title={legal.contactCta}
                email="info@aegisspectra.co.il"
                phone="053-275-7750"
              />
            </section>
          </div>
        </article>
      </main>
      <PublicFooter />
    </div>
  );
}

export function LegalNotFound() {
  useDocumentMeta({
    title: `${legal.notFoundTitle} — ${pub.brand}`,
    robots: "noindex, nofollow",
  });
  return (
    <div className="public-root public-shell min-h-dvh text-fg">
      <PublicHeader />
      <main className="px-4 py-24" dir="rtl">
        <div className="mx-auto flex max-w-xl flex-col gap-4">
          <p className="public-mono text-[11px] tracking-[0.22em] text-fg-muted">{legal.kicker}</p>
          <h1 className="text-4xl font-semibold tracking-[-0.04em] text-fg">{legal.notFoundTitle}</h1>
          <p className="text-sm leading-7 text-fg-muted">{legal.notFoundBody}</p>
          <Link
            to="/legal/$slug"
            params={{ slug: "privacy" }}
            className="mt-4 w-fit text-sm font-medium text-action hover:underline"
          >
            {legal.pages.privacy.title}
          </Link>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
