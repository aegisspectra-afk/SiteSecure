import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "../../components/public/marketing/enterprise/MarketingShell";
import {
  articleBySlug,
  categoryLabel,
  relatedArticles,
} from "../../components/public/marketing/enterprise/knowledge-articles";
import { MARKETING_ROUTES } from "../../components/public/marketing/enterprise/marketing-routes";
import { usePublicSeo } from "../../lib/public-seo";

export const Route = createFileRoute("/knowledge/$slug")({
  component: KnowledgeArticlePage,
});

const origin = typeof window !== "undefined" ? window.location.origin : "https://site-secure.com";

function KnowledgeArticlePage() {
  const { slug } = Route.useParams();
  const article = articleBySlug(slug);

  usePublicSeo({
    title: article ? `${article.title} — מרכז ידע` : "מאמר לא נמצא — מרכז ידע",
    description: article?.summary ?? "המאמר שביקשתם לא נמצא במרכז הידע.",
    canonical: `${origin}/knowledge/${slug}`,
  });

  if (!article) {
    return (
      <MarketingShell darkNav={false}>
        <section className="mkt-section">
          <div className="mkt-container max-w-2xl">
            <nav className="mb-6 text-sm" aria-label="פירורי לחם">
              <Link to={MARKETING_ROUTES.knowledge}>מרכז ידע</Link>
              <span aria-hidden> / </span>
              <span>לא נמצא</span>
            </nav>
            <h1 className="mkt-h1">המאמר לא נמצא</h1>
            <p className="mkt-lede">ייתכן שהקישור ישן או שהכתובת שגויה.</p>
            <Link to={MARKETING_ROUTES.knowledge} className="mkt-btn mkt-btn-primary mt-6">
              חזרה למרכז הידע
            </Link>
          </div>
        </section>
      </MarketingShell>
    );
  }

  const related = relatedArticles(article.slug);

  return (
    <MarketingShell darkNav={false}>
      <section className="mkt-section">
        <div className="mkt-container max-w-3xl">
          <nav className="mb-6 text-sm text-[var(--mkt-muted)]" aria-label="פירורי לחם">
            <Link to={MARKETING_ROUTES.knowledge} className="text-[var(--mkt-blue)]">
              מרכז ידע
            </Link>
            <span aria-hidden> / </span>
            <span>{categoryLabel(article.category)}</span>
            <span aria-hidden> / </span>
            <span>{article.title}</span>
          </nav>

          <p className="mkt-kicker">
            {categoryLabel(article.category)} · {article.minutes} דק׳ · עודכן {article.updated}
          </p>
          <h1 className="mkt-h1 mt-2 text-[var(--mkt-ink)]">{article.title}</h1>
          <p className="mkt-lede">{article.summary}</p>

          <div className="mt-8 grid gap-4">
            {article.body.map((p) => (
              <p key={p} className="m-0 text-[17px] leading-7 text-[var(--mkt-ink-soft)]">
                {p}
              </p>
            ))}
          </div>

          {related.length ? (
            <aside className="mt-12">
              <h2 className="mkt-h2 text-[var(--mkt-ink)]">מאמרים קשורים</h2>
              <ul className="mt-4 grid gap-3 p-0 list-none">
                {related.map((r) => (
                  <li key={r.slug} className="mkt-card">
                    <Link to="/knowledge/$slug" params={{ slug: r.slug }} className="font-semibold text-[var(--mkt-blue)]">
                      {r.title}
                    </Link>
                    <p className="mt-1 m-0 text-sm text-[var(--mkt-muted)]">{r.summary}</p>
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}
        </div>
      </section>
    </MarketingShell>
  );
}
