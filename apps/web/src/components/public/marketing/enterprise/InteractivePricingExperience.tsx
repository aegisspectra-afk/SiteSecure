import {
  billingPublic,
  catalogPlansOrdered,
  comparisonCell,
  extraSeatUnitPrice,
  extraSeatsTotalIls,
  formatIls,
  monthlyTotalIls,
  planAllowsExtraSeats,
  planDisplayBaseIls,
  planRegularBaseIls,
  type CatalogPlan,
} from "@site-secure/authz/public-pricing";
import { Link } from "@tanstack/react-router";
import { useId, useMemo, useState } from "react";
import { ssPricingFaq } from "../../../../i18n/site-secure-marketing-he";
import { trackMarketingEvent } from "../../../../lib/marketing-analytics";
import { MARKETING_ROUTES } from "./marketing-routes";

type BizType = "technician" | "installation" | "security" | "enterprise";
type NeedKey = "alternatives" | "technicians" | "scheduling" | "checklists" | "custom_integrations";

const NEED_OPTIONS: { key: NeedKey; label: string }[] = [
  { key: "alternatives", label: "חלופות הצעה לוועד בית" },
  { key: "technicians", label: "ניהול טכנאים בשטח" },
  { key: "scheduling", label: "שיבוץ עבודות" },
  { key: "checklists", label: "צ׳קליסט וחתימה" },
  { key: "custom_integrations", label: "אינטגרציות מותאמות" },
];

const BIZ_OPTIONS: { key: BizType; label: string }[] = [
  { key: "technician", label: "טכנאי עצמאי" },
  { key: "installation", label: "חברת התקנות" },
  { key: "security", label: "חברת אבטחה" },
  { key: "enterprise", label: "ארגון גדול" },
];

type CompareRow = {
  key: string;
  label: string;
  value: (plan: CatalogPlan) => string;
};

function monthlyPrice(plan: CatalogPlan): string {
  const display = planDisplayBaseIls(plan);
  if (display == null) return "בהתאמה";
  return formatIls(display);
}

function monthlyPriceCaption(plan: CatalogPlan): string {
  if (plan.commercial?.custom_pricing) return "תמחור בהתאמה";
  const display = planDisplayBaseIls(plan);
  const regular = planRegularBaseIls(plan);
  if (
    display != null &&
    regular != null &&
    display < regular &&
    billingPublic().pro_launch_active
  ) {
    return `מחיר השקה · רגיל ${formatIls(regular)} / חודש לפני מע״מ`;
  }
  return "לחודש לפני מע״מ";
}

function hasFeature(plan: CatalogPlan, feature: string): boolean {
  return (plan.features ?? []).includes(feature);
}

function hasCap(plan: CatalogPlan, cap: string): boolean {
  return Boolean(plan.capabilities?.[cap]);
}

function planMeetsNeeds(plan: CatalogPlan, needs: NeedKey[]): boolean {
  for (const n of needs) {
    if (n === "alternatives" && !hasCap(plan, "quotes.alternatives")) return false;
    if (n === "technicians" && !hasCap(plan, "field.technicians")) return false;
    if (n === "scheduling" && !hasCap(plan, "field.dispatch")) return false;
    if (n === "checklists" && !hasCap(plan, "jobs.checklist")) return false;
    if (n === "custom_integrations" && plan.key !== "enterprise") return false;
  }
  return true;
}

function planCoversUsers(plan: CatalogPlan, users: number): boolean {
  const max = plan.limits?.max_members ?? 0;
  if (max <= 0) return true; // unlimited
  if (users <= max) return true;
  return planAllowsExtraSeats(plan);
}

