import { useEffect, useId, useState } from "react";
import { ActivityFeed } from "./ActivityFeed";
import { DEMO_BADGE, DEMO_CHART, DEMO_KPIS } from "./demo-data";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

function AnimatedValue({ value, active }: { value: number; active: boolean }) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(reduced || !active ? value : 0);

  useEffect(() => {
    if (reduced || !active) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const duration = 700;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setShown(Math.round(value * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, active, reduced]);

  return <span>{shown}</span>;
}

/** Interactive hero dashboard — synthetic demo only. */
export function DemoDashboard() {
  const labelId = useId();
  const [activeKpi, setActiveKpi] = useState(0);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const maxQuotes = Math.max(...DEMO_CHART.map((d) => d.quotes));

  return (
    <div className="mkt-demo" aria-labelledby={labelId}>
      <div className="mkt-demo-chrome">
        <span className="mkt-demo-dot" aria-hidden />
        <span className="mkt-demo-dot" aria-hidden />
        <span className="mkt-demo-dot" aria-hidden />
        <p id={labelId} className="mkt-demo-title">
          לוח בקרה · SITE SECURE
        </p>
        <span className="mkt-demo-badge">{DEMO_BADGE}</span>
      </div>

      <div className="mkt-demo-body">
        <div className="mkt-demo-kpis" role="tablist" aria-label="מדדי הדגמה">
          {DEMO_KPIS.map((kpi, i) => (
            <button
              key={kpi.key}
              type="button"
              role="tab"
              aria-selected={activeKpi === i}
              className={`mkt-demo-kpi${activeKpi === i ? " is-active" : ""}`}
              onClick={() => setActiveKpi(i)}
            >
              <span className="mkt-demo-kpi-label">{kpi.label}</span>
              <strong className="mkt-demo-kpi-value">
                <AnimatedValue value={kpi.value} active={activeKpi === i} />
              </strong>
              <span className="mkt-demo-kpi-hint">{kpi.hint}</span>
            </button>
          ))}
        </div>

        <div className="mkt-demo-main">
          <div className="mkt-demo-panel">
            <div className="mkt-demo-panel-head">
              <h3>פעילות השבוע</h3>
              <p className="mkt-demo-caption">הצעות מול התקנות · {DEMO_BADGE}</p>
            </div>
            <div className="mkt-demo-chart" role="img" aria-label="תרשים עמודות להדגמה">
              {DEMO_CHART.map((d, i) => {
                const h = Math.max(12, Math.round((d.quotes / maxQuotes) * 100));
                const h2 = Math.max(8, Math.round((d.installs / maxQuotes) * 100));
                return (
                  <button
                    key={d.label}
                    type="button"
                    className={`mkt-demo-bar-group${hoveredBar === i ? " is-hot" : ""}`}
                    onMouseEnter={() => setHoveredBar(i)}
                    onMouseLeave={() => setHoveredBar(null)}
                    onFocus={() => setHoveredBar(i)}
                    onBlur={() => setHoveredBar(null)}
                    aria-label={`${d.label}: ${d.quotes} הצעות, ${d.installs} התקנות`}
                  >
                    <span className="mkt-demo-bar is-quotes" style={{ height: `${h}%` }} />
                    <span className="mkt-demo-bar is-installs" style={{ height: `${h2}%` }} />
                    <span className="mkt-demo-bar-label">{d.label}</span>
                  </button>
                );
              })}
            </div>
            {hoveredBar != null ? (
              <p className="mkt-demo-chart-tip" role="status">
                {DEMO_CHART[hoveredBar].label}: {DEMO_CHART[hoveredBar].quotes} הצעות ·{" "}
                {DEMO_CHART[hoveredBar].installs} התקנות
              </p>
            ) : (
              <p className="mkt-demo-chart-tip mkt-demo-chart-tip-idle">עברו על עמודה לפירוט</p>
            )}
          </div>

          <div className="mkt-demo-panel">
            <ActivityFeed compact />
          </div>
        </div>
      </div>
    </div>
  );
}
