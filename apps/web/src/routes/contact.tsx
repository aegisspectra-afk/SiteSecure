import { createFileRoute } from "@tanstack/react-router";
import { EnterpriseLeadForm } from "../components/public/marketing/enterprise/EnterpriseLeadForm";
import { MarketingShell } from "../components/public/marketing/enterprise/MarketingShell";
import { usePublicSeo } from "../lib/public-seo";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
});

const origin = typeof window !== "undefined" ? window.location.origin : "https://site-secure.com";

function ContactPage() {
  usePublicSeo({
    title: "צור קשר / תיאום הדגמה — SITE SECURE",
    description: "פנייה ל-SITE SECURE לתיאום הדגמה או מסלול Enterprise.",
    canonical: `${origin}/contact`,
  });

  return (
    <MarketingShell>
      <section className="mkt-dark mkt-section">
        <div className="mkt-container grid gap-10 lg:grid-cols-2">
          <div>
            <h1 className="mkt-h1">צור קשר</h1>
            <p className="mkt-lede">
              לתיאום הדגמה, שאלות על Business/Enterprise, או הצטרפות לבטא — השאירו פרטים ונחזור תוך יום
              עסקים.
            </p>
          </div>
          <EnterpriseLeadForm source="demo" />
        </div>
      </section>
    </MarketingShell>
  );
}
