import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "../components/public/marketing/enterprise/MarketingShell";
import { usePublicSeo } from "../lib/public-seo";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

const origin = typeof window !== "undefined" ? window.location.origin : "https://site-secure.com";

function AboutPage() {
  usePublicSeo({
    title: "אודות — SITE SECURE",
    description: "SITE SECURE מבית Aegis Spectra — פלטפורמה לניהול חברות התקנה ואבטחה בישראל.",
    canonical: `${origin}/about`,
  });

  return (
    <MarketingShell>
      <section className="mkt-dark mkt-section">
        <div className="mkt-container max-w-3xl">
          <h1 className="mkt-h1">אודות SITE SECURE</h1>
          <p className="mkt-lede">
            SITE SECURE היא מוצר של Aegis Spectra. המטרה: לתת לחברות התקנה ואבטחה בישראל מערכת אחת —
            בעברית — שמחברת הצעות מחיר, שטח, מסירה ושירות.
          </p>
          <p className="mkt-lede">
            אנחנו משקיעים קודם ברצף העבודה האמיתי של מתקינים וטכנאים, ורק אחר כך בקישוטים. אין ביקורות
            מומצאות ואין מספרים מומצאים.
          </p>
          <Link to="/contact" className="mkt-btn mkt-btn-primary mt-8">
            צור קשר
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
