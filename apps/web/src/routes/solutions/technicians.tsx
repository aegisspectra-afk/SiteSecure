import { createFileRoute } from "@tanstack/react-router";
import { MarketingShell } from "../../components/public/marketing/enterprise/MarketingShell";
import { SolutionsExplorer } from "../../components/public/marketing/enterprise/SolutionsExplorer";
import { usePublicSeo } from "../../lib/public-seo";

export const Route = createFileRoute("/solutions/technicians")({
  component: Page,
});

const origin = typeof window !== "undefined" ? window.location.origin : "https://site-secure.com";

function Page() {
  usePublicSeo({
    title: "פתרון לטכנאים עצמאיים — SITE SECURE",
    description: "הצעות מחיר, סיור באתר ומסירה — לטכנאי עצמאי בלי לנהל חמש תוכנות.",
    canonical: `${origin}/solutions/technicians`,
  });
  return (
    <MarketingShell>
      <section className="mkt-dark mkt-section">
        <div className="mkt-container">
          <h1 className="mkt-h1">לטכנאים עצמאיים</h1>
          <p className="mkt-lede">מהצעה ראשונה ועד תעודת מסירה — מסלול Free מתאים להתחלה מסודרת.</p>
        </div>
      </section>
      <section className="mkt-section">
        <div className="mkt-container">
          <SolutionsExplorer initial="technicians" />
        </div>
      </section>
    </MarketingShell>
  );
}
