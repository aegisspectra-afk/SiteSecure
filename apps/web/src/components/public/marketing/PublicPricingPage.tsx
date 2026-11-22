import {
  annualMonthlyIls,
  billingPublic,
  catalogPlansOrdered,
  comparisonCell,
  formatIls,
  PRICING_CAPABILITY_ROWS,
} from "@site-secure/authz";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ssPricingFaq } from "../../../i18n/site-secure-marketing-he";
import { usePublicSeo } from "../../../lib/public-seo";
import { PublicHeader } from "../PublicChrome";

export function PublicPricingPage() {
  const billing = billingPublic();
  const plans = catalogPlansOrdered();
  const [annual, setAnnual] = useState(false);

  usePublicSeo({
    title: "מחירון SITE SECURE",
    description: "חבילות Free, Pro, Business ו-Enterprise — מחירים לפני מע״מ, מקור אמת אחד.",
    canonical: `${typeof window !== "undefined" ? window.location.origin : ""}/pricing`,
  });

  const rows = useMemo(() => PRICING_CAPABILITY_ROWS, []);

  return (
    <div className="public-root public-shell min-h-dvh text-fg" dir="rtl" lang="he">
      <PublicHeader marketingNav />
      <main className="public-container mx-auto max-w-6xl px-4 py-12">
        <h1 className="text-3xl font-semibold tracking-tight text-fg">מחירון</h1>
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
                  <a
                    href="/#beta"
                    className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius-control)] bg-action px-4 text-sm font-medium text-action-fg"
                  >
                    {commercial?.cta_he ?? "דברו איתנו"}
                  </a>
                ) : (
                  <Link
                    to="/register"
                    className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius-control)] bg-action px-4 text-sm font-medium text-action-fg"
                  >
                    {commercial?.cta_he ?? "הצטרפו לבטא"}
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

        <Link to="/" className="mt-10 inline-flex text-sm text-action hover:underline">
          חזרה לעמוד הבית
        </Link>
      </main>
    </div>
  );
}