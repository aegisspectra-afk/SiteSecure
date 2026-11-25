import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "../components/public/marketing/enterprise/MarketingShell";
import { MARKETING_ROUTES } from "../components/public/marketing/enterprise/marketing-routes";
import { usePublicSeo } from "../lib/public-seo";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

const origin = typeof window !== "undefined" ? window.location.origin : "https://site-secure.com";

const SECTIONS = [
  {
    id: "aegis",
    title: "Aegis Spectra",
    body: "Aegis Spectra היא החברה מאחורי SITE SECURE. אנחנו בונים תוכנה לעסקי התקנה ואבטחה בישראל — בלי להמציא היסטוריה, מספר עובדים או תעודות שלא אומתו.",
  },
  {
    id: "product",
    title: "מה זה SITE SECURE",
    body: "SITE SECURE היא פלטפורמת ניהול עסקי לחברות אבטחה, תקשורת ומתח נמוך: לקוחות, הצעות, פרויקטים, טכנאים ושירות — ממערכת אחת בעברית.",
  },
  {
    id: "vision",
    title: "חזון",
    body: "להחליף פיזור בין אקסל, וואטסאפ וניירת ברצף עבודה אחד שקוף למשרד ולשטח.",
  },
  {
    id: "philosophy",
    title: "פילוסופיית מוצר",
    body: "קודם רצף עבודה אמיתי, אחר כך קישוטים. סימון כנה למה שזמין, חלקי או מתוכנן. בלי ביקורות מומצאות ובלי מספרים מומצאים.",
  },
  {
    id: "problems",
    title: "הבעיות שאנחנו פותרים",
    body: "לידים שאבדו, הצעות בגרסאות סותרות, חוסר סנכרון משרד־שטח, והיעדר תיק אתר אחרי מסירה.",
  },
  {
    id: "tech",
    title: "גישה טכנולוגית",
    body: "כל חברה רואה רק את הנתונים שלה, עם הרשאות לפי תפקיד וחיבור מוצפן.",
  },
  {
    id: "ecosystem",
    title: "אקוסיסטם עתידי",
    body: "מרחיבים את המערכת לפי סדר עדיפויות של שטח אמיתי — הצעות, התקנות, שירות ותיעוד אתר.",
  },
] as const;

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
            מותג המוצר: SITE SECURE. החברה: Aegis Spectra. מיקוד: ניהול עסקי לענף האבטחה והמתח הנמוך.
          </p>
        </div>
      </section>

      <section className="mkt-section">
        <div className="mkt-container grid gap-4 lg:grid-cols-[14rem_1fr]">
          <nav className="mkt-card h-fit" aria-label="תוכן עניינים">
            <p className="m-0 mb-3 text-sm font-semibold">ניווט בעמוד</p>
            <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-[var(--mkt-blue)]">
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="grid gap-6">
            {SECTIONS.map((s) => (
              <article key={s.id} id={s.id} className="mkt-card scroll-mt-24">
                <h2 className="m-0 text-xl font-semibold">{s.title}</h2>
                <p className="mt-3 text-[17px] leading-7 text-[var(--mkt-ink-soft)]">{s.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mkt-dark mkt-section">
        <div className="mkt-container flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="mkt-h2">רוצים לדבר איתנו?</h2>
            <p className="mkt-lede">פנייה כללית, מכירות או Enterprise — בטופס אחד.</p>
          </div>
          <Link to={MARKETING_ROUTES.contact} className="mkt-btn mkt-btn-primary">
            צור קשר
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
