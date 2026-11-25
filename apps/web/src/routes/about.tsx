import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BrandBdi } from "../components/public/marketing/enterprise/BrandBdi";
import { MarketingShell } from "../components/public/marketing/enterprise/MarketingShell";
import { MARKETING_ROUTES } from "../components/public/marketing/enterprise/marketing-routes";
import { usePublicSeo } from "../lib/public-seo";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

const origin = typeof window !== "undefined" ? window.location.origin : "https://site-secure.com";

const SECTIONS: { id: string; title: ReactNode; navLabel: string; body: ReactNode }[] = [
  {
    id: "aegis",
    title: <BrandBdi name="Aegis Spectra" />,
    navLabel: "Aegis Spectra",
    body: (
      <>
        <BrandBdi name="Aegis Spectra" /> היא החברה מאחורי <BrandBdi name="SITE SECURE" />. אנחנו בונים תוכנה
        לעסקי התקנה ואבטחה בישראל — בלי להמציא היסטוריה, מספר עובדים או תעודות שלא אומתו.
      </>
    ),
  },
  {
    id: "product",
    title: (
      <>
        מה זה <BrandBdi name="SITE SECURE" />
      </>
    ),
    navLabel: "מה זה SITE SECURE",
    body: (
      <>
        <BrandBdi name="SITE SECURE" /> היא פלטפורמת ניהול עסקי לחברות אבטחה, תקשורת ומתח נמוך: לקוחות, הצעות,
        פרויקטים, טכנאים ושירות — ממערכת אחת בעברית.
      </>
    ),
  },
  {
    id: "vision",
    title: "חזון",
    navLabel: "חזון",
    body: "להחליף פיזור בין אקסל, וואטסאפ וניירת ברצף עבודה אחד שקוף למשרד ולשטח.",
  },
  {
    id: "philosophy",
    title: "פילוסופיית מוצר",
    navLabel: "פילוסופיית מוצר",
    body: "קודם רצף עבודה אמיתי, אחר כך קישוטים. סימון כנה למה שזמין, חלקי או מתוכנן. בלי ביקורות מומצאות ובלי מספרים מומצאים.",
  },
  {
    id: "problems",
    title: "הבעיות שאנחנו פותרים",
    navLabel: "הבעיות שאנחנו פותרים",
    body: "לידים שאבדו, הצעות בגרסאות סותרות, חוסר סנכרון משרד־שטח, והיעדר תיק אתר אחרי מסירה.",
  },
  {
    id: "tech",
    title: "גישה טכנולוגית",
    navLabel: "גישה טכנולוגית",
    body: "כל חברה רואה רק את הנתונים שלה, עם הרשאות לפי תפקיד וחיבור מוצפן.",
  },
  {
    id: "ecosystem",
    title: "אקוסיסטם עתידי",
    navLabel: "אקוסיסטם עתידי",
    body: "מרחיבים את המערכת לפי סדר עדיפויות של שטח אמיתי — הצעות, התקנות, שירות ותיעוד אתר.",
  },
];

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
          <h1 className="mkt-h1">
            אודות <BrandBdi name="SITE SECURE" />
          </h1>
          <p className="mkt-lede">
            מותג המוצר: <BrandBdi name="SITE SECURE" />. החברה: <BrandBdi name="Aegis Spectra" />. מיקוד: ניהול
            עסקי לענף האבטחה והמתח הנמוך.
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
                    {s.id === "aegis" ? (
                      <BrandBdi name="Aegis Spectra" />
                    ) : s.id === "product" ? (
                      <>
                        מה זה <BrandBdi name="SITE SECURE" />
                      </>
                    ) : (
                      s.navLabel
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="grid gap-4">
            {SECTIONS.map((s) => (
              <article key={s.id} id={s.id} className="mkt-card mkt-reveal">
                <h2 className="m-0 text-xl font-semibold">{s.title}</h2>
                <p className="mt-3 m-0 text-[17px] leading-7 text-[var(--mkt-ink-soft)]">{s.body}</p>
              </article>
            ))}
            <Link to={MARKETING_ROUTES.contact} className="mkt-btn mkt-btn-primary w-fit">
              צור קשר
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
