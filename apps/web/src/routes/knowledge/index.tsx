import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "../../components/public/marketing/enterprise/MarketingShell";
import { usePublicSeo } from "../../lib/public-seo";

export const Route = createFileRoute("/knowledge/")({
  component: KnowledgePage,
});

const origin = typeof window !== "undefined" ? window.location.origin : "https://site-secure.com";

const ARTICLES = [
  {
    title: "תוכנה לניהול חברות התקנה",
    body: "איך מרכזים הצעות, פרויקטים ושירות במקום אחד במקום אקסל ווואטסאפ.",
  },
  {
    title: "מערכת לניהול טכנאים",
    body: "שיבוץ, צ׳קליסט וחתימה בשטח — מה שקיים במסלול Business.",
  },
  {
    title: "הצעות מחיר למתקינים",
    body: "אשף CCTV, חלופות לוועד בית ושליחה ללקוח בוואטסאפ.",
  },
  {
    title: "ניהול קריאות שירות והתקנות מצלמות",
    body: "מסיור באתר דרך התקנה ועד תיק אתר ואחריות.",
  },
] as const;

function KnowledgePage() {
  usePublicSeo({
    title: "מרכז ידע — SITE SECURE",
    description: "מדריכים קצרים על ניהול חברות התקנה, טכנאים והצעות מחיר בעברית.",
    canonical: `${origin}/knowledge`,
  });

  return (
    <MarketingShell>
      <section className="mkt-dark mkt-section">
        <div className="mkt-container">
          <h1 className="mkt-h1">מרכז ידע</h1>
          <p className="mkt-lede">תוכן קצר ומדויק — בלי דחיסת מילות מפתח.</p>
        </div>
      </section>
      <section className="mkt-section">
        <div className="mkt-container mkt-grid-2">
          {ARTICLES.map((a) => (
            <article key={a.title} className="mkt-card mkt-reveal">
              <h2 className="m-0 text-lg font-semibold">{a.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--mkt-muted)]">{a.body}</p>
            </article>
          ))}
        </div>
        <div className="mkt-container mt-10">
          <Link to="/tools/cctv-storage" className="mkt-btn mkt-btn-secondary">
            למחשבון אחסון CCTV
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
