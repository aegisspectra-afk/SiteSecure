import { Link } from "@tanstack/react-router";
import { useId, useState } from "react";
import { trackMarketingEvent } from "../../../../lib/marketing-analytics";
import { SOLUTION_PROFILES, type SolutionKey } from "./solutions-content";

export function SolutionsExplorer({ initial = "technicians" }: { initial?: SolutionKey }) {
  const baseId = useId();
  const [active, setActive] = useState<SolutionKey>(initial);
  const profile = SOLUTION_PROFILES.find((s) => s.key === active) ?? SOLUTION_PROFILES[0];

  return (
    <div className="mkt-xp">
      <div className="mkt-xp-tabs" role="tablist" aria-label="סוגי עסק">
        {SOLUTION_PROFILES.map((s) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            id={`${baseId}-${s.key}`}
            aria-selected={active === s.key}
            aria-controls={`${baseId}-panel`}
            className={`mkt-xp-tab${active === s.key ? " is-active" : ""}`}
            onClick={() => {
              setActive(s.key);
              trackMarketingEvent("cta_click", { cta: "solutions_tab", solution: s.key });
            }}
          >
            {s.title}
          </button>
        ))}
      </div>

      <div
        className="mkt-xp-panel"
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-${profile.key}`}
      >
        <div className="mkt-xp-copy">
          <p className="mkt-kicker">מסלול מומלץ · {profile.plan}</p>
          <h2 className="mkt-h2 mt-2">{profile.title}</h2>

          <h3 className="mt-6 text-base font-semibold">אתגרים נפוצים</h3>
          <ul className="mkt-xp-caps">
            {profile.challenges.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>

          <h3 className="mt-6 text-base font-semibold">מודולים רלוונטיים</h3>
          <ul className="mkt-xp-caps">
            {profile.modules.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>

          <h3 className="mt-6 text-base font-semibold">תועלות עסקיות</h3>
          <ul className="mkt-xp-caps">
            {profile.benefits.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>

          <a
            href={profile.cta.href}
            className="mkt-btn mkt-btn-primary mt-6"
            onClick={() => trackMarketingEvent("cta_click", { cta: "solutions_cta", solution: profile.key })}
          >
            {profile.cta.label}
          </a>
          <Link to={profile.href} className="mt-3 inline-flex text-sm font-semibold text-[var(--mkt-blue)]">
            קישור ישיר לעמוד הפתרון ←
          </Link>
        </div>

        <div className="mkt-xp-stage">
          <p className="mkt-demo-badge mkt-xp-stage-badge">רצף עבודה מוצע</p>
          <ol className="mkt-wf-track mt-10" aria-label="רצף מוצע">
            {profile.workflow.map((step, i) => (
              <li key={step}>
                <div className="mkt-wf-step is-active" aria-hidden={false}>
                  <span className="mkt-wf-index">{i + 1}</span>
                  <span className="mkt-wf-label">{step}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
