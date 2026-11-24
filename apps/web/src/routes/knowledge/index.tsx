import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MarketingShell } from "../../components/public/marketing/enterprise/MarketingShell";
import {
  KNOWLEDGE_ARTICLES,
  KNOWLEDGE_CATEGORIES,
  articlesByCategory,
  categoryLabel,
  type KnowledgeCategory,
} from "../../components/public/marketing/enterprise/knowledge-articles";
import { MARKETING_ROUTES } from "../../components/public/marketing/enterprise/marketing-routes";
import { usePublicSeo } from "../../lib/public-seo";

export const Route = createFileRoute("/knowledge/")({
  component: KnowledgePage,
});

const origin = typeof window !== "undefined" ? window.location.origin : "https://site-secure.com";

function KnowledgePage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<KnowledgeCategory | "all">("all");

  usePublicSeo({
    title: "מרכז ידע — SITE SECURE",
    description: "מדריכים קצרים על CCTV, ניהול עסקי ומערכת SITE SECURE — בלי טענות טכניות מומצאות.",
    canonical: `${origin}/knowledge`,
  });

  const filtered = useMemo(() => {
    const base = articlesByCategory(cat);
    const needle = q.trim().toLowerCase();
    if (!needle) return base;
    return base.filter(
      (a) =>
        a.title.toLowerCase().includes(needle) ||
        a.summary.toLowerCase().includes(needle) ||
        a.body.some((p) => p.toLowerCase().includes(needle)),
    );
  }, [q, cat]);

  const featured = KNOWLEDGE_ARTICLES.filter((a) => a.featured);

  return (
    <MarketingShell>
      <section className="mkt-dark mkt-section">
        <div className="mkt-container">
          <h1 className="mkt-h1">מרכז ידע</h1>
          <p className="mkt-lede">חיפוש, סינון לפי קטגוריה, ומאמרים מלאים בנתיב ייעודי.</p>
          <label className="mt-6 block max-w-xl">
            <span className="sr-only">חיפוש מאמרים</span>
            <input
              type="search"
              className="w-full min-h-12 rounded-[12px] border border-[var(--mkt-border)] bg-[var(--mkt-surface)] px-4 text-[var(--mkt-on-dark)]"
              placeholder="חיפוש במאמרים…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container">
          <div className="mkt-xp-tabs" role="tablist" aria-label="קטגוריות ידע">
            {KNOWLEDGE_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                role="tab"
                aria-selected={cat === c.key}
                className={`mkt-xp-tab${cat === c.key ? " is-active" : ""}`}
                onClick={() => setCat(c.key)}
              >
                {c.label}
              </button>
            ))}
          </div>

          {cat === "all" && !q ? (
            <div className="mb-10">
              <h2 className="mkt-h2">מומלצים</h2>
              <div className="mkt-grid-3 mt-6">
                {featured.map((a) => (
                  <ArticleCard key={a.slug} slug={a.slug} title={a.title} summary={a.summary} minutes={a.minutes} category={a.category} />
                ))}
              </div>
            </div>
          ) : null}

          <h2 className="mkt-h2">{q ? "תוצאות חיפוש" : "מאמרים"}</h2>
          {filtered.length ? (
            <div className="mkt-grid-2 mt-6">
              {filtered.map((a) => (
                <ArticleCard
                  key={a.slug}
                  slug={a.slug}
                  title={a.title}
                  summary={a.summary}
                  minutes={a.minutes}
                  category={a.category}
                />
              ))}
            </div>
          ) : (
            <div className="mkt-card mt-6" role="status">
              <p className="m-0 text-[17px] leading-7">
                אין מאמרים לקטגוריה או לחיפוש הנוכחי. נסו קטגוריה אחרת או חזרו לכל המאמרים.
              </p>
              <button type="button" className="mkt-btn mkt-btn-secondary mt-4" onClick={() => { setCat("all"); setQ(""); }}>
                הצגת כל המאמרים
              </button>
            </div>
          )}

          <Link to={MARKETING_ROUTES.cctvTool} className="mkt-btn mkt-btn-secondary mt-10">
            למחשבון אחסון CCTV
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}

function ArticleCard({
  slug,
  title,
  summary,
  minutes,
  category,
}: {
  slug: string;
  title: string;
  summary: string;
  minutes: number;
  category: KnowledgeCategory;
}) {
  return (
    <article className="mkt-card mkt-reveal">
      <p className="m-0 text-xs font-semibold text-[var(--mkt-blue)]">
        {categoryLabel(category)} · {minutes} דק׳ קריאה
      </p>
      <h3 className="mt-2 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-[var(--mkt-muted)]">{summary}</p>
      <Link to="/knowledge/$slug" params={{ slug }} className="mt-4 inline-flex font-semibold text-[var(--mkt-blue)]">
        לקריאת המאמר ←
      </Link>
    </article>
  );
}
