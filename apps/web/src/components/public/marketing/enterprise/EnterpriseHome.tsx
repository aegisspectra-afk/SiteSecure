import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { submitBetaSignup } from "../../../../lib/public-marketing-api";
import { trackMarketingEvent } from "../../../../lib/marketing-analytics";
import { siteSecureOrgJsonLd, usePublicSeo } from "../../../../lib/public-seo";
import { LandingCctvHeroCalc } from "../LandingCctvHeroCalc";
import { ActivityFeed } from "./ActivityFeed";
import { DemoDashboard } from "./DemoDashboard";
import { InteractivePricingExperience } from "./InteractivePricingExperience";
import { InteractiveWorkflow } from "./InteractiveWorkflow";
import { LiveAppPreview } from "./LiveAppPreview";
import { MarketingShell } from "./MarketingShell";
import { OnboardingPreview } from "./OnboardingPreview";
import { PlatformExplorer } from "./PlatformExplorer";
import { ProductTour } from "./ProductTour";
import { SecurityArchitecture } from "./SecurityArchitecture";
import { SolutionsExplorer } from "./SolutionsExplorer";
import { HOME_FAQ, PROBLEMS } from "./marketing-content";

const origin = typeof window !== "undefined" ? window.location.origin : "https://site-secure.com";