function recommendPlan(
  plans: CatalogPlan[],
  users: number,
  biz: BizType,
  needs: NeedKey[],
): { plan: CatalogPlan; reasons: string[]; enterpriseContact: boolean } {
  const ordered = ["free", "pro", "business", "enterprise"]
    .map((k) => plans.find((p) => p.key === k))
    .filter((p): p is CatalogPlan => Boolean(p));

  if (biz === "enterprise" || needs.includes("custom_integrations")) {
    const ent = ordered.find((p) => p.key === "enterprise")!;
    return {
      plan: ent,
      enterpriseContact: true,
      reasons: [
        biz === "enterprise" ? "סוג העסק שנבחר הוא ארגון גדול." : "נדרשות אינטגרציות מותאמות.",
        "מסלול Enterprise מתומחר בהתאמה וכולל ליווי ייעודי.",
      ],
    };
  }

  const eligible = ordered.filter(
    (p) => p.key !== "enterprise" && planMeetsNeeds(p, needs) && planCoversUsers(p, users),
  );

  if (!eligible.length) {
    const ent = ordered.find((p) => p.key === "enterprise")!;
    return {
      plan: ent,
      enterpriseContact: true,
      reasons: [
        "הדרישות חורגות מיכולות המסלולים הסטנדרטיים (Free / Pro / Business).",
        "מומלץ לפנות לצוות Enterprise להתאמה.",
      ],
    };
  }

  // Prefer lowest plan that still fits
  let pick = eligible[0];
  if (biz === "security" || needs.some((n) => n === "technicians" || n === "scheduling" || n === "checklists")) {
    pick = eligible.find((p) => p.key === "business") ?? eligible[eligible.length - 1];
  } else if (biz === "installation" || needs.includes("alternatives") || users > 1) {
    pick = eligible.find((p) => p.key === "pro" || p.key === "business") ?? eligible[0];
    if (users > 2) pick = eligible.find((p) => p.key === "business") ?? pick;
  }

  const reasons: string[] = [];
  reasons.push(`מכסה משתמשים במסלול: ${comparisonCell(pick, "max_members")}.`);
  reasons.push(`אחסון: ${comparisonCell(pick, "storage_gb")} · הצעות: ${comparisonCell(pick, "quota_display")}.`);
  if (needs.length) {
    reasons.push("המסלול כולל את היכולות שבחרתם לפי הקטלוג בפועל.");
  }
  if (planAllowsExtraSeats(pick) && users > (pick.limits.max_members || 0)) {
    const extra = users - (pick.limits.max_members || 0);
    const unit = extraSeatUnitPrice(extra);
    reasons.push(
      `מעל ${pick.limits.max_members} משתמשים: ${extra} נוספים ב־${formatIls(unit)} למשתמש לפי מדרגה (לפני מע״מ).`,
    );
  }
  reasons.push(pick.commercial?.audience_he ?? "");

  return { plan: pick, reasons: reasons.filter(Boolean), enterpriseContact: false };
}

function featureCategories(plan: CatalogPlan): { label: string; detail: string }[] {
  return [
    {
      label: "לידים וניהול לקוחות",
      detail: hasFeature(plan, "crm") ? "כלול במסלול" : "לא כלול",
    },
    {
      label: "הצעות מחיר",
      detail: `${comparisonCell(plan, "quota_display")}${hasCap(plan, "quotes.alternatives") ? " · כולל חלופות לוועד בית" : ""}`,
    },
    {
      label: "פרויקטים",
      detail: hasFeature(plan, "projects") ? "כלול במסלול" : "לא כלול",
    },
    {
      label: "קריאות שירות",
      detail: hasFeature(plan, "service")
        ? hasCap(plan, "service.reminders")
          ? "כלול · כולל תזכורות שירות"
          : "כלול"
        : "לא כלול",
    },
    {
      label: "טכנאים",
      detail: hasCap(plan, "field.technicians") ? "ניהול טכנאים בשטח" : "לא כלול במסלול זה",
    },
    {
      label: "שיבוץ וצ׳קליסט",
      detail:
        hasCap(plan, "field.dispatch") || hasCap(plan, "jobs.checklist")
          ? [
              hasCap(plan, "field.dispatch") ? "שיבוץ" : null,
              hasCap(plan, "jobs.checklist") ? "צ׳קליסט וחתימה" : null,
            ]
              .filter(Boolean)
              .join(" · ")
          : "לא כלול במסלול זה",
    },
    {
      label: "אחסון",
      detail: comparisonCell(plan, "storage_gb"),
    },
    {
      label: "משתמשים",
      detail: comparisonCell(plan, "max_members"),
    },
    {
      label: "אינטגרציות",
      detail:
        plan.key === "enterprise"
          ? "אינטגרציות מותאמות לפי דרישה"
          : hasFeature(plan, "api")
            ? "גישת API במסגרת המסלול"
            : "לא כלול במסלול זה",
    },
  ];
}

