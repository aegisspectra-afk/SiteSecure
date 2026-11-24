import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "../../components/public/marketing/enterprise/MarketingShell";
import { SOLUTIONS } from "../../components/public/marketing/enterprise/marketing-content";
import { usePublicSeo } from "../../lib/public-seo";

export const Route = createFileRoute("/solutions/")({
  component: SolutionsIndexPage,
});

const origin = typeof window !== "undefined" ? window.location.origin : "https://site-secure.com";

function SolutionsIndexPage() {
  usePublicSeo({
    title: "פתרונות — SITE SECURE",
    description: "פתרונות לטכנאים עצמאיים, חברות התקנה, חברות אבטחה וארגונים.",
    canonical: `${origin}/solutions`,
  });

  return (
    <MarketingShell>
      <section className="mkt-dark mkt-section">
        <div className="mkt-container">
          <h1 className="mkt-h1">פתרונות לפי סוג עסק</h1>
          <p className="mkt-lede">בחרו את המסלול שמתאים לגודל ולאופן העבודה שלכם.</p>
        </div>
      </section>
      <section className="mkt-section">
        <div className="mkt-container mkt-grid-2">
          {SOLUTIONS.map((s) => (
            <article key={s.slug} className="mkt-card mkt-reveal">
              <h2 className="m-0 text-xl font-semibold">{s.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--mkt-muted)]">{s.body}</p>
              <Link to={s.href} className="mt-4 inline-flex font-semibold text-[var(--mkt-blue)]">
                לעמוד הפתרון ←
              </Link>
            </article>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
