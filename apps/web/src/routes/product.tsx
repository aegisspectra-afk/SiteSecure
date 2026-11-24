import { createFileRoute, Link } from "@tanstack/react-router";
import { DemoDashboard } from "../components/public/marketing/enterprise/DemoDashboard";
import { InteractiveWorkflow } from "../components/public/marketing/enterprise/InteractiveWorkflow";
import { MarketingShell } from "../components/public/marketing/enterprise/MarketingShell";
import { OnboardingPreview } from "../components/public/marketing/enterprise/OnboardingPreview";
import { PlatformExplorer } from "../components/public/marketing/enterprise/PlatformExplorer";
import { ProductTour } from "../components/public/marketing/enterprise/ProductTour";
import { SecurityArchitecture } from "../components/public/marketing/enterprise/SecurityArchitecture";
import { MARKETING_ROUTES } from "../components/public/marketing/enterprise/marketing-routes";
import { trackMarketingEvent } from "../lib/marketing-analytics";
import { usePublicSeo } from "../lib/public-seo";

export const Route = createFileRoute("/product")({
  component: ProductPage,
});

const origin = typeof window !== "undefined" ? window.location.origin : "https://site-secure.com";

function ProductPage() {
  usePublicSeo({
    title: "סקירת מוצר — SITE SECURE",
    description:
      "סקירת מודולי SITE SECURE: לידים, לקוחות, הצעות, פרויקטים, שירות, טכנאים ודוחות — עם סימון זמינות כנה.",
    canonical: `${origin}/product`,
  });

  return (
    <MarketingShell>
      <section className="mkt-dark mkt-section">
        <div className="mkt-container grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="mkt-kicker">פלטפורמה</p>
            <h1 className="mkt-h1">כל העסק שלך. מערכת אחת.</h1>
            <p className="mkt-lede">
              SITE SECURE מחברת משרד ושטח: מליד והצעת מחיר, דרך התקנה ומסירה, ועד שירות שוטף — בעברית ו־RTL.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to={MARKETING_ROUTES.register}
                className="mkt-btn mkt-btn-primary"
                onClick={() => trackMarketingEvent("signup_start", { from: "product" })}
              >
                התחילו בחינם
              </Link>
              <a href="#modules" className="mkt-btn mkt-btn-secondary">
                לסייר במודולים
              </a>
            </div>
          </div>
          <DemoDashboard />
        </div>
      </section>

      <section className="mkt-section" id="modules">
        <div className="mkt-container">
          <h2 className="mkt-h2">סייר מודולים אינטראקטיבי</h2>
          <p className="mkt-lede">
            בחרו מודול — התצוגה מתעדכנת מיד. סטטוס זמינות: פעיל / חלקי / בקרוב. לא מציגים מודול מתוכנן כזמין.
          </p>
          <div className="mt-8">
            <PlatformExplorer />
          </div>
          <div className="mt-10">
            <ProductTour />
          </div>
        </div>
      </section>

      <section className="mkt-section bg-[var(--mkt-white)]" id="workflow">
        <div className="mkt-container">
          <h2 className="mkt-h2">רצף עבודה מקצה לקצה</h2>
          <p className="mkt-lede">ליד → לקוח → סיור → הצעה → אישור → פרויקט → התקנה → מסירה → שירות.</p>
          <div className="mt-8">
            <InteractiveWorkflow />
          </div>
        </div>
      </section>

      <section className="mkt-dark mkt-section" id="mobile">
        <div className="mkt-container max-w-3xl">
          <h2 className="mkt-h2">עבודה מהשטח</h2>
          <p className="mkt-lede">
            במסלולים שכוללים שטח, טכנאים עובדים מהדפדפן בנייד: צ׳קליסט, תיעוד וחתימה. אפליקציה ייעודית בדרך —
            בלי להציג אותה כמוצר זמין היום.
          </p>
          <Link to={MARKETING_ROUTES.solutionsTechnicians} className="mkt-btn mkt-btn-secondary mt-6">
            לפתרון טכנאים
          </Link>
        </div>
      </section>

      <section className="mkt-section" id="security">
        <div className="mkt-container">
          <SecurityArchitecture />
        </div>
      </section>

      <section className="mkt-section bg-[var(--mkt-white)]" id="onboarding">
        <div className="mkt-container">
          <h2 className="mkt-h2">תצוגת הצטרפות</h2>
          <div className="mt-8">
            <OnboardingPreview />
          </div>
        </div>
      </section>

      <section className="mkt-section" id="cta">
        <div className="mkt-container flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="mkt-h2">מוכנים לנהל את העסק במקום אחד?</h2>
            <p className="mkt-lede">הרשמה למסלול Free או תיאום שיחה ל-Business/Enterprise.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to={MARKETING_ROUTES.register} className="mkt-btn mkt-btn-primary">
              הרשמה
            </Link>
            <Link to={MARKETING_ROUTES.contact} className="mkt-btn mkt-btn-secondary">
              צור קשר
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