function buildCompareRows(): CompareRow[] {
  return [
    { key: "price", label: "מחיר חודשי (לפני מע״מ)", value: monthlyPrice },
    { key: "users", label: "משתמשים", value: (p) => comparisonCell(p, "max_members") },
    { key: "storage", label: "אחסון", value: (p) => comparisonCell(p, "storage_gb") },
    { key: "quotes", label: "הצעות מחיר", value: (p) => comparisonCell(p, "quota_display") },
    {
      key: "crm",
      label: "לידים וניהול לקוחות",
      value: (p) => (hasFeature(p, "crm") ? "כן" : "—"),
    },
    {
      key: "projects",
      label: "פרויקטים",
      value: (p) => (hasFeature(p, "projects") ? "כן" : "—"),
    },
    {
      key: "service",
      label: "קריאות שירות",
      value: (p) => (hasFeature(p, "service") ? "כן" : "—"),
    },
    {
      key: "technicians",
      label: "ניהול טכנאים",
      value: (p) => (hasCap(p, "field.technicians") ? "כן" : "—"),
    },
    {
      key: "scheduling",
      label: "שיבוץ",
      value: (p) => (hasCap(p, "field.dispatch") ? "כן" : "—"),
    },
    {
      key: "integrations",
      label: "אינטגרציות",
      value: (p) =>
        p.key === "enterprise" ? "מותאמות" : hasFeature(p, "api") ? "API" : "—",
    },
    {
      key: "support",
      label: "תמיכה",
      value: (p) => (p.key === "enterprise" ? "ייעודית" : "סטנדרטית"),
    },
  ];
}

function rememberPreferredPlan(planKey: string) {
  try {
    sessionStorage.setItem("ss_preferred_plan", planKey);
  } catch {
    /* ignore quota / private mode */
  }
}

function PlanCta({ plan, from }: { plan: CatalogPlan; from: string }) {
  const cta =
    plan.commercial?.cta_he ??
    (plan.key === "enterprise" ? "דברו איתנו" : plan.key === "free" ? "התחילו עכשיו" : "שדרגו");
  if (plan.key === "enterprise") {
    return (
      <Link
        to={MARKETING_ROUTES.contact}
        search={{ topic: "enterprise" }}
        className="mkt-btn mkt-btn-primary"
        onClick={() => {
          rememberPreferredPlan(plan.key);
          trackMarketingEvent("demo_start", { from, plan: plan.key });
        }}
      >
        {cta}
      </Link>
    );
  }
  return (
    <Link
      to={MARKETING_ROUTES.register}
      search={{ plan: plan.key }}
      className="mkt-btn mkt-btn-primary"
      onClick={() => {
        rememberPreferredPlan(plan.key);
        trackMarketingEvent("signup_start", { from, plan: plan.key });
      }}
    >
      {cta}
    </Link>
  );
}

