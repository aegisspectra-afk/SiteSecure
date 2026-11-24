import { createFileRoute } from "@tanstack/react-router";
import { EnterpriseLeadForm } from "../../components/public/marketing/enterprise/EnterpriseLeadForm";
import { MarketingShell } from "../../components/public/marketing/enterprise/MarketingShell";
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
        <div className="mkt-container grid gap-10 lg:grid-cols-2">
          <div>
            <h1 className="mkt-h1">לארגונים גדולים</h1>
            <p className="mkt-lede">
              ריבוי משתמשים, התאמות ותמיכה ייעודית. אין סליקה עצמית בבטא — נחזור אליכם לתיאום.
            </p>
          </div>
          <EnterpriseLeadForm source="enterprise" />
        </div>
      </section>
    </MarketingShell>
  );
}
