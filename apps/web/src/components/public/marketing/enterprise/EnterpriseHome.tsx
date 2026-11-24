import {
  Briefcase,
  CalendarDays,
  ClipboardList,
  FileSignature,
  FolderOpen,
  Map,
  Package,
  PenLine,
  ShieldCheck,
  Users,
  Wrench,
  BarChart3,
  Boxes,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType } from "react";
import {
  annualMonthlyIls,
  billingPublic,
  catalogPlansOrdered,
  formatIls,
} from "@site-secure/authz";
import { submitBetaSignup } from "../../../../lib/public-marketing-api";
import { trackMarketingEvent } from "../../../../lib/marketing-analytics";
import { siteSecureOrgJsonLd, usePublicSeo } from "../../../../lib/public-seo";
import { LandingCctvHeroCalc } from "../LandingCctvHeroCalc";
import { MarketingShell } from "./MarketingShell";
import {
  HOME_FAQ,
  MARKETING_MODULES,
  PROBLEMS,
  SOLUTIONS,
  WORKFLOW_STEPS,
  statusLabel,
} from "./marketing-content";

const origin = typeof window !== "undefined" ? window.location.origin : "https://site-secure.com";

const ICONS: Record<string, ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  crm: Users,
  customers: Briefcase,
  projects: ClipboardList,
  service: Wrench,
  quotes: PenLine,
  catalog: Package,
  inventory: Boxes,
  techs: Users,
  calendar: CalendarDays,
  maps: Map,
  docs: FolderOpen,
  sign: FileSignature,
  reports: BarChart3,
};