function SeatCalculator({ plan }: { plan: CatalogPlan }) {
  const included = plan.limits?.max_members ?? 0;
  const base = planDisplayBaseIls(plan) ?? 0;
  const tiers = billingPublic().extra_seat_tiers;
  const [users, setUsers] = useState(Math.max(included, included + 2));

  if (!planAllowsExtraSeats(plan) || included <= 0) return null;

  const extraSeats = Math.max(0, users - included);
  const unit = extraSeatUnitPrice(extraSeats);
  const extraCost = extraSeatsTotalIls(extraSeats);
  const total = monthlyTotalIls({ plan, extraSeats }) ?? base + extraCost;

  return (
    <div className="mkt-ip-calc">
      <h4 className="m-0 text-base font-semibold">מחשבון משתמשים — {plan.label_he}</h4>
      <p className="mt-2 m-0 text-sm leading-7 text-[var(--mkt-muted)]">
        כלולים {included} משתמשים. משתמשים נוספים מתומחרים לפי מדרגות — כל הנוספים במדרגה הנוכחית במחיר המדרגה
        (לא מדורג מצטבר).
      </p>
      <ul className="mkt-ip-tiers" aria-label="מדרגות משתמשים נוספים">
        {tiers.map((t) => (
          <li key={`${t.min_extra}-${t.max_extra ?? "plus"}`}>
            {t.max_extra == null
              ? `${t.min_extra}+`
              : t.min_extra === t.max_extra
                ? `${t.min_extra}`
                : `${t.min_extra}–${t.max_extra}`}
            {" · "}
            {formatIls(t.ils_before_vat)} למשתמש
          </li>
        ))}
      </ul>
      <label className="mkt-calc-slider mt-4">
        <span>
          מספר משתמשים כולל: <strong>{users}</strong>
        </span>
        <input
          type="range"
          min={included}
          max={included + 20}
          step={1}
          value={users}
          onChange={(e) => setUsers(Number(e.target.value))}
          aria-valuemin={included}
          aria-valuemax={included + 20}
          aria-valuenow={users}
        />
      </label>
      <dl className="mkt-ip-calc-grid">
        <div>
          <dt>בסיס {plan.label_he}</dt>
          <dd>{formatIls(base)}</dd>
        </div>
        <div>
          <dt>
            נוספים ({extraSeats}
            {extraSeats > 0 ? ` × ${formatIls(unit)}` : ""})
          </dt>
          <dd>{formatIls(extraCost)}</dd>
        </div>
        <div>
          <dt>סה״כ חודשי לפני מע״מ</dt>
          <dd>{formatIls(total)}</dd>
        </div>
      </dl>
      <p className="mt-3 m-0 text-xs text-[var(--mkt-muted)]">
        אין סליקה אוטומטית באתר — שדרוג ומקומות נוספים מתבצעים בפנייה לצוות אחרי ההרשמה.
      </p>
    </div>
  );
}

