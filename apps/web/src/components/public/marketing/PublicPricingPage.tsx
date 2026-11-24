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
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);

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
        <p className="mt-2 text-[17px] text-[var(--mkt-ink-soft)]">{billing.vat_note_he}</p>

        <div className="mt-6 inline-flex rounded-[12px] border border-[var(--mkt-border)] p-1" role="group">
          <button
            type="button"
            className={`mkt-btn ${!annual ? "mkt-btn-primary" : "mkt-btn-ghost"}`}
            aria-pressed={!annual}
            onClick={() => setAnnual(false)}
          >
            חודשי
          </button>
          <button
            type="button"
            className={`mkt-btn ${annual ? "mkt-btn-primary" : "mkt-btn-ghost"}`}
            aria-pressed={annual}
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
            const selected = selectedPlan === plan.key;
            const expanded = expandedPlan === plan.key;
            return (
              <article
                key={plan.key}
                className={`mkt-card mkt-plan-card${selected ? " is-selected" : ""}`}
              >
                <button
                  type="button"
                  className="m-0 cursor-pointer border-0 bg-transparent p-0 text-start text-lg font-semibold text-[var(--mkt-ink)]"
                  onClick={() => setSelectedPlan(plan.key)}
                  aria-pressed={selected}
                >
                  {plan.label_he}
                </button>
                <p className="m-0 text-3xl font-semibold text-[var(--mkt-ink)]">{display}</p>
                <p className="m-0 text-xs text-[var(--mkt-muted)]">
                  {annual ? "מחיר חודשי ממוצע בשנתי" : "לחודש לפני מע״מ"}
                </p>
                <p className="m-0 text-sm text-[var(--mkt-ink-soft)]">{commercial?.audience_he}</p>
                <p className="m-0 text-xs text-[var(--mkt-muted)]">
                  אחסון: {comparisonCell(plan, "storage_gb")} · משתמשים: {comparisonCell(plan, "max_members")}
                </p>
                <ul className="m-0 flex flex-1 flex-col gap-2 p-0 text-sm text-[var(--mkt-ink)]">
                  {(commercial?.highlights_he ?? []).slice(0, expanded ? 99 : 4).map((h) => (
                    <li key={h}>• {h}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="mkt-plan-expand"
                  aria-expanded={expanded}
                  onClick={() => setExpandedPlan(expanded ? null : plan.key)}
                >
                  {expanded ? "הסתר פרטים" : "הרחב פרטי מסלול"}
                </button>
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

        <h2 className="mt-14 text-xl font-semibold text-[var(--mkt-ink)]">השוואה מלאה</h2>
        <div className="mt-4 overflow-x-auto rounded-[12px] border border-[var(--mkt-border)]">
          <table className="min-w-[720px] w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--mkt-border)] bg-[var(--mkt-light)]">
                <th className="p-3 text-start font-medium text-[var(--mkt-muted)]">יכולת</th>
                {plans.map((p) => (
                  <th key={p.key} className="p-3 text-start font-medium text-[var(--mkt-ink)]">
                    {p.label_he}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-[var(--mkt-border)]">
                  <td className="p-3 text-[var(--mkt-muted)]">{row.label_he}</td>
                  {plans.map((plan) => (
                    <td key={`${plan.key}-${row.key}`} className="p-3 text-[var(--mkt-ink)]">
                      {comparisonCell(plan, row.key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-12 text-xl font-semibold text-[var(--mkt-ink)]">שאלות על תמחור</h2>
        <div className="mkt-faq mt-4">
          {ssPricingFaq.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
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
