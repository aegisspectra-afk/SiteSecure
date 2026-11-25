import { Link } from "@tanstack/react-router";
import { useId, useState } from "react";
import { MARKETING_ROUTES } from "./marketing-routes";

const LAYERS = [
  {
    key: "isolation",
    title: "כל חברה רואה רק את הנתונים שלה",
    body: "סביבת עבודה נפרדת לכל עסק — בלי ערבוב בין לקוחות.",
  },
  {
    key: "rbac",
    title: "הרשאות לפי תפקיד",
    body: "בעלים, מנהל, מכירות וטכנאי רואים ופועלים לפי מה שמותר להם.",
  },
  {
    key: "transit",
    title: "חיבור מוצפן",
    body: "התקשורת בין הדפדפן לשרת מוגנת בהצפנה.",
  },
  {
    key: "backup",
    title: "גיבויים",
    body: "הנתונים נשמרים עם גיבויים שוטפים בתשתית הענן.",
  },
] as const;

export function SecurityArchitecture() {
  const baseId = useId();
  const [active, setActive] = useState(0);
  const layer = LAYERS[active];

  return (
    <div className="mkt-sec">
      <p className="mkt-kicker">אבטחה ואמון</p>
      <h3 className="m-0 text-xl font-semibold">שמירת הנתונים שלכם</h3>
      <p className="mt-2 text-sm leading-7 text-[var(--mkt-muted)]">
        ארבע נקודות שחשוב לדעת — בשפה פשוטה.
      </p>

      <div className="mkt-sec-grid">
        <div className="mkt-sec-stack" role="tablist" aria-label="שכבות אבטחה">
          {LAYERS.map((l, i) => (
            <button
              key={l.key}
              type="button"
              role="tab"
              id={`${baseId}-${l.key}`}
              aria-selected={active === i}
              aria-controls={`${baseId}-panel`}
              className={`mkt-sec-layer${active === i ? " is-active" : ""}`}
              onClick={() => setActive(i)}
            >
              <span className="mkt-sec-idx" aria-hidden>
                {i + 1}
              </span>
              {l.title}
            </button>
          ))}
        </div>
        <div
          className="mkt-sec-detail mkt-card"
          role="tabpanel"
          id={`${baseId}-panel`}
          aria-labelledby={`${baseId}-${layer.key}`}
        >
          <h4 className="m-0 text-lg font-semibold">{layer.title}</h4>
          <p className="mt-3 text-[17px] leading-7 text-[var(--mkt-ink-soft)]">{layer.body}</p>
          <Link
            to="/legal/$slug"
            params={{ slug: "security" }}
            className="mt-6 inline-flex font-semibold text-[var(--mkt-blue)]"
          >
            לעמוד אבטחת המידע ←
          </Link>
          <Link to={MARKETING_ROUTES.contact} className="mt-3 inline-flex text-sm text-[var(--mkt-muted)]">
            דיווח על חשש אבטחה דרך צור קשר
          </Link>
        </div>
      </div>
    </div>
  );
}
