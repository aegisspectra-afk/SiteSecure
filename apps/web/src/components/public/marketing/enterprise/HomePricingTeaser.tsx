import { Link } from "@tanstack/react-router";
import {
  billingPublic,
  catalogPlansOrdered,
  formatIls,
  planDisplayBaseIls,
  planRegularBaseIls,
  type CatalogPlan,
} from "../../../../lib/public-pricing";
import { trackMarketingEvent } from "../../../../lib/marketing-analytics";
import { MARKETING_ROUTES } from "./marketing-routes";

function priceLine(plan: CatalogPlan): { price: string; caption: string } {
  if (plan.commercial?.custom_pricing) {
    return { price: "בהתאמה", caption: "תמחור מותאם" };
  }
  const display = planDisplayBaseIls(plan);
  const regular = planRegularBaseIls(plan);
  if (display == null) return { price: "בהתאמה", caption: "תמחור מותאם" };
  const launch = billingPublic().pro_launch_active && regular != null && display < regular;
  return {
    price: formatIls(display),
    caption: launch
      ? `חוסכים ₪${regular! - display} בחודש · נעלו את מחיר ההשקה`
      : "לחודש לפני מע״מ",
  };
}

export function HomePricingTeaser() {
  const plans = catalogPlansOrdered();
  const vat = billingPublic().vat_note_he;

  return (
    <div className="mkt-home-pricing">
      <header className="mkt-ip-header">
        <h2 className="mkt-h2">תמחור שקוף</h2>
        <p className="mkt-lede">ארבעה מסלולים. מתחילים בחינם ומשדרגים כשצריך.</p>
        <p className="mt-2 m-0 text-sm text-[var(--mkt-muted)]">{vat}</p>
      </header>

      <div className="mkt-ip-cards" role="list">
        {plans.map((plan) => {
          const line = priceLine(plan);
          const featured = plan.key === "business";
          return (
            <article
              key={plan.key}
              role="listitem"
              className={`mkt-ip-card${featured ? " is-featured" : ""}`}
            >
              {featured ? <span className="mkt-ip-badge">מומלץ לצוותים</span> : null}
              {plan.key === "pro" && billingPublic().pro_launch_active ? (
                <span className="mkt-ip-badge mkt-ip-badge-launch">מחיר השקה</span>
              ) : null}
              <span className="mkt-ip-card-name">{plan.label_he}</span>
              <span className="mkt-ip-card-price">{line.price}</span>
              <span className="mkt-ip-card-period">{line.caption}</span>
              <span className="mkt-ip-card-audience">{plan.commercial?.audience_he}</span>
              <ul className="mkt-ip-card-highlights">
                {(plan.commercial?.highlights_he ?? []).slice(0, 3).map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
              <div className="mkt-ip-card-cta">
                {plan.key === "enterprise" ? (
                  <Link
                    to={MARKETING_ROUTES.contact}
                    search={{ topic: "enterprise" }}
                    className="mkt-btn mkt-btn-primary"
                    onClick={() =>
                      trackMarketingEvent("demo_start", { from: "home_pricing", plan: plan.key })
                    }
                  >
                    {plan.commercial?.cta_he ?? "דברו איתנו"}
                  </Link>
                ) : (
                  <Link
                    to={MARKETING_ROUTES.register}
                    search={{ plan: plan.key }}
                    className="mkt-btn mkt-btn-primary"
                    onClick={() =>
                      trackMarketingEvent("signup_start", { from: "home_pricing", plan: plan.key })
                    }
                  >
                    {plan.commercial?.cta_he ?? (plan.key === "free" ? "התחילו עכשיו" : "שדרגו")}
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <Link
        to={MARKETING_ROUTES.pricing}
        className="mkt-btn mkt-btn-secondary mt-8"
        onClick={() => trackMarketingEvent("pricing_view", { from: "home_pricing" })}
      >
        למחירון המלא
      </Link>
    </div>
  );
}
