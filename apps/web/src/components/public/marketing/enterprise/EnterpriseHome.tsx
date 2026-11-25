import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { submitBetaSignup } from "../../../../lib/public-marketing-api";
import { trackMarketingEvent } from "../../../../lib/marketing-analytics";
import { siteSecureOrgJsonLd, usePublicSeo } from "../../../../lib/public-seo";
import { LandingCctvHeroCalc } from "../LandingCctvHeroCalc";
import { DemoDashboard } from "./DemoDashboard";
import { HomeHowItWorks } from "./HomeHowItWorks";
import { HomePricingTeaser } from "./HomePricingTeaser";
import { HomeSecurity } from "./HomeSecurity";
import { MarketingShell } from "./MarketingShell";
import { PlatformExplorer } from "./PlatformExplorer";
import { SolutionsExplorer } from "./SolutionsExplorer";
import { BrandBdi } from "./BrandBdi";
import { HOME_FAQ, PROBLEMS } from "./marketing-content";

const origin = typeof window !== "undefined" ? window.location.origin : "https://site-secure.com";

export function EnterpriseHome() {
  const [calcReady, setCalcReady] = useState(false);

  usePublicSeo({
    title: "SITE SECURE — מהסיור באתר ועד תעודת המסירה",
    description:
      "הצעת מחיר מקצועית ללקוח תוך 10 דקות מהסיור, עם חלופות, תמונות ואישור בוואטסאפ. מערכת בעברית לחברות התקנה ותחזוקה.",
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
      <section className="mkt-dark mkt-section" id="hero">
        <div className="mkt-container grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="mkt-kicker">
              <BrandBdi name="SITE SECURE" />
            </p>
            <h1 className="mkt-h1">
              מהסיור באתר ועד תעודת המסירה,
              <br />
              הכל במקום אחד ובעברית.
            </h1>
            <p className="mkt-lede">
              הצעת מחיר מקצועית ללקוח תוך 10 דקות מהסיור, עם חלופות, תמונות ואישור בוואטסאפ.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/register"
                className="mkt-btn mkt-btn-primary"
                onClick={() => trackMarketingEvent("cta_click", { cta: "hero_start_free" })}
              >
                התחילו עכשיו
              </Link>
              <a
                href="#how"
                className="mkt-btn mkt-btn-secondary"
                onClick={() => trackMarketingEvent("cta_click", { cta: "hero_how" })}
              >
                איך זה עובד
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

      <section className="mkt-section mkt-reveal bg-[var(--mkt-white)]" id="how">
        <div className="mkt-container">
          <h2 className="mkt-h2">איך זה עובד</h2>
          <p className="mkt-lede">רצף אחד: מסיור באתר ועד שירות שוטף.</p>
          <div className="mt-8">
            <HomeHowItWorks />
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-reveal" id="product-modules">
        <div className="mkt-container">
          <h2 className="mkt-h2">סיור מוצר</h2>
          <p className="mkt-lede">המודולים שפעילים היום — בחרו וגלו מה כלול.</p>
          <div className="mt-8">
            <PlatformExplorer liveOnly />
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-reveal bg-[var(--mkt-white)]" id="tools">
        <div className="mkt-container grid gap-8 lg:grid-cols-2 lg:items-start">
          <div>
            <h2 className="mkt-h2">מחשבון אחסון CCTV</h2>
            <p className="mkt-lede">חשבו אחסון, NVR ו-PoE — ואז עברו להצעת מחיר אחרי הרשמה.</p>
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

      <section className="mkt-section mkt-reveal" id="solutions">
        <div className="mkt-container">
          <h2 className="mkt-h2">פתרונות לפי סוג עסק</h2>
          <p className="mkt-lede">בחרו סוג עסק — התוכן וההמלצה מתעדכנים מיד.</p>
          <div className="mt-8">
            <SolutionsExplorer />
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-reveal bg-[var(--mkt-white)]" id="pricing">
        <div className="mkt-container">
          <HomePricingTeaser />
        </div>
      </section>

      <section className="mkt-dark mkt-section mkt-reveal" id="security">
        <div className="mkt-container">
          <h2 className="mkt-h2">אבטחה ואמון</h2>
          <p className="mkt-lede">מה שחשוב לדעת על שמירת הנתונים שלכם.</p>
          <div className="mt-8">
            <HomeSecurity />
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-reveal bg-[var(--mkt-white)]" id="faq">
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
            <h2 className="mkt-h2">מוכנים לראות את זה אצלכם?</h2>
            <p className="mkt-lede">התחילו עכשיו או השאירו פרטים לתיאום הדגמה קצרה.</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/register"
                className="mkt-btn mkt-btn-primary"
                onClick={() => trackMarketingEvent("signup_start", { from: "final_cta" })}
              >
                התחילו עכשיו
              </Link>
              <Link
                to="/contact"
                search={{ topic: "demo" }}
                className="mkt-btn mkt-btn-secondary"
                onClick={() => trackMarketingEvent("demo_start", { from: "final_cta" })}
              >
                תיאום הדגמה
              </Link>
            </div>
          </div>
          <DemoRequestForm />
        </div>
      </section>
    </MarketingShell>
  );
}

function DemoRequestForm() {
  const [form, setForm] = useState({ full_name: "", phone: "", technician_count: "" });
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (done) {
    return (
      <p className="mkt-card text-base font-medium" role="status">
        תודה — נחזור אליכם לתיאום הדגמה.
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
        void submitBetaSignup({ ...form, source: "landing_demo" })
          .then(() => {
            setDone(true);
            trackMarketingEvent("demo_start", { source: "home_form" });
          })
          .catch((e: Error) => setErr(e.message))
          .finally(() => setBusy(false));
      }}
    >
      <h3 className="m-0 text-lg font-semibold text-[var(--mkt-ink)]">תיאום הדגמה</h3>
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
