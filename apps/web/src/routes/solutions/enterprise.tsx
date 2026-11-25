import { createFileRoute } from "@tanstack/react-router";
import { EnterpriseLeadForm } from "../../components/public/marketing/enterprise/EnterpriseLeadForm";
import { MarketingShell } from "../../components/public/marketing/enterprise/MarketingShell";
import { SolutionsExplorer } from "../../components/public/marketing/enterprise/SolutionsExplorer";
import { usePublicSeo } from "../../lib/public-seo";

export const Route = createFileRoute("/solutions/enterprise")({
  component: Page,
});

const origin = typeof window !== "undefined" ? window.location.origin : "https://site-secure.com";

function Page() {
  usePublicSeo({
    title: "Enterprise — SITE SECURE",
    description: "מסלול ארגוני: משתמשים ללא הגבלה, אינטגרציות ותמיכה ייעודית.",
    canonical: `${origin}/solutions/enterprise`,
  });
  return (
    <MarketingShell>
      <section className="mkt-dark mkt-section">
        <div className="mkt-container">
          <h1 className="mkt-h1">לארגונים גדולים</h1>
          <p className="mkt-lede">
            ריבוי משתמשים, אינטגרציות לפי דרישה ותמיכה ייעודית. השאירו פרטים — נחזור לתיאום.
          </p>
        </div>
      </section>
      <section className="mkt-section">
        <div className="mkt-container">
          <SolutionsExplorer initial="enterprise" />
        </div>
      </section>
      <section className="mkt-section bg-[var(--mkt-white)]">
        <div className="mkt-container grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="mkt-h2">פנייה ל-Enterprise</h2>
            <p className="mkt-lede">השאירו פרטים — הפנייה נשמרת במערכת רק אחרי אישור מהשרת.</p>
          </div>
          <EnterpriseLeadForm source="enterprise" />
        </div>
      </section>
    </MarketingShell>
  );
}
