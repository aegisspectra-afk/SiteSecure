import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "../../components/public/marketing/enterprise/MarketingShell";
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
          <Link to="/pricing" className="mkt-btn mkt-btn-primary mt-6">
            למחירון
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
