import { useId, useState } from "react";

const STEPS = [
  {
    title: "סיור",
    body: "באתר: תמונות, הערות ואשף CCTV — בסיס להצעה מקצועית בלי לחזור למשרד.",
  },
  {
    title: "הצעה",
    body: "חלופות לוועד בית, תמחור ותמונות — מוכנים לשליחה ללקוח בוואטסאפ.",
  },
  {
    title: "אישור",
    body: "הלקוח בוחר חלופה ומאשר. ממשיכים לפרויקט בלי לאבד את ההקשר.",
  },
  {
    title: "התקנה",
    body: "עבודה בשטח עם צ׳קליסט, תמונות וחתימה מהטלפון או מהטאבלט.",
  },
  {
    title: "מסירה",
    body: "תעודת מסירה במותג שלכם ותיק אתר מסודר ללקוח.",
  },
  {
    title: "שירות",
    body: "אחריות, תחזוקה וקריאות המשך — על אותו אתר ואותו היסטוריה.",
  },
] as const;

/** Single customer-facing workflow for the home page. */
export function HomeHowItWorks() {
  const baseId = useId();
  const [active, setActive] = useState(0);
  const step = STEPS[active];

  return (
    <div className="mkt-wf">
      <ol className="mkt-wf-track" aria-label="איך זה עובד">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <button
              type="button"
              className={`mkt-wf-step${active === i ? " is-active" : ""}${i < active ? " is-done" : ""}`}
              aria-current={active === i ? "step" : undefined}
              aria-controls={`${baseId}-detail`}
              onClick={() => setActive(i)}
            >
              <span className="mkt-wf-index" aria-hidden>
                {i + 1}
              </span>
              <span className="mkt-wf-label">{s.title}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="mkt-wf-detail mkt-card" id={`${baseId}-detail`} aria-live="polite">
        <p className="mkt-kicker">
          שלב {active + 1} מתוך {STEPS.length}
        </p>
        <h3 className="mkt-h2 mt-2">{step.title}</h3>
        <p className="mkt-lede">{step.body}</p>
        <div className="mkt-wf-nav mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            className="mkt-btn mkt-btn-secondary"
            disabled={active === 0}
            onClick={() => setActive((v) => Math.max(0, v - 1))}
          >
            הקודם
          </button>
          <button
            type="button"
            className="mkt-btn mkt-btn-primary"
            disabled={active === STEPS.length - 1}
            onClick={() => setActive((v) => Math.min(STEPS.length - 1, v + 1))}
          >
            הבא
          </button>
        </div>
      </div>
    </div>
  );
}
