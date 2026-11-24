import { Link } from "@tanstack/react-router";
import { useId, useState } from "react";
import { trackMarketingEvent } from "../../../../lib/marketing-analytics";
import { DEMO_BADGE } from "./demo-data";
import { MARKETING_ROUTES } from "./marketing-routes";

const STEPS = [
  {
    title: "הרשמה",
    body: "יצירת חשבון דרך תשתית האימות הקיימת — בלי סיסמאות ידניות באפליקציה.",
    cta: { label: "לעמוד ההרשמה", href: MARKETING_ROUTES.register },
  },
  {
    title: "סביבת עבודה",
    body: "נוצרת סביבת עבודה מבודדת עם מסלול Free כברירת מחדל לפי הקטלוג.",
    cta: { label: "למחירון Free", href: MARKETING_ROUTES.pricing },
  },
  {
    title: "הגדרת חברה",
    body: "פרטי עסק בסיסיים באשף ההצטרפות הקיים — לא הדגמה מזויפת של שמירה.",
    cta: { label: "התחילו בחינם", href: MARKETING_ROUTES.register },
  },
  {
    title: "כניסה לעבודה",
    body: "מעבר לאפליקציה המאומתת (/platform) אחרי השלמת ההרשמה — לא סימולציה של נתוני לקוח.",
    cta: { label: "כניסה", href: MARKETING_ROUTES.login },
  },
] as const;

/** Interactive onboarding walkthrough — CTAs go to real routes only. */
export function OnboardingPreview() {
  const baseId = useId();
  const [step, setStep] = useState(0);
  const current = STEPS[step];

  return (
    <div className="mkt-onboard">
      <div className="mkt-onboard-chrome">
        <p className="m-0 text-sm font-semibold">תצוגת הצטרפות</p>
        <span className="mkt-demo-badge">{DEMO_BADGE}</span>
      </div>
      <div className="mkt-onboard-body">
        <ol className="mkt-onboard-rail" aria-label="שלבי הצטרפות">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <button
                type="button"
                className={`mkt-onboard-step${i === step ? " is-active" : ""}${i < step ? " is-done" : ""}`}
                aria-current={i === step ? "step" : undefined}
                onClick={() => {
                  setStep(i);
                  trackMarketingEvent("cta_click", { cta: "onboarding_preview", step: i });
                }}
              >
                <span aria-hidden>{i + 1}</span>
                {s.title}
              </button>
            </li>
          ))}
        </ol>
        <div className="mkt-onboard-panel" id={`${baseId}-panel`} aria-live="polite">
          <h3 className="m-0 text-lg font-semibold">{current.title}</h3>
          <p className="mt-3 text-[17px] leading-7 text-[var(--mkt-ink-soft)]">{current.body}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              className="mkt-btn mkt-btn-secondary"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              הקודם
            </button>
            <button
              type="button"
              className="mkt-btn mkt-btn-secondary"
              disabled={step === STEPS.length - 1}
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            >
              הבא
            </button>
            <Link to={current.cta.href} className="mkt-btn mkt-btn-primary">
              {current.cta.label}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
