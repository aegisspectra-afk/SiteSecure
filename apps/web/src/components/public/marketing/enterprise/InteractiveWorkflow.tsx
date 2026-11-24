import { useId, useState } from "react";
import { WORKFLOW_DETAIL } from "./demo-data";

export function InteractiveWorkflow() {
  const baseId = useId();
  const [active, setActive] = useState(0);
  const step = WORKFLOW_DETAIL[active];

  return (
    <div className="mkt-wf">
      <ol className="mkt-wf-track" aria-label="רצף עבודה">
        {WORKFLOW_DETAIL.map((s, i) => (
          <li key={s.key}>
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
        <p className="mkt-kicker">שלב {active + 1} מתוך {WORKFLOW_DETAIL.length}</p>
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
            disabled={active === WORKFLOW_DETAIL.length - 1}
            onClick={() => setActive((v) => Math.min(WORKFLOW_DETAIL.length - 1, v + 1))}
          >
            הבא
          </button>
        </div>
      </div>
    </div>
  );
}
