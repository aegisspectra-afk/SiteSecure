import { Link } from "@tanstack/react-router";
import { legal, type LegalPage, type LegalSlug } from "../../i18n/legal-he";
import { pub } from "../../i18n/public-he";
import { useDocumentMeta } from "../../lib/document-meta";
import { MarketingShell } from "./marketing/enterprise/MarketingShell";
import { MARKETING_ROUTES } from "./marketing/enterprise/marketing-routes";
import { LegalContact, LegalNav } from "./LegalNav";

export function LegalDocument({ slug }: { slug: LegalSlug }) {
  const page: LegalPage = legal.pages[slug];
  useDocumentMeta({
    title: `${page.title} — ${pub.brand}`,
    description: page.lead,
    robots: "index, follow",
  });

  return (
    <MarketingShell darkNav={false}>
      <article className="mkt-container px-0 py-12" dir="rtl">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
          <header className="flex flex-col gap-4">
            <p
              className="w-fit rounded-[12px] border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-medium text-[var(--mkt-ink)]"
              role="note"
            >
              {legal.draftNotice}
            </p>
            <p className="text-[11px] tracking-[0.22em] text-[var(--mkt-muted)]">{legal.kicker}</p>
            <h1 className="mkt-h1 text-[var(--mkt-ink)]">{page.title}</h1>
            <p className="max-w-2xl text-[17px] leading-7 text-[var(--mkt-ink-soft)]">{page.lead}</p>
            {page.updated ? (
              <p className="text-sm text-[var(--mkt-muted)]">
                {legal.updatedPrefix} {page.updated}
              </p>
            ) : null}
          </header>

          <nav className="mkt-card" aria-label="תוכן עניינים">
            <p className="m-0 mb-3 text-sm font-semibold">תוכן עניינים</p>
            <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
              {page.sections.map((section) => (
                <li key={section.title}>
                  <a href={`#${slugify(section.title)}`} className="text-[var(--mkt-blue)]">
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <LegalNav current={slug} className="border-y border-[var(--mkt-border)] py-4" />

          <div className="flex flex-col gap-12">
            {page.sections.map((section) => (
              <section key={section.title} id={slugify(section.title)} className="scroll-mt-24 flex flex-col gap-4">
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-[var(--mkt-ink)]">{section.title}</h2>
                {section.blocks.map((block, i) => {
                  if (block.type === "p") {
                    return (
                      <p key={`${section.title}-p-${i}`} className="text-[17px] leading-7 text-[var(--mkt-ink-soft)]">
                        {block.text}
                      </p>
                    );
                  }
                  if (block.type === "list") {
                    return (
                      <ul key={`${section.title}-list-${i}`} className="flex list-disc flex-col gap-2 ps-5">
                        {block.items.map((item) => (
                          <li key={item} className="text-[17px] leading-7 text-[var(--mkt-ink-soft)]">
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

          <section id="contact" className="flex flex-col gap-4 border-t border-[var(--mkt-border)] pt-10">
            <h2 className="text-xl font-semibold text-[var(--mkt-ink)]">{legal.moreTitle}</h2>
            <p className="text-[17px] leading-7 text-[var(--mkt-muted)]">{legal.moreBody}</p>
            <Link to={MARKETING_ROUTES.contact} className="mkt-btn mkt-btn-primary w-fit">
              {legal.contactCta}
            </Link>
          </section>
        </div>
      </article>
    </MarketingShell>
  );
}

export function LegalNotFound() {
  useDocumentMeta({
    title: `${legal.notFoundTitle} — ${pub.brand}`,
    robots: "noindex, nofollow",
  });
  return (
    <MarketingShell darkNav={false}>
      <main className="mkt-container px-0 py-16" dir="rtl">
        <div className="mx-auto flex max-w-xl flex-col gap-4">
          <p className="text-[11px] tracking-[0.22em] text-[var(--mkt-muted)]">{legal.kicker}</p>
          <h1 className="mkt-h1 text-[var(--mkt-ink)]">{legal.notFoundTitle}</h1>
          <p className="text-[17px] leading-7 text-[var(--mkt-muted)]">{legal.notFoundBody}</p>
          <Link
            to="/legal/$slug"
            params={{ slug: "privacy" }}
            className="mkt-btn mkt-btn-primary mt-4 w-fit"
          >
            {legal.pages.privacy.title}
          </Link>
        </div>
      </main>
    </MarketingShell>
  );
}

function slugify(title: string) {
  return title.replace(/\s+/g, "-").replace(/[^\w\u0590-\u05FF-]/g, "").toLowerCase();
}