export function EnterpriseHome() {
  const [paintPending, setPaintPending] = useState(true);
  const [calcReady, setCalcReady] = useState(false);
  const [annual, setAnnual] = useState(false);
  const plans = catalogPlansOrdered();
  const billing = billingPublic();

  usePublicSeo({
    title: "SITE SECURE — כל העסק שלך. מערכת אחת. שליטה מלאה.",
    description:
      "פלטפורמה לניהול חברות אבטחה, התקנות ומתח נמוך: לקוחות, הצעות מחיר, פרויקטים, טכנאים ושירות — בעברית.",
    canonical: `${origin}/`,
    jsonLd: siteSecureOrgJsonLd(origin),
  });

  useEffect(() => {
    const paint = document.getElementById("ss-marketing-paint");
    let cancelled = false;
    let calcTimer = 0;
    const hidePaintNode = () => {
      if (cancelled) return;
      if (paint?.isConnected && !paint.hidden) {
        paint.hidden = true;
        paint.replaceChildren();
      }
    };
    const reveal = () => {
      if (cancelled) return;
      setPaintPending(false);
      setCalcReady(true);
    };
    const onInteract = () => {
      hidePaintNode();
      reveal();
    };
    const timer = window.setTimeout(() => {
      hidePaintNode();
      calcTimer = window.setTimeout(reveal, 6000);
    }, 3200);
    window.addEventListener("pointerdown", onInteract, { once: true, passive: true });
    window.addEventListener("keydown", onInteract, { once: true });
    if (!paint) reveal();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearTimeout(calcTimer);
      window.removeEventListener("pointerdown", onInteract);
      window.removeEventListener("keydown", onInteract);
    };
  }, []);

  return (
    <MarketingShell>
      {/* A — Hero */}
      <section className={`mkt-dark mkt-section${paintPending ? " is-paint-pending" : ""}`} id="hero">
        <div className="mkt-container grid items-center gap-10 lg:grid-cols-2">
          <div className={paintPending ? "opacity-0" : undefined}>
            <p className="mkt-kicker">SITE SECURE</p>
            <h1 className="mkt-h1">העסק שלך. כל מערכות הניהול. מקום אחד.</h1>
            <p className="mkt-lede">
              SITE SECURE היא פלטפורמה חכמה לניהול עסקים בתחום האבטחה, התקשורת ומערכות המתח הנמוך. ניהול
              לקוחות, הצעות מחיר, פרויקטים, התקנות, טכנאים וקריאות שירות – ממערכת אחת.
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
          <div className="mkt-device">
            <img
              src="/landing-v2/01-quote-builder-desktop.webp"
              alt="מסך בניית הצעת מחיר ב-SITE SECURE"
              width={1440}
              height={900}
              decoding="async"
              fetchPriority={paintPending ? "low" : "high"}
            />
          </div>
        </div>
      </section>

      {/* B — Problem */}
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

      {/* C — Modules */}
      <section className="mkt-section mkt-reveal bg-[var(--mkt-white)]" id="product-modules">
        <div className="mkt-container">
          <h2 className="mkt-h2">כל הפעילות העסקית שלך. מערכת אחת.</h2>
          <p className="mkt-lede">מודולים שקיימים במוצר — עם סימון ברור למה שעדיין חלקי או מתוכנן.</p>
          <div className="mkt-grid-3 mt-8">
            {MARKETING_MODULES.map((mod) => {
              const Icon = ICONS[mod.key] ?? ShieldCheck;
              return (
                <article key={mod.key} className="mkt-card">
                  <div className="mkt-module-icon">
                    <Icon className="size-5" aria-hidden />
                  </div>
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="m-0 text-base font-semibold">{mod.title}</h3>
                    <span className="mkt-badge">{statusLabel(mod.status)}</span>
                  </div>
                  <p className="m-0 text-sm leading-7 text-[var(--mkt-muted)]">{mod.body}</p>
                  {mod.href ? (
                    <a href={mod.href} className="mt-3 inline-flex text-sm font-semibold text-[var(--mkt-blue)]">
                      למידע נוסף ←
                    </a>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* D — How it works */}
      <section className="mkt-section mkt-reveal" id="how">
        <div className="mkt-container">
          <h2 className="mkt-h2">איך זה עובד</h2>
          <p className="mkt-lede">מרצף העבודה האמיתי: מליד ועד שירות.</p>
          <div className="mkt-flow mt-8">
            {WORKFLOW_STEPS.map((step) => (
              <div key={step.title} className="mkt-flow-item">
                <strong>{step.title}</strong>
                <span>{step.body}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* E — Platform preview */}
      <section className="mkt-dark mkt-section mkt-reveal" id="preview">
        <div className="mkt-container">
          <h2 className="mkt-h2">תצוגת מוצר</h2>
          <p className="mkt-lede">צילומי מסך אמיתיים מהמערכת — לא הדמיות מזויפות.</p>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <figure className="mkt-device m-0">
              <img
                src="/landing-v2/02b-quote-preview-desktop.webp"
                alt="תצוגת הצעה ללקוח"
                width={1440}
                height={900}
                loading="lazy"
                decoding="async"
              />
            </figure>
            <figure className="mkt-device m-0">
              <img
                src="/landing-v2/03-site-file-desktop.webp"
                alt="תיק אתר"
                width={1440}
                height={900}
                loading="lazy"
                decoding="async"
              />
            </figure>
            <figure className="mkt-device is-phone m-0 lg:col-span-2">
              <img
                src="/landing-v2/06-fieldjob-mobile.webp"
                alt="עבודת שטח במובייל"
                width={390}
                height={844}
                loading="lazy"
                decoding="async"
              />
            </figure>
          </div>
        </div>
      </section>

      {/* F — Solutions */}
      <section className="mkt-section mkt-reveal" id="solutions">
        <div className="mkt-container">
          <h2 className="mkt-h2">פתרונות לפי סוג עסק</h2>
          <div className="mkt-grid-4 mt-8">
            {SOLUTIONS.map((s) => (
              <article key={s.slug} className="mkt-card flex flex-col gap-3">
                <h3 className="m-0 text-lg font-semibold">{s.title}</h3>
                <p className="m-0 flex-1 text-sm leading-7 text-[var(--mkt-muted)]">{s.body}</p>
                <Link to={s.href} className="text-sm font-semibold text-[var(--mkt-blue)]">
                  לעמוד הפתרון ←
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* G — Tools */}
      <section className="mkt-section mkt-reveal bg-[var(--mkt-white)]" id="tools">
        <div className="mkt-container grid gap-8 lg:grid-cols-2 lg:items-start">
          <div>
            <h2 className="mkt-h2">כלי מקצועי חינם: מחשבון אחסון CCTV</h2>
            <p className="mkt-lede">
              חשבו נפח, דיסק מומלץ וערוצי NVR — ואז הפכו את החישוב להצעת מחיר מקצועית ב-SITE SECURE.
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

      {/* H — Pricing teaser */}
      <section className="mkt-section mkt-reveal" id="pricing">
        <div className="mkt-container">
          <h2 className="mkt-h2">תמחור שקוף</h2>
          <p className="mkt-lede">{billing.vat_note_he} בבטא אין סליקה אוטומטית — שדרוג בפנייה אלינו.</p>
          <div className="mt-4 inline-flex rounded-[12px] border border-[var(--mkt-border)] p-1">
            <button
              type="button"
              className={`mkt-btn ${!annual ? "mkt-btn-primary" : "mkt-btn-ghost"}`}
              onClick={() => setAnnual(false)}
            >
              חודשי
            </button>
            <button
              type="button"
              className={`mkt-btn ${annual ? "mkt-btn-primary" : "mkt-btn-ghost"}`}
              onClick={() => setAnnual(true)}
            >
              שנתי
            </button>
          </div>
          <div className="mkt-grid-4 mt-8">
            {plans.map((plan) => {
              const commercial = plan.commercial;
              const monthly = commercial?.monthly_ils_before_vat;
              const custom = Boolean(commercial?.custom_pricing) || monthly == null;
              const price = custom
                ? "בהתאמה"
                : formatIls(annual ? annualMonthlyIls(monthly!) : monthly!);
              return (
                <article key={plan.key} className="mkt-card flex flex-col gap-2">
                  <h3 className="m-0 text-lg font-semibold">{plan.label_he}</h3>
                  <p className="m-0 text-3xl font-bold text-[var(--mkt-ink)]">{price}</p>
                  <p className="m-0 text-xs text-[var(--mkt-muted)]">
                    {custom ? "דברו איתנו" : annual ? "ממוצע חודשי בשנתי" : "לחודש לפני מע״מ"}
                  </p>
                  <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0 text-sm">
                    {(commercial?.highlights_he ?? []).slice(0, 4).map((h) => (
                      <li key={h}>• {h}</li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
          <Link
            to="/pricing"
            className="mkt-btn mkt-btn-secondary mt-8"
            onClick={() => trackMarketingEvent("pricing_view", { from: "home" })}
          >
            למחירון המלא והשוואה
          </Link>
        </div>
      </section>

      {/* I — Trust */}
      <section className="mkt-dark mkt-section mkt-reveal" id="security">
        <div className="mkt-container">
          <h2 className="mkt-h2">אבטחה ואמון</h2>
          <p className="mkt-lede">רק מה שקיים במוצר היום.</p>
          <div className="mkt-grid-3 mt-8">
            {[
              { t: "בידוד סביבות עבודה", b: "כל חברה רואה רק את הנתונים שלה." },
              { t: "הרשאות לפי תפקיד", b: "בעלים, מנהל, מכירות וטכנאי — כל אחד לפי היקף." },
              { t: "אימות מאובטח", b: "התחברות דרך ספק הזהות של המערכת." },
              { t: "הגנת נתונים בתעבורה", b: "תקשורת מוצפנת בין הדפדפן לשרת." },
              { t: "קבצים מבוקרים", b: "אחסון קבצים עם הרשאות סביבת עבודה." },
              { t: "בקרת גישה", b: "בדיקת הרשאה וסביבת עבודה בכל פעולה רגישה." },
            ].map((row) => (
              <article key={row.t} className="mkt-card">
                <h3 className="m-0 text-base font-semibold">{row.t}</h3>
                <p className="mt-2 text-sm leading-7 text-[var(--mkt-on-dark-muted)]">{row.b}</p>
              </article>
            ))}
          </div>
          <Link to="/legal/$slug" params={{ slug: "security" }} className="mt-6 inline-flex text-sm font-semibold text-[var(--mkt-blue-bright)]">
            לעמוד אבטחת המידע ←
          </Link>
        </div>
      </section>

      {/* J — FAQ */}
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

      {/* K — Final CTA + beta / demo */}
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