function PlanFinder({
  plans,
  onSelect,
}: {
  plans: CatalogPlan[];
  onSelect: (key: string) => void;
}) {
  const [users, setUsers] = useState(1);
  const [biz, setBiz] = useState<BizType>("technician");
  const [needs, setNeeds] = useState<NeedKey[]>([]);
  const result = useMemo(() => recommendPlan(plans, users, biz, needs), [plans, users, biz, needs]);

  const toggleNeed = (key: NeedKey) => {
    setNeeds((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  return (
    <div className="mkt-ip-finder mkt-card">
      <p className="mkt-kicker">מאתר מסלול</p>
      <h3 className="m-0 text-xl font-semibold">איזה מסלול מתאים לכם?</h3>
      <p className="mt-2 text-sm leading-7 text-[var(--mkt-muted)]">
        ההמלצה מבוססת על מגבלות ויכולות מהקטלוג בפועל בלבד. אם הדרישות חורגות מ־Business — נפנה ל־Enterprise.
      </p>

      <label className="mkt-calc-slider mt-6">
        <span>
          כמה משתמשים יעבדו במערכת? <strong>{users}</strong>
        </span>
        <input
          type="range"
          min={1}
          max={30}
          value={users}
          onChange={(e) => setUsers(Number(e.target.value))}
        />
      </label>

      <fieldset className="mkt-advisor-field">
        <legend>סוג העסק</legend>
        <div className="mkt-xp-tabs" role="radiogroup" aria-label="סוג העסק">
          {BIZ_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={biz === o.key}
              className={`mkt-xp-tab${biz === o.key ? " is-active" : ""}`}
              onClick={() => setBiz(o.key)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mkt-advisor-field">
        <legend>יכולות נדרשות</legend>
        <div className="mkt-ip-needs">
          {NEED_OPTIONS.map((o) => (
            <label key={o.key} className="mkt-advisor-check">
              <input
                type="checkbox"
                checked={needs.includes(o.key)}
                onChange={() => toggleNeed(o.key)}
              />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mkt-advisor-result" aria-live="polite">
        <p className="m-0 text-sm text-[var(--mkt-muted)]">מסלול מומלץ</p>
        <p className="m-0 mt-1 text-2xl font-bold">{result.plan.label_he}</p>
        <p className="m-0 mt-1 text-xl">{monthlyPrice(result.plan)}</p>
        <p className="m-0 mt-1 text-xs text-[var(--mkt-muted)]">{monthlyPriceCaption(result.plan)}</p>
        <ul className="mt-3 m-0 list-none space-y-1 p-0 text-sm">
          {result.reasons.map((r) => (
            <li key={r}>• {r}</li>
          ))}
        </ul>
        <p className="mt-3 m-0 text-xs text-[var(--mkt-muted)]">
          מגבלות: אחסון {comparisonCell(result.plan, "storage_gb")} · משתמשים{" "}
          {comparisonCell(result.plan, "max_members")} · הצעות{" "}
          {comparisonCell(result.plan, "quota_display")}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="mkt-btn mkt-btn-secondary"
          onClick={() => {
            onSelect(result.plan.key);
            trackMarketingEvent("cta_click", { cta: "plan_finder_select", plan: result.plan.key });
          }}
        >
          הצגת המסלול בכרטיסים
        </button>
        <PlanCta plan={result.plan} from="plan_finder" />
      </div>
    </div>
  );
}

/** Full interactive pricing UI — catalog.json is the single source of truth. */
export function InteractivePricingExperience({
  compact = false,
  showTitle = true,
}: {
  compact?: boolean;
  showTitle?: boolean;
}) {
  const plans = catalogPlansOrdered();
  const billing = billingPublic();
  const baseId = useId();
  const [selected, setSelected] = useState(plans[0]?.key ?? "free");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(!compact);
  const compareRows = useMemo(() => buildCompareRows(), []);
  const active = plans.find((p) => p.key === selected) ?? plans[0];

  return (
    <div className={`mkt-ip${compact ? " is-compact" : ""}`}>
      {showTitle ? (
        <header className="mkt-ip-header">
          <h2 className="mkt-h2">תמחור שקוף. שליטה מלאה.</h2>
          <p className="mkt-lede">
            בחרו את המסלול שמתאים לגודל העסק שלכם והרחיבו משתמשים במדרגות ברורות — בלי חיוב שנתי.
          </p>
          <p className="mkt-ip-note" role="note">
            אין סליקה אוטומטית באתר. הצטרפות למסלול בתשלום ושדרוגים מתבצעים בפנייה לצוות אחרי ההרשמה.
          </p>
          <p className="mt-2 m-0 text-sm text-[var(--mkt-muted)]">{billing.vat_note_he} מוצג מחיר חודשי בלבד.</p>
        </header>
      ) : null}

      <div className="mkt-ip-cards" role="list">
        {plans.map((plan) => {
          const isSelected = selected === plan.key;
          const isOpen = expanded === plan.key;
          const categories = featureCategories(plan);
          return (
            <article
              key={plan.key}
              role="listitem"
              className={`mkt-ip-card${isSelected ? " is-selected" : ""}${plan.key === "business" ? " is-featured" : ""}`}
            >
              <button
                type="button"
                className="mkt-ip-card-select"
                aria-pressed={isSelected}
                onClick={() => {
                  setSelected(plan.key);
                  trackMarketingEvent("cta_click", { cta: "pricing_select", plan: plan.key });
                }}
              >
                {plan.key === "business" ? <span className="mkt-ip-badge">מומלץ לצוותים</span> : null}
                {plan.key === "pro" && billing.pro_launch_active ? (
                  <span className="mkt-ip-badge mkt-ip-badge-launch">מחיר השקה</span>
                ) : null}
                <span className="mkt-ip-card-name">{plan.label_he}</span>
                <span className="mkt-ip-card-price">{monthlyPrice(plan)}</span>
                <span className="mkt-ip-card-period">{monthlyPriceCaption(plan)}</span>
                <span className="mkt-ip-card-audience">{plan.commercial?.audience_he}</span>
                <span className="mkt-ip-card-limits">
                  אחסון {comparisonCell(plan, "storage_gb")} · משתמשים {comparisonCell(plan, "max_members")}
                </span>
                <ul className="mkt-ip-card-highlights">
                  {(plan.commercial?.highlights_he ?? []).slice(0, 4).map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </button>

              <button
                type="button"
                className="mkt-plan-expand"
                aria-expanded={isOpen}
                aria-controls={`${baseId}-details-${plan.key}`}
                onClick={() => setExpanded(isOpen ? null : plan.key)}
              >
                {isOpen ? "הסתר פירוט לפי קטגוריה" : "הרחב פירוט לפי קטגוריה"}
              </button>

              {isOpen ? (
                <div id={`${baseId}-details-${plan.key}`} className="mkt-ip-details">
                  <dl>
                    {categories.map((c) => (
                      <div key={c.label}>
                        <dt>{c.label}</dt>
                        <dd>{c.detail}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}

              <div className="mkt-ip-card-cta">
                <PlanCta plan={plan} from={`pricing_card_${plan.key}`} />
              </div>
            </article>
          );
        })}
      </div>

      {active ? (
        <div className="mkt-ip-active mkt-card" aria-live="polite">
          <p className="mkt-kicker">מסלול נבחר</p>
          <h3 className="m-0 text-xl font-semibold">{active.label_he}</h3>
          <p className="mt-2 m-0 text-2xl font-bold">{monthlyPrice(active)}</p>
          <p className="m-0 text-sm text-[var(--mkt-muted)]">{monthlyPriceCaption(active)}</p>
          <p className="mt-3 text-[17px] leading-7 text-[var(--mkt-ink-soft)]">
            {active.commercial?.audience_he}
          </p>
          <ul className="mkt-xp-caps mt-4">
            {(active.commercial?.highlights_he ?? []).map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <PlanCta plan={active} from="pricing_active_panel" />
            <Link to={MARKETING_ROUTES.contact} search={{ topic: "sales" }} className="mkt-btn mkt-btn-secondary">
              שאלה על שדרוג
            </Link>
          </div>
          {planAllowsExtraSeats(active) ? (
            <div className="mt-6">
              <SeatCalculator plan={active} />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mkt-ip-finder-wrap">
        <PlanFinder plans={plans} onSelect={setSelected} />
      </div>

      <div className="mkt-ip-compare">
        <button
          type="button"
          className="mkt-btn mkt-btn-secondary"
          aria-expanded={compareOpen}
          onClick={() => setCompareOpen((v) => !v)}
        >
          {compareOpen ? "הסתר טבלת השוואה" : "השוואה מלאה בין מסלולים"}
        </button>

        {compareOpen ? (
          <>
            <div className="mkt-ip-table-wrap" role="region" aria-label="טבלת השוואת מסלולים" tabIndex={0}>
              <table className="mkt-ip-table">
                <thead>
                  <tr>
                    <th scope="col">יכולת</th>
                    {plans.map((p) => (
                      <th key={p.key} scope="col">
                        {p.label_he}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compareRows.map((row) => (
                    <tr key={row.key}>
                      <th scope="row">{row.label}</th>
                      {plans.map((p) => (
                        <td key={`${p.key}-${row.key}`} className={selected === p.key ? "is-selected" : undefined}>
                          {row.value(p)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mkt-ip-stack" aria-label="השוואה למובייל">
              {plans.map((p) => (
                <article key={p.key} className={`mkt-card${selected === p.key ? " is-selected-card" : ""}`}>
                  <h4 className="m-0 text-lg font-semibold">{p.label_he}</h4>
                  <ul className="mt-3 m-0 list-none space-y-2 p-0 text-sm">
                    {compareRows.map((row) => (
                      <li key={row.key}>
                        <strong>{row.label}:</strong> {row.value(p)}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </>
        ) : null}
      </div>

      <section className="mkt-ip-faq" aria-labelledby={`${baseId}-faq`}>
        <h3 id={`${baseId}-faq`} className="m-0 text-xl font-semibold">
          שאלות על תמחור
        </h3>
        <div className="mkt-faq mt-4">
          {ssPricingFaq.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {compact ? (
        <Link
          to={MARKETING_ROUTES.pricing}
          className="mkt-btn mkt-btn-secondary mt-8"
          onClick={() => trackMarketingEvent("pricing_view", { from: "home_pricing" })}
        >
          למחירון המלא
        </Link>
      ) : (
        <Link to={MARKETING_ROUTES.home} className="mt-10 inline-flex text-sm font-semibold text-[var(--mkt-blue)]">
          חזרה לעמוד הבית
        </Link>
      )}
    </div>
  );
}
