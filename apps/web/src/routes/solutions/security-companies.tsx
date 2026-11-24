import { createFileRoute } from "@tanstack/react-router";
import { MarketingShell } from "../../components/public/marketing/enterprise/MarketingShell";
import { SolutionsExplorer } from "../../components/public/marketing/enterprise/SolutionsExplorer";
import { usePublicSeo } from "../../lib/public-seo";

export const Route = createFileRoute("/solutions/security-companies")({
  component: Page,
});

const origin = typeof window !== "undefined" ? window.location.origin : "https://site-secure.com";

function Page() {
  usePublicSeo({
    title: "פתרון לחברות אבטחה והתקנה — SITE SECURE",
    description: "שיבוץ טכנאים, תיק אתר ותזכורות שירות לחברות אבטחה והתקנה.",
    canonical: `${origin}/solutions/security-companies`,
  });
  return (
    <MarketingShell>
      <section className="mkt-dark mkt-section">
        <div className="mkt-container">
          <h1 className="mkt-h1">לחברות אבטחה והתקנה</h1>
          <p className="mkt-lede">צוות טכנאים, תיק אתר חי ותזכורות שירות — במסלול Business ומעלה.</p>
        </div>
      </section>
      <section className="mkt-section">
        <div className="mkt-container">
          <SolutionsExplorer initial="security" />
        </div>
      </section>
    </MarketingShell>
  );
}
