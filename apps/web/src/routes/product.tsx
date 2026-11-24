import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "../components/public/marketing/enterprise/MarketingShell";
import { MARKETING_MODULES, statusLabel } from "../components/public/marketing/enterprise/marketing-content";
import { usePublicSeo } from "../lib/public-seo";

export const Route = createFileRoute("/product")({
  component: ProductPage,
});

const origin = typeof window !== "undefined" ? window.location.origin : "https://site-secure.com";

function ProductPage() {
  usePublicSeo({
    title: "הפלטפורמה — SITE SECURE",
    description: "סקירת מודולי SITE SECURE לניהול חברות התקנה ואבטחה: לקוחות, הצעות, פרויקטים, שירות וטכנאים.",
    canonical: `${origin}/product`,
  });

  return (
    <MarketingShell>
      <section className="mkt-dark mkt-section">
        <div className="mkt-container">
          <p className="mkt-kicker">פלטפורמה</p>
          <h1 className="mkt-h1">כל העסק שלך. מערכת אחת.</h1>
          <p className="mkt-lede">
            SITE SECURE מחברת את המשרד לשטח: מליד והצעת מחיר, דרך התקנה ומסירה, ועד שירות שוטף.
          </p>
        </div>
      </section>
      <section className="mkt-section">
        <div className="mkt-container mkt-grid-3">
          {MARKETING_MODULES.map((mod) => (
            <article key={mod.key} id={mod.key} className="mkt-card scroll-mt-24">
              <div className="mb-2 flex items-center gap-2">
                <h2 className="m-0 text-lg font-semibold">{mod.title}</h2>
                <span className="mkt-badge">{statusLabel(mod.status)}</span>
              </div>
              <p className="m-0 text-sm leading-7 text-[var(--mkt-muted)]">{mod.body}</p>
            </article>
          ))}
        </div>
        <div className="mkt-container mt-10">
          <Link to="/register" className="mkt-btn mkt-btn-primary">
            התחילו בחינם
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
