import {
  annualMonthlyIls,
  billingPublic,
  catalogPlansOrdered,
  comparisonCell,
  formatIls,
  PRICING_CAPABILITY_ROWS,
} from "@site-secure/authz";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ssPricingFaq } from "../../../i18n/site-secure-marketing-he";
import { trackMarketingEvent } from "../../../lib/marketing-analytics";
import { siteSecurePricingJsonLd, usePublicSeo } from "../../../lib/public-seo";
import { MarketingShell } from "./enterprise/MarketingShell";

const pricingSeoTitle = "מחירון SITE SECURE";
const pricingSeoDescription = "חבילות Free, Pro, Business ו-Enterprise — מחירים לפני מע״מ, מקור אמת אחד.";
const pricingOrigin =
  typeof window !== "undefined" ? window.location.origin : "https://site-secure.com";

export function PublicPricingPage() {
  const billing = billingPublic();
  const plans = catalogPlansOrdered();
  const [annual, setAnnual] = useState(false);

  usePublicSeo({
    title: pricingSeoTitle,
    description: pricingSeoDescription,
    canonical: `${pricingOrigin}/pricing`,
    jsonLd: siteSecurePricingJsonLd(pricingOrigin, pricingSeoTitle, pricingSeoDescription),
  });

  useEffect(() => {
    trackMarketingEvent("pricing_view");
  }, []);

  const rows = useMemo(() => PRICING_CAPABILITY_ROWS, []);

  return (
    <MarketingShell darkNav={false}>
      <div className="mkt-container px-0 py-12">
        <h1 className="mkt-h1 text-[var(--mkt-ink)]">מחירון</h1>
        <p className="mt-2 text-sm text-fg-muted">{billing.vat_note_he}</p>

        <div className="mt-6 inline-flex rounded-[var(--radius-control)] border border-border p-1">
          <button
            type="button"
            className={`min-h-11 rounded-[var(--radius-control)] px-4 text-sm ${!annual ? "bg-action text-action-fg" : "text-fg-muted"}`}
            onClick={() => setAnnual(false)}
          >
            חודשי
          </button>
          <button
            type="button"
            className={`min-h-11 rounded-[var(--radius-control)] px-4 text-sm ${annual ? "bg-action text-action-fg" : "text-fg-muted"}`}
            onClick={() => setAnnual(true)}
          >
            שנתי ({billing.annual_bonus_months} חודשים מתנה)
          </button>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => {
            const commercial = plan.commercial;
            const monthly = commercial?.monthly_ils_before_vat;
            const display =
              commercial?.custom_pricing || monthly == null
                ? "בהתאמה"
                : annual
                  ? formatIls(annualMonthlyIls(monthly))
                  : formatIls(monthly);
            return (
              <article key={plan.key} className="ops-card flex flex-col gap-3 p-5">
                <h2 className="text-lg font-semibold text-fg">{plan.label_he}</h2>
                <p className="text-3xl font-semibold text-fg">{display}</p>
                <p className="text-xs text-fg-muted">{annual ? "מחיר חודשי ממוצע בשנתי" : "לחודש לפני מע״מ"}</p>
                <p className="text-sm text-fg-muted">{commercial?.audience_he}</p>
                <ul className="flex flex-1 flex-col gap-2 text-sm text-fg">
                  {(commercial?.highlights_he ?? []).map((h) => (
                    <li key={h}>• {h}</li>
                  ))}
                </ul>
                {plan.key === "enterprise" ? (
                  <Link
                    to="/contact"
                    className="mkt-btn mkt-btn-primary"
                    onClick={() => trackMarketingEvent("demo_start", { from: "pricing_enterprise" })}
                  >
                    {commercial?.cta_he ?? "דברו איתנו"}
                  </Link>
                ) : (
                  <Link
                    to="/register"
                    className="mkt-btn mkt-btn-primary"
                    onClick={() => trackMarketingEvent("signup_start", { from: `pricing_${plan.key}` })}
                  >
                    {commercial?.cta_he ?? "התחילו בחינם"}
                  </Link>
                )}
              </article>
            );
          })}
        </div>

        <h2 className="mt-14 text-xl font-semibold text-fg">השוואה מלאה</h2>
        <div className="mt-4 overflow-x-auto rounded-[var(--radius-control)] border border-border">
          <table className="min-w-[720px] w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-public-elevated">
                <th className="p-3 text-start font-medium text-fg-muted">יכולת</th>
                {plans.map((p) => (
                  <th key={p.key} className="p-3 text-start font-medium text-fg">
                    {p.label_he}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-border/60">
                  <td className="p-3 text-fg-muted">{row.label_he}</td>
                  {plans.map((plan) => (
                    <td key={`${plan.key}-${row.key}`} className="p-3 text-fg">
                      {comparisonCell(plan, row.key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-12 text-xl font-semibold text-fg">שאלות על תמחור</h2>
        <div className="mt-4 flex flex-col gap-3">
          {ssPricingFaq.map((item) => (
            <details key={item.q} className="ops-card px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium">{item.q}</summary>
              <p className="mt-2 text-sm text-fg-muted">{item.a}</p>
            </details>
          ))}
        </div>

        <Link to="/" className="mt-10 inline-flex text-sm font-semibold text-[var(--mkt-blue)]">
          חזרה לעמוד הבית
        </Link>
      </div>
    </MarketingShell>
  );
}