export function EnterpriseHome() {
  const [calcReady, setCalcReady] = useState(false);

  usePublicSeo({
    title: "SITE SECURE — כל העסק שלך. מערכת אחת. שליטה מלאה.",
    description:
      "פלטפורמה לניהול חברות אבטחה, התקנות ומתח נמוך: לקוחות, הצעות מחיר, פרויקטים, טכנאים ושירות — בעברית.",
    canonical: `${origin}/`,
    jsonLd: siteSecureOrgJsonLd(origin),
  });

  useEffect(() => {
    const paint = document.getElementById("ss-marketing-paint");
    if (paint?.isConnected && !paint.hidden) {
      paint.hidden = true;
      paint.replaceChildren();
    }
    const t = window.setTimeout(() => setCalcReady(true), 200);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <MarketingShell>
      {/* Hero — interactive dashboard, no photography */}
      <section className="mkt-dark mkt-section" id="hero">
        <div className="mkt-container grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="mkt-kicker">SITE SECURE</p>
            <h1 className="mkt-h1">העסק שלך. כל מערכות הניהול. מקום אחד.</h1>
            <p className="mkt-lede">
              פלטפורמה חכמה לניהול עסקים בתחום האבטחה, התקשורת ומערכות המתח הנמוך.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/register"
                className="mkt-btn mkt-btn-primary"
                onClick={() => trackMarketingEvent("cta_click", { cta: "hero_start_free" })}
              >
                התחילו בחינם
              </Link>
              <a
                href="#product-modules"
                className="mkt-btn mkt-btn-secondary"
                onClick={() => trackMarketingEvent("cta_click", { cta: "hero_discover" })}
              >
                גלו את הפלטפורמה
              </a>
            </div>
          </div>
          <DemoDashboard />
        </div>
      </section>

      <section className="mkt-section mkt-reveal" id="problem">
        <div className="mkt-container">
          <h2 className="mkt-h2">עדיין מנהלים את העסק בין אקסלים, וואטסאפ וניירת?</h2>
          <div className="mkt-grid-3 mt-8">
            {PROBLEMS.map((line) => (
              <article key={line} className="mkt-card">
                <p className="m-0 text-[0.95rem] leading-7 text-[var(--mkt-ink)]">{line}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive platform explorer + guided tour */}
      <section className="mkt-section mkt-reveal bg-[var(--mkt-white)]" id="product-modules">
        <div className="mkt-container">
          <h2 className="mkt-h2">כל הפעילות העסקית שלך. מערכת אחת.</h2>
          <p className="mkt-lede">בחרו מודול או עברו סיור מודרך — בלי צילומי מסך סטטיים.</p>
          <div className="mt-8">
            <PlatformExplorer />
          </div>
          <div className="mt-10">
            <ProductTour />
          </div>
        </div>
      </section>

      {/* Interactive workflow */}
      <section className="mkt-section mkt-reveal" id="how">
        <div className="mkt-container">
          <h2 className="mkt-h2">איך זה עובד</h2>
          <p className="mkt-lede">לחצו על שלב ברצף — מליד ועד שירות שוטף.</p>
          <div className="mt-8">
            <InteractiveWorkflow />
          </div>
        </div>
      </section>

      {/* Live app preview — replaces screenshot gallery */}
      <section className="mkt-dark mkt-section mkt-reveal" id="preview">
        <div className="mkt-container">
          <h2 className="mkt-h2">תצוגת מוצר חיה</h2>
          <p className="mkt-lede">
            סביבת הדגמה מבודדת עם נתונים סינתטיים בלבד — לא מחוברת לרשומות לקוחות אמיתיות.
          </p>
          <div className="mt-8">
            <LiveAppPreview />
          </div>
          <div className="mt-10">
            <ActivityFeed />
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-reveal" id="solutions">
        <div className="mkt-container">
          <h2 className="mkt-h2">פתרונות לפי סוג עסק</h2>
          <p className="mkt-lede">בחרו סוג עסק — התוכן, המודולים וה־CTA מתעדכנים מיד.</p>
          <div className="mt-8">
            <SolutionsExplorer />
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-reveal bg-[var(--mkt-white)]" id="tools">
        <div className="mkt-container grid gap-8 lg:grid-cols-2 lg:items-start">
          <div>
            <h2 className="mkt-h2">כלי מקצועי חינם: מחשבון אחסון CCTV</h2>
            <p className="mkt-lede">
              סליידרים וחישוב חי במנוע המשותף — ואז מעבר להצעת מחיר אחרי הרשמה.
            </p>
            <Link
              to="/tools/cctv-storage"
              className="mkt-btn mkt-btn-primary mt-6"
              onClick={() => trackMarketingEvent("cta_click", { cta: "tools_full_page" })}
            >
              למחשבון המלא
            </Link>
          </div>
          <div className="rounded-[var(--mkt-radius-lg)] border border-[var(--mkt-border)] bg-[var(--mkt-bg)] p-2">
            {calcReady ? <LandingCctvHeroCalc /> : <div className="min-h-[18rem]" aria-hidden />}
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-reveal" id="pricing">
        <div className="mkt-container">
          <InteractivePricingExperience compact />
        </div>
      </section>

      <section className="mkt-dark mkt-section mkt-reveal" id="security">
        <div className="mkt-container">
          <h2 className="mkt-h2">אבטחה ואמון</h2>
          <p className="mkt-lede">רק בקרות מאומתות — בלי תעודות שלא אומתו.</p>
          <div className="mt-8">
            <SecurityArchitecture />
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-reveal bg-[var(--mkt-white)]" id="onboarding">
        <div className="mkt-container">
          <h2 className="mkt-h2">איך נראית ההצטרפות</h2>
          <p className="mkt-lede">תצוגה אינטראקטיבית של השלבים — כל CTA מוביל לנתיב אמיתי.</p>
          <div className="mt-8">
            <OnboardingPreview />
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-reveal" id="faq">
        <div className="mkt-container">
          <h2 className="mkt-h2">שאלות נפוצות</h2>
          <div className="mkt-faq mt-8 max-w-3xl">
            {HOME_FAQ.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="mkt-dark mkt-section mkt-reveal" id="cta">
        <div className="mkt-container grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="mkt-h2">הגיע הזמן לנהל את העסק בצורה חכמה יותר.</h2>
            <p className="mkt-lede">הצטרפו ל-SITE SECURE והתחילו לנהל את כל הפעילות העסקית במקום אחד.</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/register"
                className="mkt-btn mkt-btn-primary"
                onClick={() => trackMarketingEvent("signup_start", { from: "final_cta" })}
              >
                התחילו בחינם
              </Link>
              <Link
                to="/contact"
                className="mkt-btn mkt-btn-secondary"
                onClick={() => trackMarketingEvent("demo_start", { from: "final_cta" })}
              >
                תיאום הדגמה
              </Link>
            </div>
          </div>
          <BetaLiteForm />
        </div>
      </section>
    </MarketingShell>
  );
}

function BetaLiteForm() {
  const [form, setForm] = useState({ full_name: "", phone: "", technician_count: "" });
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (done) {
    return (
      <p className="mkt-card text-base font-medium" role="status">
        תודה, נחזור אליך תוך יום עסקים.
      </p>
    );
  }

  return (
    <form
      className="mkt-form mkt-card"
      onSubmit={(ev) => {
        ev.preventDefault();
        setBusy(true);
        setErr(null);
        void submitBetaSignup({ ...form, source: "landing" })
          .then(() => {
            setDone(true);
            trackMarketingEvent("beta_submit", { source: "landing" });
          })
          .catch((e: Error) => setErr(e.message))
          .finally(() => setBusy(false));
      }}
    >
      <h3 className="m-0 text-lg font-semibold text-[var(--mkt-ink)]">הצטרפות לבטא</h3>
      <label>
        שם מלא
        <input
          required
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
        />
      </label>
      <label>
        טלפון
        <input
          required
          dir="ltr"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
      </label>
      <label>
        כמה טכנאים?
        <input
          required
          value={form.technician_count}
          onChange={(e) => setForm({ ...form, technician_count: e.target.value })}
        />
      </label>
      {err ? <p className="m-0 text-sm text-red-600">{err}</p> : null}
      <button type="submit" className="mkt-btn mkt-btn-primary" disabled={busy}>
        שליחה
      </button>
    </form>
  );
}
