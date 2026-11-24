import { useEffect, useId, useState } from "react";
import { trackMarketingEvent } from "../../../../lib/marketing-analytics";
import { statusLabel } from "./marketing-content";
import { EXPLORER_MODULES, DEMO_BADGE } from "./demo-data";
import { MARKETING_ROUTES } from "./marketing-routes";

/** Guided product tour — reuses EXPLORER_MODULES, step navigation, keyboard-friendly. */
export function ProductTour() {
  const baseId = useId();
  const [step, setStep] = useState(0);
  const mod = EXPLORER_MODULES[step] ?? EXPLORER_MODULES[0];
  const total = EXPLORER_MODULES.length;

  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(total - 1, next));
    setStep(clamped);
    trackMarketingEvent("cta_click", { cta: "product_tour_step", module: EXPLORER_MODULES[clamped].key });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.(".mkt-tour") == null) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      // RTL: ArrowLeft advances, ArrowRight goes back
      setStep((prev) => {
        const next = e.key === "ArrowLeft" ? prev + 1 : prev - 1;
        const clamped = Math.max(0, Math.min(total - 1, next));
        if (clamped !== prev) {
          trackMarketingEvent("cta_click", {
            cta: "product_tour_step",
            module: EXPLORER_MODULES[clamped].key,
          });
        }
        return clamped;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total]);

  return (
    <div className="mkt-tour" aria-labelledby={`${baseId}-title`} tabIndex={0}>
      <div className="mkt-tour-head">
        <div>
          <p className="mkt-kicker">סיור מוצר מודרך</p>
          <h3 id={`${baseId}-title`} className="m-0 text-xl font-semibold">
            שלב {step + 1} מתוך {total}: {mod.title}
          </h3>
        </div>
        <span className="mkt-badge">{statusLabel(mod.status)}</span>
      </div>

      <div className="mkt-tour-progress" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step + 1}>
        <span style={{ width: `${((step + 1) / total) * 100}%` }} />
      </div>

      <ol className="mkt-tour-steps" aria-label="שלבי הסיור">
        {EXPLORER_MODULES.map((m, i) => (
          <li key={m.key}>
            <button
              type="button"
              className={`mkt-tour-dot${i === step ? " is-active" : ""}${i < step ? " is-done" : ""}`}
              aria-current={i === step ? "step" : undefined}
              aria-label={`${m.title}${i === step ? " (נוכחי)" : ""}`}
              onClick={() => go(i)}
            >
              {i + 1}
            </button>
          </li>
        ))}
      </ol>

      <div className="mkt-tour-body mkt-card" aria-live="polite">
        <p className="mkt-demo-badge">{DEMO_BADGE}</p>
        <p className="mt-3 text-[17px] leading-7 text-[var(--mkt-ink-soft)]">{mod.value}</p>
        <h4 className="mt-4 text-sm font-semibold">יכולות עיקריות</h4>
        <ul className="mkt-xp-caps">
          {mod.capabilities.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" className="mkt-btn mkt-btn-secondary" disabled={step === 0} onClick={() => go(step - 1)}>
            הקודם
          </button>
          <button
            type="button"
            className="mkt-btn mkt-btn-primary"
            disabled={step === total - 1}
            onClick={() => go(step + 1)}
          >
            הבא
          </button>
          <a href={mod.cta.href || MARKETING_ROUTES.register} className="mkt-btn mkt-btn-secondary">
            {mod.cta.label}
          </a>
        </div>
      </div>
    </div>
  );
}
