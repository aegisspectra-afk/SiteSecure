import { useEffect, useState } from "react";
import { he } from "../../i18n/he";
import { useAuthExperience } from "./AuthExperience";

const FLOW = [
  { key: "LEAD", caption: he.authFlowLead },
  { key: "SITE", caption: he.authFlowSite },
  { key: "PROJECT", caption: he.authFlowProject },
  { key: "SYSTEM", caption: he.authFlowSystem },
  { key: "SERVICE", caption: he.authFlowService },
] as const;
const STEP_MS = 2200;

type NodeState = "completed" | "active" | "upcoming";

function nodeState(index: number, activeIndex: number): NodeState {
  if (index < activeIndex) return "completed";
  if (index === activeIndex) return "active";
  return "upcoming";
}

function scanFilledCount(passwordLength: number) {
  if (passwordLength <= 0) return 0;
  return Math.min(FLOW.length, Math.max(1, Math.ceil((passwordLength / 8) * FLOW.length)));
}

/** Living product map — infographic with gentle motion, no fake workspace data. */
export function AuthProductFlow() {
  const { passwordScan } = useAuthExperience();
  const [activeIndex, setActiveIndex] = useState(0);
  const [pulseConnector, setPulseConnector] = useState<number | null>(null);
  const scanning = passwordScan > 0;
  const filled = scanFilledCount(passwordScan);

  useEffect(() => {
    if (scanning) return;
    const timer = window.setInterval(() => {
      setActiveIndex((value) => (value + 1) % FLOW.length);
    }, STEP_MS);
    return () => window.clearInterval(timer);
  }, [scanning]);

  useEffect(() => {
    if (scanning) return;
    setPulseConnector(activeIndex);
    const timer = window.setTimeout(() => setPulseConnector(null), 680);
    return () => window.clearTimeout(timer);
  }, [activeIndex, scanning]);

  return (
    <section aria-label={he.authProductFlowAria} className="auth-product-flow" dir="ltr">
      <p className="auth-product-flow-label">{he.authProductFlowLabel}</p>
      <ol className={scanning ? "auth-product-flow-list is-scanning" : "auth-product-flow-list"}>
        {FLOW.map((step, index) => {
          const state = scanning
            ? index < filled
              ? index === filled - 1
                ? "active"
                : "completed"
              : "upcoming"
            : nodeState(index, activeIndex);
          const connectorActive = !scanning && pulseConnector === index && index < FLOW.length - 1;
          return (
            <li
              key={step.key}
              className={`auth-product-flow-item is-${state}${scanning && index < filled ? " is-scan-filled" : ""}`}
              aria-current={state === "active" ? "step" : undefined}
              style={scanning ? { transitionDelay: `${index * 180}ms` } : undefined}
            >
              <span className="auth-product-flow-node-wrap" aria-hidden>
                <span className="auth-product-flow-node" />
                {state === "completed" ? <span className="auth-product-flow-check">✓</span> : null}
              </span>
              <span className="auth-product-flow-copy">
                <span className="auth-product-flow-step">{step.key}</span>
                <span className="auth-product-flow-blurb">{step.caption}</span>
              </span>
              {index < FLOW.length - 1 ? (
                <span
                  className={connectorActive ? "auth-product-flow-connector is-pulse" : "auth-product-flow-connector"}
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>
      <p className="auth-product-flow-caption" dir="rtl">
        {he.authHebrewSupport}
      </p>
    </section>
  );
}
