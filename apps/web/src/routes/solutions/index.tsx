import { createFileRoute } from "@tanstack/react-router";
import { MarketingShell } from "../../components/public/marketing/enterprise/MarketingShell";
import { SolutionsExplorer } from "../../components/public/marketing/enterprise/SolutionsExplorer";
import { usePublicSeo } from "../../lib/public-seo";

export const Route = createFileRoute("/solutions/")({
  component: SolutionsIndexPage,
});

const origin = typeof window !== "undefined" ? window.location.origin : "https://site-secure.com";

function SolutionsIndexPage() {
  usePublicSeo({
    title: "פתרונות — SITE SECURE",
    description: "פתרונות לטכנאים עצמאיים, חברות התקנה, חברות אבטחה וארגונים — לפי סוג העסק.",
    canonical: `${origin}/solutions`,
  });

  return (
    <MarketingShell>
      <section className="mkt-dark mkt-section">
        <div className="mkt-container">
          <h1 className="mkt-h1">פתרונות לפי סוג עסק</h1>
          <p className="mkt-lede">בחרו קטגוריה — התוכן, המודולים וה־CTA מתעדכנים בלי רענון עמוד.</p>
        </div>
      </section>
      <section className="mkt-section">
        <div className="mkt-container">
          <SolutionsExplorer />
        </div>
      </section>
    </MarketingShell>
  );
}
