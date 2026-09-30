/**
 * SYSTEM-DESIGNER-1 Slice D — Live Engineering Summary + Validation Center.
 */

import { useId, useState, type ReactNode } from "react";
import type { SystemRecommendation } from "@site-secure/api-client";
import type { CctvBuildRequirements } from "../../../lib/cctv-build-requirements";
import {
  buildCalculatedMetrics,
  buildLiveInputFacts,
  buildValidationCenter,
  calcFreshnessLabelHe,
  explainabilityLines,
  persistTrustLabelHe,
  readinessLabelHe,
  techLabelShort,
  type CalcFreshness,
  type DesignerReadiness,
  type PersistTrustState,
} from "../../../lib/cctv-designer-summary";
import { isProfessionalMode } from "../../../lib/cctv-designer-workspace";
import { he } from "../../../i18n/he";

type Props = {
  req: CctvBuildRequirements;
  recommendation: SystemRecommendation | null;
  calcState: CalcFreshness;
  readiness: DesignerReadiness;
  persistState: PersistTrustState;
  stale: boolean;
  collapsedDefault?: boolean;
};

function Ltr({ children }: { children: ReactNode }) {
  return (
    <span className="ltr-meta" dir="ltr">
      {children}
    </span>
  );
}

export function CctvEngineeringSummaryPanel({
  req,
  recommendation,
  calcState,
  readiness,
  persistState,
  stale,
  collapsedDefault = false,
}: Props) {
  const titleId = useId();
  const [open, setOpen] = useState(!collapsedDefault);
  const facts = buildLiveInputFacts(req);
  const metrics = buildCalculatedMetrics(recommendation, req.cctvTechnology);
  const validation = buildValidationCenter({ req, calcState, recommendation });
  const explain = explainabilityLines(calcState === "draft" ? null : recommendation);
  const blockers = validation.filter((v) => v.severity === "blocker");
  const warnings = validation.filter((v) => v.severity === "warning");
  const infos = validation.filter((v) => v.severity === "info");

  return (
    <aside
      className="cpq-cctv-sum"
      data-testid="cctv-engineering-summary"
      data-calc={calcState}
      data-readiness={readiness}
      data-persist={persistState}
      aria-labelledby={titleId}
    >
      <div className="cpq-cctv-sum-head">
        <div className="cpq-cctv-sum-head-text">
          <p className="cpq-cctv-sum-kicker">
            <Ltr>CCTV</Ltr> · <Ltr>{techLabelShort(req.cctvTechnology)}</Ltr> ·{" "}
            {isProfessionalMode(req) ? he.cpqCctvModePro : he.cpqCctvModeQuick}
          </p>
          <h2 className="cpq-cctv-sum-title" id={titleId}>
            סיכום הנדסי
          </h2>
        </div>
        <button
          type="button"
          className="cpq-cctv-sum-toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "צמצם" : "הרחב"}
        </button>
      </div>

      <div className="cpq-cctv-sum-status-row" role="status">
        <span className={`cpq-cctv-sum-pill is-readiness is-${readiness}`}>
          {readinessLabelHe(readiness)}
        </span>
        <span className={`cpq-cctv-sum-pill is-calc is-${calcState}`}>
          {calcFreshnessLabelHe(calcState)}
        </span>
        <span className={`cpq-cctv-sum-pill is-persist is-${persistState}`}>
          {persistTrustLabelHe(persistState)}
        </span>
      </div>

      {stale ? (
        <p className="cpq-cctv-sum-stale" role="status" aria-live="polite" data-testid="cctv-sum-stale">
          {he.cpqCctvStaleBanner}
        </p>
      ) : null}

      {open ? (
        <div className="cpq-cctv-sum-body">
          <section className="cpq-cctv-sum-block" aria-labelledby={`${titleId}-facts`}>
            <h3 className="cpq-cctv-sum-block-title" id={`${titleId}-facts`}>
              דרישות נוכחיות
            </h3>
            <dl className="cpq-cctv-sum-dl">
              {facts.map((f) => (
                <div key={f.id} className="cpq-cctv-sum-row">
                  <dt>{f.label}</dt>
                  <dd dir={f.ltr ? "ltr" : undefined}>{f.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="cpq-cctv-sum-block" aria-labelledby={`${titleId}-calc`}>
            <h3 className="cpq-cctv-sum-block-title" id={`${titleId}-calc`}>
              מדדים מחושבים (שרת)
              {calcState === "stale" ? (
                <span className="cpq-cctv-sum-stale-tag"> לא עדכני</span>
              ) : null}
              {calcState === "draft" ? (
                <span className="cpq-cctv-sum-stale-tag"> ממתין לחישוב</span>
              ) : null}
            </h3>
            {metrics.length === 0 ? (
              <p className="cpq-cctv-sum-empty">אין מדדים מהשרת עד לחישוב מערכת.</p>
            ) : (
              <dl
                className={
                  calcState === "fresh" ? "cpq-cctv-sum-dl" : "cpq-cctv-sum-dl is-stale-metrics"
                }
                data-testid="cctv-calculated-metrics"
                data-fresh={calcState === "fresh" ? "true" : "false"}
              >
                {metrics.map((m) => (
                  <div key={m.id} className="cpq-cctv-sum-row">
                    <dt>{m.label}</dt>
                    <dd dir={m.ltr ? "ltr" : undefined}>{m.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section
            className="cpq-cctv-sum-block"
            aria-labelledby={`${titleId}-val`}
            data-testid="cctv-validation-center"
          >
            <h3 className="cpq-cctv-sum-block-title" id={`${titleId}-val`}>
              מרכז בדיקות
            </h3>
            {blockers.length === 0 && warnings.length === 0 && infos.length === 0 ? (
              <p className="cpq-cctv-sum-empty">אין התראות כרגע.</p>
            ) : (
              <ul className="cpq-cctv-sum-val-list">
                {blockers.map((item) => (
                  <li key={item.id} className="cpq-cctv-sum-val is-blocker">
                    <span className="cpq-cctv-sum-val-sev">BLOCKER</span>
                    <span>{item.message}</span>
                  </li>
                ))}
                {warnings.map((item) => (
                  <li key={item.id} className="cpq-cctv-sum-val is-warning">
                    <span className="cpq-cctv-sum-val-sev">WARNING</span>
                    <span>{item.message}</span>
                  </li>
                ))}
                {infos.map((item) => (
                  <li key={item.id} className="cpq-cctv-sum-val is-info">
                    <span className="cpq-cctv-sum-val-sev">INFO</span>
                    <span>{item.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {explain.length > 0 ? (
            <section className="cpq-cctv-sum-block" aria-labelledby={`${titleId}-why`}>
              <h3 className="cpq-cctv-sum-block-title" id={`${titleId}-why`}>
                למה כך?
              </h3>
              <ul className="cpq-cctv-sum-explain">
                {explain.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
