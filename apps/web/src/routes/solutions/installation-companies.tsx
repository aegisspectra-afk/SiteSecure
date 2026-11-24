import { createFileRoute } from "@tanstack/react-router";
import { MarketingShell } from "../../components/public/marketing/enterprise/MarketingShell";
import { SolutionsExplorer } from "../../components/public/marketing/enterprise/SolutionsExplorer";
import { usePublicSeo } from "../../lib/public-seo";

export const Route = createFileRoute("/solutions/installation-companies")({
  component: Page,
});

const origin = typeof window !== "undefined" ? window.location.origin : "https://site-secure.com";

function Page() {
  usePublicSeo({
    title: "פתרון לחברות התקנה — SITE SECURE",
    description: "סנכרון משרד ושטח לחברות התקנה קטנות: הצעות, פרויקטים ותמונות מהסיור.",
    canonical: `${origin}/solutions/installation-companies`,
  });
  return (
    <MarketingShell>
      <section className="mkt-dark mkt-section">
        <div className="mkt-container">
          <h1 className="mkt-h1">לחברות התקנה קטנות</h1>
          <p className="mkt-lede">משרד ושטח מסונכרנים — בלי לאבד הצעות, תמונות או מעקב אחרי עבודות.</p>
        </div>
      </section>
      <section className="mkt-section">
        <div className="mkt-container">
          <SolutionsExplorer initial="installation" />
        </div>
      </section>
    </MarketingShell>
  );
}
